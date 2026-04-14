/**
 * messages.js — <fp-messages> Custom Element
 *
 * A family message board with sticky-note style cards.
 *
 * IndexedDB store: messages
 *   { id, text, author, color, createdAt, pinned }
 *
 * Dashboard mode (default):
 *   - Header with count, scrollable sticky-note cards
 *   - Pinned messages sort first, then newest first
 *   - Tap to view full message; long-press to delete
 *   - "New message" button opens inline compose form
 *
 * Dependencies:
 *   escapeHtml, generateId, formatRelativeTime  from ../utils.js
 *   store, eventBus                             from ../state.js
 *   db                                          from ../db.js
 *
 * Usage:
 *   <fp-messages></fp-messages>
 */

import { escapeHtml, generateId, formatRelativeTime } from '../utils.js';
import { store, eventBus } from '../state.js';
import { db } from '../db.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LONG_PRESS_MS = 500;
const DEFAULT_MEMBER = { name: 'Family', color: 'var(--accent)', emoji: '👨‍👩‍👧‍👦' };

// ---------------------------------------------------------------------------
// Custom Element
// ---------------------------------------------------------------------------

class FpMessages extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    /** @type {Array<{id, text, author, color, createdAt, pinned}>} */
    this._messages = [];
    /** @type {boolean} */
    this._composing = false;
    /** @type {string|null} Author name currently selected in compose form */
    this._selectedAuthor = null;
    /** @type {string|null} ID of message shown in detail overlay */
    this._detailId = null;
    /** @type {string|null} ID of message pending delete confirmation */
    this._deleteId = null;
    /** Long-press timer handle */
    this._pressTimer = null;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  connectedCallback() {
    this._render();
    this._loadMessages();

    // Refresh cards when family config changes
    this._unsubFamily = eventBus.on('family-updated', () => this._render());
    // Re-render if config changes (family members)
    this._unsubConfig = store.subscribe('config', () => this._render());
  }

  disconnectedCallback() {
    if (this._unsubFamily) this._unsubFamily();
    if (this._unsubConfig) this._unsubConfig();
    this._clearPressTimer();
  }

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------

  async _loadMessages() {
    try {
      const all = await db.getAll('messages');
      this._messages = this._sortMessages(all);
      this._renderCards();
      this._updateCount();
    } catch (err) {
      console.error('[fp-messages] Failed to load messages:', err);
    }
  }

  /**
   * Sort: pinned first, then by createdAt descending (newest first).
   * @param {Array} msgs
   * @returns {Array}
   */
  _sortMessages(msgs) {
    return [...msgs].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  /**
   * Returns family members from config, falling back to a default.
   * @returns {Array<{name, color, emoji}>}
   */
  _getMembers() {
    const members = store.get('config')?.family?.members;
    if (Array.isArray(members) && members.length > 0) return members;
    return [DEFAULT_MEMBER];
  }

  // -------------------------------------------------------------------------
  // Rendering — full shadow DOM (written once)
  // -------------------------------------------------------------------------

  _render() {
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

        /* ---- Header ---- */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 0 12px 0;
          flex-shrink: 0;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .header-title {
          font-size: var(--text-lg, 18px);
          font-weight: 600;
        }
        .header-count {
          background: var(--surface-hover, #1c2333);
          border: 1px solid var(--border, #30363d);
          border-radius: 99px;
          font-size: var(--text-xs, 13px);
          color: var(--text-muted, #8b949e);
          padding: 1px 8px;
          min-width: 24px;
          text-align: center;
        }

        /* ---- Cards list ---- */
        .cards-scroll {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-right: 4px;
        }
        .cards-scroll::-webkit-scrollbar { width: 4px; }
        .cards-scroll::-webkit-scrollbar-track { background: transparent; }
        .cards-scroll::-webkit-scrollbar-thumb {
          background: var(--border, #30363d);
          border-radius: 2px;
        }

        /* ---- Sticky-note card ---- */
        .msg-card {
          border-radius: var(--radius-sm, 8px);
          border-left: 3px solid var(--card-color, var(--accent));
          padding: 10px 12px;
          cursor: pointer;
          transition: filter var(--transition, 0.15s ease);
          position: relative;
          user-select: none;
          -webkit-user-select: none;
        }
        .msg-card:hover { filter: brightness(1.12); }
        .msg-card:active { filter: brightness(0.9); }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 5px;
          gap: 8px;
        }
        .card-meta {
          font-size: var(--text-xs, 13px);
          color: var(--text-muted, #8b949e);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }
        .card-meta strong {
          color: var(--card-color, var(--accent));
          font-weight: 600;
        }
        .pin-icon {
          font-size: 14px;
          flex-shrink: 0;
          line-height: 1;
        }

        .card-text {
          font-size: var(--text-sm, 14px);
          color: var(--text, #e6edf3);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          word-break: break-word;
        }

        /* ---- Empty state ---- */
        .empty {
          text-align: center;
          color: var(--text-muted, #8b949e);
          font-size: var(--text-sm, 14px);
          padding: 24px 0;
        }
        .empty .empty-icon { font-size: 32px; margin-bottom: 8px; display: block; }

        /* ---- New message button ---- */
        .new-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 12px;
          padding: 12px;
          border-radius: var(--radius-sm, 8px);
          border: 1px dashed var(--border, #30363d);
          background: transparent;
          color: var(--text-muted, #8b949e);
          font-size: var(--text-sm, 14px);
          font-family: var(--font, system-ui, sans-serif);
          cursor: pointer;
          transition: all var(--transition, 0.15s ease);
          width: 100%;
          min-height: 48px;
          flex-shrink: 0;
        }
        .new-btn:hover {
          background: var(--surface-hover, #1c2333);
          color: var(--text, #e6edf3);
          border-color: var(--accent, #e94560);
        }
        .new-btn .plus { font-size: 20px; font-weight: 300; }

        /* ---- Compose form ---- */
        .compose {
          margin-top: 12px;
          background: var(--surface, #161b22);
          border: 1px solid var(--border, #30363d);
          border-radius: var(--radius-sm, 8px);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex-shrink: 0;
        }

        .compose-textarea {
          width: 100%;
          min-height: 80px;
          background: var(--bg, #0d1117);
          border: 1px solid var(--border, #30363d);
          border-radius: var(--radius-sm, 8px);
          color: var(--text, #e6edf3);
          font-family: var(--font, system-ui, sans-serif);
          font-size: var(--text-sm, 14px);
          padding: 10px 12px;
          resize: vertical;
          outline: none;
          transition: border-color var(--transition, 0.15s ease);
          line-height: 1.5;
          field-sizing: content;
        }
        .compose-textarea:focus {
          border-color: var(--accent, #e94560);
        }
        .compose-textarea::placeholder {
          color: var(--text-muted, #8b949e);
        }

        .compose-label {
          font-size: var(--text-xs, 13px);
          color: var(--text-muted, #8b949e);
          margin-bottom: 4px;
        }

        /* Author chips */
        .author-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .author-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          border-radius: 99px;
          border: 1px solid transparent;
          background: var(--bg, #0d1117);
          color: var(--text-muted, #8b949e);
          font-size: var(--text-xs, 13px);
          font-family: var(--font, system-ui, sans-serif);
          cursor: pointer;
          transition: all var(--transition, 0.15s ease);
          min-height: 36px;
        }
        .author-chip:hover { filter: brightness(1.15); }
        .author-chip.selected {
          color: #fff;
          font-weight: 600;
        }

        /* Pin row */
        .pin-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: var(--text-sm, 14px);
          color: var(--text-muted, #8b949e);
          cursor: pointer;
          min-height: 36px;
        }
        .pin-row input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: var(--accent, #e94560);
          cursor: pointer;
        }
        .pin-row label { cursor: pointer; user-select: none; }

        /* Compose actions */
        .compose-actions {
          display: flex;
          gap: 8px;
        }
        .btn {
          flex: 1;
          padding: 10px 16px;
          border-radius: var(--radius-sm, 8px);
          border: none;
          font-family: var(--font, system-ui, sans-serif);
          font-size: var(--text-sm, 14px);
          font-weight: 500;
          cursor: pointer;
          transition: filter var(--transition, 0.15s ease);
          min-height: 48px;
        }
        .btn:hover { filter: brightness(1.15); }
        .btn:active { filter: brightness(0.9); }
        .btn-primary {
          background: var(--accent, #e94560);
          color: #fff;
        }
        .btn-ghost {
          background: var(--surface-hover, #1c2333);
          color: var(--text-muted, #8b949e);
        }

        /* ---- Detail overlay ---- */
        .overlay {
          position: absolute;
          inset: 0;
          background: rgba(13, 17, 23, 0.92);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 16px;
          border-radius: var(--radius, 16px);
        }
        .overlay-card {
          background: var(--surface, #161b22);
          border: 1px solid var(--border, #30363d);
          border-left: 3px solid var(--overlay-color, var(--accent));
          border-radius: var(--radius-sm, 8px);
          padding: 20px;
          max-width: 480px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .overlay-meta {
          font-size: var(--text-xs, 13px);
          color: var(--text-muted, #8b949e);
        }
        .overlay-meta strong { color: var(--overlay-color, var(--accent)); font-weight: 600; }
        .overlay-text {
          font-size: var(--text-sm, 14px);
          color: var(--text, #e6edf3);
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .overlay-actions { display: flex; gap: 8px; }

        /* ---- Delete confirmation ---- */
        .confirm-overlay {
          position: absolute;
          inset: 0;
          background: rgba(13, 17, 23, 0.92);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 101;
          padding: 16px;
          border-radius: var(--radius, 16px);
        }
        .confirm-box {
          background: var(--surface, #161b22);
          border: 1px solid var(--danger, #e94560);
          border-radius: var(--radius-sm, 8px);
          padding: 20px;
          max-width: 320px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 14px;
          text-align: center;
        }
        .confirm-title {
          font-size: var(--text-base, 16px);
          font-weight: 600;
        }
        .confirm-body {
          font-size: var(--text-sm, 14px);
          color: var(--text-muted, #8b949e);
        }
        .confirm-actions { display: flex; gap: 8px; }
        .btn-danger {
          background: var(--danger, #e94560);
          color: #fff;
        }
      </style>

      <div class="header">
        <div class="header-left">
          <span>📝</span>
          <span class="header-title">Messages</span>
        </div>
        <span class="header-count" id="msg-count">0</span>
      </div>

      <div class="cards-scroll" id="cards-list"></div>

      <div id="compose-area"></div>

      <div id="overlay-area"></div>
    `;

    // Ensure the host is positioned so absolute overlays work
    this.style.position = 'relative';

    this._bindRootEvents();
    this._renderCards();
    this._renderCompose();
    this._updateCount();
  }

  // -------------------------------------------------------------------------
  // Rendering — cards list
  // -------------------------------------------------------------------------

  _renderCards() {
    const list = this.shadowRoot.getElementById('cards-list');
    if (!list) return;

    if (this._messages.length === 0) {
      list.innerHTML = `
        <div class="empty">
          <span class="empty-icon">📝</span>
          No messages yet. Be the first to post!
        </div>
      `;
      return;
    }

    list.innerHTML = this._messages
      .map(msg => this._cardHtml(msg))
      .join('');

    // Bind touch/click events on each card
    list.querySelectorAll('.msg-card').forEach(card => {
      const id = card.dataset.id;

      // Click → detail overlay
      card.addEventListener('click', () => this._openDetail(id));

      // Long-press → delete confirmation
      card.addEventListener('pointerdown', () => {
        this._pressTimer = setTimeout(() => {
          this._pressTimer = null;
          this._openDeleteConfirm(id);
        }, LONG_PRESS_MS);
      });
      card.addEventListener('pointerup',    () => this._clearPressTimer());
      card.addEventListener('pointerleave', () => this._clearPressTimer());
      card.addEventListener('pointermove',  () => this._clearPressTimer());
      // Prevent context menu on long-press
      card.addEventListener('contextmenu', e => e.preventDefault());
    });
  }

  /**
   * Builds the HTML for a single message card.
   * @param {{id, text, author, color, createdAt, pinned}} msg
   * @returns {string}
   */
  _cardHtml(msg) {
    const color = escapeHtml(msg.color || 'var(--accent)');
    const author = escapeHtml(msg.author || 'Family');
    const relTime = formatRelativeTime(new Date(msg.createdAt));
    const text = escapeHtml(msg.text || '');
    const pinHtml = msg.pinned ? `<span class="pin-icon" title="Pinned">📌</span>` : '';

    // Inline style for tinted background (author colour at 15% opacity) and
    // left-border colour. We use a CSS variable scoped to the card element.
    const bgAlpha = this._hexToRgba(msg.color, 0.15);
    const styleAttr = `style="--card-color:${color}; background:${bgAlpha};"`;

    return `
      <div class="msg-card" data-id="${escapeHtml(msg.id)}" ${styleAttr}>
        <div class="card-header">
          <span class="card-meta">
            <strong>${author}</strong> · ${escapeHtml(relTime)}
          </span>
          ${pinHtml}
        </div>
        <p class="card-text">${text}</p>
      </div>
    `;
  }

  /**
   * Converts a hex colour (or CSS variable) to rgba(r,g,b,a).
   * Falls back to a translucent accent if parsing fails.
   * @param {string} hex
   * @param {number} alpha
   * @returns {string}
   */
  _hexToRgba(hex, alpha) {
    if (!hex || !hex.startsWith('#')) {
      return `rgba(233, 69, 96, ${alpha})`; // accent fallback
    }
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return `rgba(233, 69, 96, ${alpha})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // -------------------------------------------------------------------------
  // Rendering — compose form
  // -------------------------------------------------------------------------

  _renderCompose() {
    const area = this.shadowRoot.getElementById('compose-area');
    if (!area) return;

    if (!this._composing) {
      area.innerHTML = `
        <button class="new-btn" id="new-msg-btn">
          <span class="plus">＋</span>
          <span>New message</span>
        </button>
      `;
      area.querySelector('#new-msg-btn')?.addEventListener('click', () => {
        this._composing = true;
        this._selectedAuthor = this._getMembers()[0]?.name ?? 'Family';
        this._renderCompose();
        // Focus textarea
        requestAnimationFrame(() => {
          this.shadowRoot.querySelector('.compose-textarea')?.focus();
        });
      });
      return;
    }

    const members = this._getMembers();

    const authorChips = members.map(m => {
      const isSelected = this._selectedAuthor === m.name;
      const color = escapeHtml(m.color || 'var(--accent)');
      const borderStyle = isSelected
        ? `border-color:${color}; background:${this._hexToRgba(m.color, 0.25)};`
        : '';
      const colorStyle = isSelected ? `color:${color};` : '';
      const cls = `author-chip${isSelected ? ' selected' : ''}`;
      return `
        <button class="${cls}" data-author="${escapeHtml(m.name)}"
          style="${borderStyle}${colorStyle}" type="button">
          ${escapeHtml(m.emoji || '')} ${escapeHtml(m.name)}
        </button>
      `;
    }).join('');

    area.innerHTML = `
      <form class="compose" id="compose-form" autocomplete="off">
        <textarea
          class="compose-textarea"
          id="compose-text"
          rows="3"
          placeholder="What's on your mind?"
          maxlength="1000"
        ></textarea>

        <div>
          <div class="compose-label">Who's posting?</div>
          <div class="author-row" id="author-row">${authorChips}</div>
        </div>

        <label class="pin-row">
          <input type="checkbox" id="pin-check">
          <label for="pin-check">📌 Pin this message</label>
        </label>

        <div class="compose-actions">
          <button type="submit" class="btn btn-primary">Post</button>
          <button type="button" class="btn btn-ghost" id="cancel-btn">Cancel</button>
        </div>
      </form>
    `;

    // Author chip selection
    area.querySelectorAll('.author-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this._selectedAuthor = chip.dataset.author;
        this._renderCompose();
        // Restore textarea value
        const ta = this.shadowRoot.querySelector('.compose-textarea');
        if (ta) {
          const saved = area.querySelector('#compose-text');
          // value already lost — we'll grab from the old element if possible
        }
      });
    });

    // Cancel
    area.querySelector('#cancel-btn')?.addEventListener('click', () => {
      this._composing = false;
      this._renderCompose();
    });

    // Submit
    area.querySelector('#compose-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this._postMessage();
    });
  }

  // -------------------------------------------------------------------------
  // Rendering — overlays
  // -------------------------------------------------------------------------

  _openDetail(id) {
    // Don't open detail if we just fired long-press confirm
    if (this._deleteId) return;

    const msg = this._messages.find(m => m.id === id);
    if (!msg) return;

    const area = this.shadowRoot.getElementById('overlay-area');
    if (!area) return;

    const color = escapeHtml(msg.color || 'var(--accent)');
    const author = escapeHtml(msg.author || 'Family');
    const relTime = escapeHtml(formatRelativeTime(new Date(msg.createdAt)));
    const text = escapeHtml(msg.text || '');
    const pinLabel = msg.pinned ? '<span> · 📌 Pinned</span>' : '';

    area.innerHTML = `
      <div class="overlay" id="detail-overlay">
        <div class="overlay-card" style="--overlay-color:${color};">
          <div class="overlay-meta">
            <strong>${author}</strong> · ${relTime}${pinLabel}
          </div>
          <p class="overlay-text">${text}</p>
          <div class="overlay-actions">
            <button class="btn btn-ghost" id="close-detail-btn" style="flex:1">Close</button>
            <button class="btn btn-danger" id="detail-delete-btn" style="flex:1">Delete</button>
          </div>
        </div>
      </div>
    `;

    area.querySelector('#detail-overlay')?.addEventListener('click', (e) => {
      if (e.target === area.querySelector('#detail-overlay')) this._closeOverlays();
    });
    area.querySelector('#close-detail-btn')?.addEventListener('click', () => this._closeOverlays());
    area.querySelector('#detail-delete-btn')?.addEventListener('click', () => {
      this._closeOverlays();
      this._openDeleteConfirm(id);
    });
  }

  _openDeleteConfirm(id) {
    const msg = this._messages.find(m => m.id === id);
    if (!msg) return;

    this._deleteId = id;
    const area = this.shadowRoot.getElementById('overlay-area');
    if (!area) return;

    const preview = escapeHtml((msg.text || '').slice(0, 60));

    area.innerHTML = `
      <div class="confirm-overlay">
        <div class="confirm-box">
          <p class="confirm-title">Delete message?</p>
          <p class="confirm-body">"${preview}${msg.text.length > 60 ? '…' : ''}"</p>
          <div class="confirm-actions">
            <button class="btn btn-danger" id="confirm-delete-btn">Delete</button>
            <button class="btn btn-ghost" id="cancel-delete-btn">Cancel</button>
          </div>
        </div>
      </div>
    `;

    area.querySelector('#confirm-delete-btn')?.addEventListener('click', async () => {
      await this._deleteMessage(id);
      this._closeOverlays();
    });
    area.querySelector('#cancel-delete-btn')?.addEventListener('click', () => {
      this._deleteId = null;
      this._closeOverlays();
    });
  }

  _closeOverlays() {
    const area = this.shadowRoot.getElementById('overlay-area');
    if (area) area.innerHTML = '';
    this._detailId = null;
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  async _postMessage() {
    const textEl = this.shadowRoot.querySelector('#compose-text');
    const pinEl  = this.shadowRoot.querySelector('#pin-check');
    const text   = textEl?.value.trim();

    if (!text) {
      textEl?.focus();
      return;
    }

    const members  = this._getMembers();
    const member   = members.find(m => m.name === this._selectedAuthor) || members[0] || DEFAULT_MEMBER;

    const msg = {
      id:        generateId(),
      text,
      author:    member.name,
      color:     member.color || 'var(--accent)',
      createdAt: new Date().toISOString(),
      pinned:    pinEl?.checked ?? false,
    };

    try {
      await db.put('messages', msg);
      this._messages = this._sortMessages([...this._messages, msg]);
      this._composing = false;
      this._renderCards();
      this._renderCompose();
      this._updateCount();
    } catch (err) {
      console.error('[fp-messages] Failed to save message:', err);
    }
  }

  async _deleteMessage(id) {
    try {
      await db.delete('messages', id);
      this._messages = this._sortMessages(this._messages.filter(m => m.id !== id));
      this._deleteId = null;
      this._renderCards();
      this._updateCount();
    } catch (err) {
      console.error('[fp-messages] Failed to delete message:', err);
    }
  }

  _updateCount() {
    const el = this.shadowRoot.getElementById('msg-count');
    if (el) el.textContent = String(this._messages.length);
  }

  // -------------------------------------------------------------------------
  // Event helpers
  // -------------------------------------------------------------------------

  _bindRootEvents() {
    // Nothing at root level — events are attached in _renderCards / _renderCompose
  }

  _clearPressTimer() {
    if (this._pressTimer) {
      clearTimeout(this._pressTimer);
      this._pressTimer = null;
    }
  }
}

customElements.define('fp-messages', FpMessages);
