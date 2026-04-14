/**
 * shopping.js — <fp-shopping> Custom Element
 *
 * A touch-friendly shopping list widget with auto-categorisation.
 *
 * Attributes:
 *   mode="full"  — Expanded view with category grouping, checkboxes,
 *                  delete buttons, and a completed section.
 *                  Omit for the default compact dashboard widget.
 *
 * IndexedDB store: shopping_items
 *   { id, text, category, checked, addedBy, addedAt, checkedAt }
 *
 * Dependencies:
 *   escapeHtml, generateId  from ../utils.js
 *   store, eventBus         from ../state.js
 *   db                      from ../db.js
 *
 * Usage:
 *   <fp-shopping></fp-shopping>
 *   <fp-shopping mode="full"></fp-shopping>
 */

import { escapeHtml, generateId } from '../utils.js';
import { store, eventBus } from '../state.js';
import { db } from '../db.js';

// ---------------------------------------------------------------------------
// Category definitions & auto-detection
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: 'produce',   label: 'Fruit & Veg',   keywords: ['apple', 'banana', 'tomato', 'potato', 'onion', 'carrot', 'lettuce', 'pepper', 'mushroom', 'broccoli', 'avocado', 'lemon', 'orange', 'grape', 'strawberry', 'cucumber', 'celery', 'spinach', 'garlic', 'ginger'] },
  { id: 'dairy',     label: 'Dairy',          keywords: ['milk', 'cheese', 'yoghurt', 'yogurt', 'butter', 'cream', 'egg', 'eggs'] },
  { id: 'meat',      label: 'Meat & Fish',    keywords: ['chicken', 'beef', 'pork', 'lamb', 'mince', 'sausage', 'bacon', 'salmon', 'tuna', 'fish', 'prawns', 'turkey', 'ham'] },
  { id: 'bakery',    label: 'Bakery',         keywords: ['bread', 'rolls', 'croissant', 'bagel', 'wrap', 'pitta', 'cake', 'muffin'] },
  { id: 'frozen',    label: 'Frozen',         keywords: ['frozen', 'ice cream', 'pizza', 'chips', 'fish fingers'] },
  { id: 'household', label: 'Household',      keywords: ['toilet roll', 'kitchen roll', 'bin bags', 'washing up', 'detergent', 'soap', 'shampoo', 'toothpaste', 'bleach', 'sponge', 'batteries'] },
  { id: 'other',     label: 'Other',          keywords: [] },
];

/** Maps category id → label for fast lookup. */
const CAT_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));

/**
 * Returns a colour associated with each category (used for chips).
 * @param {string} catId
 * @returns {string}  CSS colour value
 */
function catColour(catId) {
  const COLOURS = {
    produce:   '#2dc653',
    dairy:     '#58a6ff',
    meat:      '#f78166',
    bakery:    '#e3b341',
    frozen:    '#79c0ff',
    household: '#bc8cff',
    other:     '#8b949e',
  };
  return COLOURS[catId] ?? '#8b949e';
}

/**
 * Inspects the item text and returns the best-matching category id.
 * @param {string} text
 * @returns {string}
 */
function detectCategory(text) {
  const lower = text.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some(kw => lower.includes(kw))) return cat.id;
  }
  return 'other';
}

// ---------------------------------------------------------------------------
// Custom Element
// ---------------------------------------------------------------------------

class FpShopping extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    /** @type {Array<{id, text, category, checked, addedBy, addedAt, checkedAt}>} */
    this._items = [];
    /** Whether the "Completed" section is expanded in full mode. */
    this._completedOpen = false;
    /** Used to suppress re-entrant renders during transitions. */
    this._rendering = false;
  }

  // -------------------------------------------------------------------------
  // Observed attributes
  // -------------------------------------------------------------------------

  static get observedAttributes() {
    return ['mode'];
  }

  attributeChangedCallback() {
    if (this.shadowRoot.innerHTML) {
      this._renderShell();
      this._renderList();
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  connectedCallback() {
    this._renderShell();
    this._loadItems();
    this.style.position = 'relative';
  }

  disconnectedCallback() {
    // Nothing to tear down — no intervals or external subscriptions in use.
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  get _isFull() {
    return this.getAttribute('mode') === 'full';
  }

  /** Unchecked items sorted by addedAt ascending (oldest first). */
  get _unchecked() {
    return this._items
      .filter(i => !i.checked)
      .sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
  }

  /** Checked items sorted by checkedAt descending (most recently checked first). */
  get _checked() {
    return this._items
      .filter(i => i.checked)
      .sort((a, b) => new Date(b.checkedAt ?? b.addedAt) - new Date(a.checkedAt ?? a.addedAt));
  }

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------

  async _loadItems() {
    try {
      this._items = await db.getAll('shopping_items');
    } catch (err) {
      console.error('[fp-shopping] Failed to load items:', err);
      this._items = [];
    }
    this._renderList();
  }

  /**
   * Adds a new item to the store.
   * @param {string} text
   * @returns {Promise<void>}
   */
  async _addItem(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const item = {
      id:        generateId(),
      text:      trimmed,
      category:  detectCategory(trimmed),
      checked:   false,
      addedBy:   store.get('config')?.family?.members?.[0]?.name ?? 'Family',
      addedAt:   new Date().toISOString(),
      checkedAt: null,
    };

    try {
      await db.put('shopping_items', item);
      this._items.push(item);
      this._renderList();
      this._scrollToNew(item.id);
    } catch (err) {
      console.error('[fp-shopping] Failed to add item:', err);
    }
  }

  /**
   * Toggles the checked state of an item.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async _toggleItem(id) {
    const item = this._items.find(i => i.id === id);
    if (!item) return;

    const updated = {
      ...item,
      checked:   !item.checked,
      checkedAt: !item.checked ? new Date().toISOString() : null,
    };

    try {
      await db.put('shopping_items', updated);
      const idx = this._items.findIndex(i => i.id === id);
      if (idx !== -1) this._items[idx] = updated;
      this._renderList();
    } catch (err) {
      console.error('[fp-shopping] Failed to toggle item:', err);
    }
  }

  /**
   * Deletes a single item from the store.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async _deleteItem(id) {
    try {
      await db.delete('shopping_items', id);
      this._items = this._items.filter(i => i.id !== id);
      this._renderList();
    } catch (err) {
      console.error('[fp-shopping] Failed to delete item:', err);
    }
  }

  /**
   * Deletes all checked items from the store.
   * @returns {Promise<void>}
   */
  async _clearCompleted() {
    const ids = this._checked.map(i => i.id);
    try {
      await Promise.all(ids.map(id => db.delete('shopping_items', id)));
      this._items = this._items.filter(i => !i.checked);
      this._completedOpen = false;
      this._renderList();
    } catch (err) {
      console.error('[fp-shopping] Failed to clear completed:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Rendering — shell (written once; replaced on mode change)
  // -------------------------------------------------------------------------

  _renderShell() {
    const isFull = this._isFull;

    this.shadowRoot.innerHTML = `
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: var(--font, system-ui, sans-serif);
          color: var(--text, #e6edf3);
          overflow: hidden;
        }

        /* ------------------------------------------------------------------ */
        /* Scrollbar                                                            */
        /* ------------------------------------------------------------------ */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: var(--border, #30363d);
          border-radius: 2px;
        }

        /* ------------------------------------------------------------------ */
        /* Header (dashboard mode only)                                        */
        /* ------------------------------------------------------------------ */
        .header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 0 12px 0;
          flex-shrink: 0;
        }
        .header-title {
          font-size: var(--text-lg, 18px);
          font-weight: 600;
          flex: 1;
        }
        .header-badge {
          background: var(--accent, #e94560);
          color: #fff;
          border-radius: 99px;
          font-size: var(--text-xs, 13px);
          font-weight: 700;
          padding: 1px 8px;
          min-width: 24px;
          text-align: center;
          display: none;
        }
        .header-badge.visible { display: inline-block; }

        /* ------------------------------------------------------------------ */
        /* Quick-add bar                                                        */
        /* ------------------------------------------------------------------ */
        .quick-add {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          ${isFull ? 'padding-bottom: 14px;' : 'padding-top: 4px;'}
        }
        .quick-add-wrap {
          flex: 1;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .quick-add-input {
          flex: 1;
          height: 48px;
          background: var(--surface-hover, #1c2333);
          border: 1px solid var(--border, #30363d);
          border-radius: var(--radius-sm, 8px);
          color: var(--text, #e6edf3);
          font-family: var(--font, system-ui, sans-serif);
          font-size: var(--text-sm, 14px);
          padding: 0 12px;
          outline: none;
          transition: border-color var(--transition, 0.15s ease);
          width: 100%;
        }
        .quick-add-input:focus {
          border-color: var(--accent, #e94560);
        }
        .quick-add-input::placeholder {
          color: var(--text-muted, #8b949e);
        }
        .cat-preview {
          display: none;
          align-items: center;
          gap: 6px;
          font-size: var(--text-xs, 13px);
          color: var(--text-muted, #8b949e);
          padding: 0 2px;
          min-height: 18px;
        }
        .cat-preview.visible { display: flex; }
        .cat-preview-label { font-size: var(--text-xs, 13px); color: var(--text-muted, #8b949e); }
        .add-btn {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          background: var(--accent, #e94560);
          color: #fff;
          border: none;
          border-radius: var(--radius-sm, 8px);
          font-size: 24px;
          font-weight: 300;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: filter var(--transition, 0.15s ease);
          line-height: 1;
          touch-action: manipulation;
        }
        .add-btn:hover  { filter: brightness(1.15); }
        .add-btn:active { filter: brightness(0.85); }

        /* ------------------------------------------------------------------ */
        /* Category chip                                                        */
        /* ------------------------------------------------------------------ */
        .cat-chip {
          display: inline-flex;
          align-items: center;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          letter-spacing: 0.02em;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* ------------------------------------------------------------------ */
        /* Scrollable list area                                                 */
        /* ------------------------------------------------------------------ */
        .list-area {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
        }

        /* ------------------------------------------------------------------ */
        /* Dashboard item row                                                   */
        /* ------------------------------------------------------------------ */
        .dash-item {
          display: flex;
          align-items: center;
          min-height: 48px;
          padding: 8px 4px 8px 0;
          border-bottom: 1px solid var(--border, #30363d);
          cursor: pointer;
          gap: 10px;
          transition: background var(--transition, 0.15s ease);
          border-radius: 4px;
          touch-action: manipulation;
          user-select: none;
          -webkit-user-select: none;
        }
        .dash-item:last-child { border-bottom: none; }
        .dash-item:hover { background: var(--surface-hover, #1c2333); }
        .dash-item:active { background: var(--surface, #161b22); }
        .dash-item-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-left: 6px;
        }
        .dash-item-text {
          flex: 1;
          font-size: var(--text-sm, 14px);
          line-height: 1.4;
          word-break: break-word;
          transition: all 0.25s ease;
        }
        .dash-item-text.checking {
          text-decoration: line-through;
          color: var(--text-muted, #8b949e);
          opacity: 0.5;
        }

        /* ------------------------------------------------------------------ */
        /* Full mode — category group                                           */
        /* ------------------------------------------------------------------ */
        .cat-group { margin-bottom: 8px; }
        .cat-group-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 0 4px 0;
          font-size: var(--text-xs, 13px);
          font-weight: 700;
          color: var(--text-muted, #8b949e);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          flex-shrink: 0;
        }
        .cat-group-line {
          flex: 1;
          height: 1px;
          background: var(--border, #30363d);
          border-radius: 1px;
        }

        /* ------------------------------------------------------------------ */
        /* Full mode — item row                                                 */
        /* ------------------------------------------------------------------ */
        .full-item {
          display: flex;
          align-items: center;
          min-height: 56px;
          padding: 8px 6px;
          gap: 10px;
          border-radius: var(--radius-sm, 8px);
          transition: background var(--transition, 0.15s ease);
          touch-action: manipulation;
        }
        .full-item:hover { background: var(--surface-hover, #1c2333); }

        /* Custom checkbox */
        .checkbox {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid var(--border, #30363d);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s ease;
          touch-action: manipulation;
          user-select: none;
          -webkit-user-select: none;
        }
        .checkbox:hover { border-color: var(--success, #2dc653); }
        .checkbox.checked {
          background: var(--success, #2dc653);
          border-color: var(--success, #2dc653);
        }
        .checkbox.checked::after {
          content: '✓';
          color: white;
          font-size: 18px;
          font-weight: bold;
        }

        /* Item text */
        .full-item-text {
          flex: 1;
          font-size: var(--text-sm, 14px);
          line-height: 1.4;
          word-break: break-word;
          transition: all 0.25s ease;
          min-width: 0;
        }
        .full-item-text.checked {
          text-decoration: line-through;
          color: var(--text-muted, #8b949e);
          opacity: 0.6;
        }

        /* Delete button */
        .delete-btn {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          background: transparent;
          border: none;
          color: var(--text-muted, #8b949e);
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all var(--transition, 0.15s ease);
          touch-action: manipulation;
          line-height: 1;
        }
        .delete-btn:hover {
          background: rgba(233, 69, 96, 0.15);
          color: var(--danger, #e94560);
        }
        .delete-btn:active { filter: brightness(0.85); }

        /* ------------------------------------------------------------------ */
        /* Completed section (full mode)                                        */
        /* ------------------------------------------------------------------ */
        .completed-section { margin-top: 8px; flex-shrink: 0; }
        .completed-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 6px;
          cursor: pointer;
          border-radius: var(--radius-sm, 8px);
          transition: background var(--transition, 0.15s ease);
          user-select: none;
          -webkit-user-select: none;
          touch-action: manipulation;
        }
        .completed-toggle:hover { background: var(--surface-hover, #1c2333); }
        .completed-toggle-label {
          flex: 1;
          font-size: var(--text-sm, 14px);
          font-weight: 600;
          color: var(--text-muted, #8b949e);
        }
        .completed-chevron {
          font-size: 12px;
          color: var(--text-muted, #8b949e);
          transition: transform 0.2s ease;
        }
        .completed-chevron.open { transform: rotate(90deg); }

        .completed-body {
          display: none;
          flex-direction: column;
          padding-bottom: 8px;
        }
        .completed-body.open { display: flex; }

        .clear-btn {
          margin: 8px 6px 4px 6px;
          padding: 10px 16px;
          background: transparent;
          border: 1px solid var(--border, #30363d);
          border-radius: var(--radius-sm, 8px);
          color: var(--text-muted, #8b949e);
          font-family: var(--font, system-ui, sans-serif);
          font-size: var(--text-sm, 14px);
          cursor: pointer;
          transition: all var(--transition, 0.15s ease);
          min-height: 44px;
          touch-action: manipulation;
        }
        .clear-btn:hover {
          border-color: var(--danger, #e94560);
          color: var(--danger, #e94560);
          background: rgba(233, 69, 96, 0.08);
        }
        .clear-btn:active { filter: brightness(0.85); }

        /* ------------------------------------------------------------------ */
        /* Empty state                                                          */
        /* ------------------------------------------------------------------ */
        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 32px 16px;
          color: var(--text-muted, #8b949e);
          font-size: var(--text-sm, 14px);
          text-align: center;
          flex: 1;
        }
        .empty-icon { font-size: 36px; line-height: 1; }
      </style>

      ${isFull ? '' : `
        <div class="header">
          <span class="header-title">Shopping</span>
          <span class="header-badge" id="badge"></span>
        </div>
      `}

      <div class="quick-add" id="quick-add">
        <div class="quick-add-wrap">
          <input
            class="quick-add-input"
            id="add-input"
            type="text"
            placeholder="Add item…"
            maxlength="200"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
          >
          ${isFull ? '<div class="cat-preview" id="cat-preview"></div>' : ''}
        </div>
        <button class="add-btn" id="add-btn" type="button" aria-label="Add item">＋</button>
      </div>

      <div class="list-area" id="list-area"></div>
    `;

    this._bindShellEvents();
  }

  // -------------------------------------------------------------------------
  // Rendering — list (re-rendered on every data change)
  // -------------------------------------------------------------------------

  _renderList() {
    const area = this.shadowRoot.getElementById('list-area');
    if (!area) return;

    if (this._isFull) {
      this._renderFullList(area);
    } else {
      this._renderDashList(area);
    }

    this._updateBadge();
  }

  // ·· Dashboard ··············~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  _renderDashList(area) {
    const items = this._unchecked;

    if (items.length === 0 && this._items.length === 0) {
      area.innerHTML = `
        <div class="empty">
          <span class="empty-icon">🛒</span>
          Nothing on the list yet!
        </div>
      `;
      return;
    }

    if (items.length === 0) {
      area.innerHTML = `
        <div class="empty">
          <span class="empty-icon">✅</span>
          Everything's done!
        </div>
      `;
      return;
    }

    area.innerHTML = items.map(item => `
      <div class="dash-item" data-id="${escapeHtml(item.id)}" role="button" tabindex="0" aria-label="Check off ${escapeHtml(item.text)}">
        <span class="dash-item-dot" style="background:${catColour(item.category)};"></span>
        <span class="dash-item-text" id="dt-${escapeHtml(item.id)}">${escapeHtml(item.text)}</span>
      </div>
    `).join('');

    // Event delegation on container
    area.onclick = (e) => {
      const row = e.target.closest('.dash-item');
      if (!row) return;
      const id = row.dataset.id;
      if (!id) return;
      // Animate strikethrough then remove
      const textEl = row.querySelector('.dash-item-text');
      if (textEl) textEl.classList.add('checking');
      setTimeout(() => this._toggleItem(id), 280);
    };

    area.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const row = e.target.closest('.dash-item');
        if (row) row.click();
      }
    };
  }

  // ·· Full mode ···············~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  _renderFullList(area) {
    const unchecked = this._unchecked;
    const checked   = this._checked;

    if (unchecked.length === 0 && checked.length === 0) {
      area.innerHTML = `
        <div class="empty">
          <span class="empty-icon">🛒</span>
          Shopping list is empty. Add items above!
        </div>
      `;
      area.onclick = null;
      return;
    }

    // Group unchecked by category (preserving CATEGORIES order)
    const grouped = new Map();
    for (const cat of CATEGORIES) grouped.set(cat.id, []);
    for (const item of unchecked) {
      const catId = item.category ?? 'other';
      if (!grouped.has(catId)) grouped.set(catId, []);
      grouped.get(catId).push(item);
    }

    let html = '';

    // Unchecked groups
    for (const [catId, items] of grouped) {
      if (items.length === 0) continue;
      const colour = catColour(catId);
      html += `<div class="cat-group" data-cat="${escapeHtml(catId)}">`;
      html += `
        <div class="cat-group-header">
          <span style="color:${colour};">${escapeHtml(CAT_LABEL[catId] ?? catId)}</span>
          <div class="cat-group-line"></div>
        </div>
      `;
      html += items.map(item => this._fullItemHtml(item)).join('');
      html += `</div>`;
    }

    // Completed section
    if (checked.length > 0) {
      const open = this._completedOpen;
      html += `
        <div class="completed-section" id="completed-section">
          <div class="completed-toggle" id="completed-toggle" role="button" tabindex="0"
               aria-expanded="${open}" aria-controls="completed-body">
            <span class="completed-toggle-label">Completed (${checked.length})</span>
            <span class="completed-chevron${open ? ' open' : ''}">▶</span>
          </div>
          <div class="completed-body${open ? ' open' : ''}" id="completed-body">
            ${checked.map(item => this._fullItemHtml(item)).join('')}
            <button class="clear-btn" id="clear-btn" type="button">Clear completed</button>
          </div>
        </div>
      `;
    }

    area.innerHTML = html;
    this._bindFullListEvents(area);
  }

  /**
   * Builds the HTML for a single item row in full mode.
   * @param {{id, text, category, checked}} item
   * @returns {string}
   */
  _fullItemHtml(item) {
    const id      = escapeHtml(item.id);
    const text    = escapeHtml(item.text);
    const catId   = item.category ?? 'other';
    const colour  = catColour(catId);
    const label   = escapeHtml(CAT_LABEL[catId] ?? catId);
    const checked = item.checked;

    return `
      <div class="full-item" data-id="${id}">
        <div class="checkbox${checked ? ' checked' : ''}" data-action="toggle" data-id="${id}"
             role="checkbox" aria-checked="${checked}" tabindex="0"
             aria-label="${checked ? 'Uncheck' : 'Check'} ${text}"></div>
        <span class="full-item-text${checked ? ' checked' : ''}">${text}</span>
        <span class="cat-chip" style="background:${colour}1a; color:${colour};">${label}</span>
        <button class="delete-btn" data-action="delete" data-id="${id}"
                type="button" aria-label="Delete ${text}">×</button>
      </div>
    `;
  }

  /**
   * Attaches delegated event listeners to the list area in full mode.
   * @param {HTMLElement} area
   */
  _bindFullListEvents(area) {
    area.onclick = (e) => {
      // Toggle checkbox
      const toggleEl = e.target.closest('[data-action="toggle"]');
      if (toggleEl) {
        const id = toggleEl.dataset.id;
        if (id) this._toggleItem(id);
        return;
      }

      // Delete button
      const deleteEl = e.target.closest('[data-action="delete"]');
      if (deleteEl) {
        const id = deleteEl.dataset.id;
        if (id) this._deleteItem(id);
        return;
      }

      // Completed toggle accordion
      const toggle = e.target.closest('#completed-toggle');
      if (toggle) {
        this._completedOpen = !this._completedOpen;
        this._renderList();
        return;
      }

      // Clear completed
      if (e.target.closest('#clear-btn')) {
        this._clearCompleted();
        return;
      }
    };

    area.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const el = e.target.closest('[data-action]');
        if (el) { e.preventDefault(); el.click(); return; }
        const toggle = e.target.closest('#completed-toggle');
        if (toggle) { e.preventDefault(); toggle.click(); }
      }
    };
  }

  // -------------------------------------------------------------------------
  // Rendering — badge & category preview
  // -------------------------------------------------------------------------

  _updateBadge() {
    const badge = this.shadowRoot.getElementById('badge');
    if (!badge) return;
    const n = this._unchecked.length;
    badge.textContent = String(n);
    badge.classList.toggle('visible', n > 0);
  }

  /**
   * Updates the live category preview chip below the add input (full mode only).
   * @param {string} text
   */
  _updateCatPreview(text) {
    const preview = this.shadowRoot.getElementById('cat-preview');
    if (!preview) return;
    const trimmed = text.trim();
    if (!trimmed) {
      preview.classList.remove('visible');
      preview.innerHTML = '';
      return;
    }
    const catId   = detectCategory(trimmed);
    const colour  = catColour(catId);
    const label   = CAT_LABEL[catId] ?? catId;
    preview.classList.add('visible');
    preview.innerHTML = `
      <span class="cat-preview-label">Category:</span>
      <span class="cat-chip" style="background:${colour}1a; color:${colour};">${escapeHtml(label)}</span>
    `;
  }

  // -------------------------------------------------------------------------
  // Shell event bindings
  // -------------------------------------------------------------------------

  _bindShellEvents() {
    const input  = this.shadowRoot.getElementById('add-input');
    const addBtn = this.shadowRoot.getElementById('add-btn');

    if (!input || !addBtn) return;

    // Live category preview (full mode)
    if (this._isFull) {
      input.addEventListener('input', () => this._updateCatPreview(input.value));
    }

    // Add on Enter
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._handleAdd(input);
      }
    });

    // Add on button click
    addBtn.addEventListener('click', () => this._handleAdd(input));
  }

  /**
   * Reads the input value, triggers add, and clears/resets the input.
   * @param {HTMLInputElement} input
   */
  async _handleAdd(input) {
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }
    input.value = '';

    // Clear category preview
    const preview = this.shadowRoot.getElementById('cat-preview');
    if (preview) {
      preview.classList.remove('visible');
      preview.innerHTML = '';
    }

    await this._addItem(text);
    input.focus();
  }

  /**
   * Scrolls the list area to reveal a newly added item.
   * @param {string} id
   */
  _scrollToNew(id) {
    requestAnimationFrame(() => {
      const area = this.shadowRoot.getElementById('list-area');
      if (!area) return;

      if (this._isFull) {
        // Scroll to bottom — new unchecked items appear at end of their group.
        area.scrollTop = area.scrollHeight;
      } else {
        // In dashboard mode list is sorted oldest-first, so new item is at bottom.
        area.scrollTop = area.scrollHeight;
      }
    });
  }
}

customElements.define('fp-shopping', FpShopping);
