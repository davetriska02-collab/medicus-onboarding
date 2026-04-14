/**
 * settings.js — <fp-settings> Custom Element
 * Configuration panel for family members, API keys, display prefs, and data management.
 */

import { escapeHtml, generateId } from '../utils.js';
import { store, eventBus } from '../state.js';
import { db } from '../db.js';

const FAMILY_COLORS = ['#58a6ff','#f78166','#a371f7','#2dc653','#f4d03f','#ff9bce'];
const FAMILY_EMOJIS = ['👩','👨','👦','👧','👶','🧑','👴','👵','🐕','🐈','🌟','🏠'];

const STYLES = `
  :host { display: block; width: 100%; height: 100%; font-family: var(--font, system-ui, sans-serif); color: var(--text, #e6edf3); overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 16px; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  h2 { font-size: var(--text-2xl, 24px); font-weight: 600; margin-bottom: 20px; }
  details { background: var(--surface, #161b22); border: 1px solid var(--border, #30363d); border-radius: var(--radius, 16px); margin-bottom: 12px; overflow: hidden; }
  summary { padding: 16px 20px; font-size: var(--text-lg, 18px); font-weight: 600; cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; min-height: 56px; user-select: none; -webkit-user-select: none; }
  summary::-webkit-details-marker { display: none; }
  summary::after { content: '▸'; transition: transform 0.2s; font-size: 14px; color: var(--text-muted, #8b949e); }
  details[open] summary::after { transform: rotate(90deg); }
  .section { padding: 0 20px 20px; }
  .row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border, #30363d); min-height: 48px; }
  .row:last-child { border-bottom: none; }
  .row-info { flex: 1; min-width: 0; }
  .row-label { font-weight: 500; }
  .row-meta { font-size: var(--text-xs, 13px); color: var(--text-muted, #8b949e); }
  .dot { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; }
  .emoji { font-size: 24px; }

  label { display: block; font-size: var(--text-sm, 14px); color: var(--text-muted, #8b949e); margin-bottom: 4px; margin-top: 14px; }
  label:first-child { margin-top: 0; }
  input[type="text"], input[type="password"], input[type="number"], input[type="url"] {
    width: 100%; padding: 10px 14px; background: var(--bg, #0d1117);
    border: 1px solid var(--border, #30363d); border-radius: var(--radius-sm, 8px);
    color: var(--text, #e6edf3); font-size: var(--text-base, 16px); min-height: 48px;
    font-family: inherit;
  }
  input:focus { outline: none; border-color: var(--accent, #e94560); }
  input::placeholder { color: var(--text-muted, #8b949e); }

  .btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 20px; border-radius: var(--radius-sm, 8px); font-size: var(--text-base, 16px); font-weight: 500; cursor: pointer; min-height: 48px; border: none; transition: all var(--transition, 0.15s ease); font-family: inherit; }
  .btn-primary { background: var(--accent, #e94560); color: #fff; }
  .btn-primary:active { transform: scale(0.97); }
  .btn-secondary { background: var(--surface-hover, #1c2333); color: var(--text, #e6edf3); }
  .btn-danger { background: rgba(233,69,96,0.15); color: var(--danger, #e94560); }
  .btn-sm { padding: 6px 14px; font-size: var(--text-sm, 14px); min-height: 36px; }
  .btn-block { width: 100%; margin-top: 12px; }

  .color-picker { display: flex; gap: 8px; margin-top: 6px; }
  .color-opt { width: 36px; height: 36px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; transition: border-color 0.15s; }
  .color-opt.sel { border-color: #fff; }
  .emoji-picker { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .emoji-opt { width: 40px; height: 40px; border-radius: var(--radius-sm, 8px); display: flex; align-items: center; justify-content: center; font-size: 22px; cursor: pointer; border: 2px solid transparent; background: var(--bg, #0d1117); transition: border-color 0.15s; }
  .emoji-opt.sel { border-color: var(--accent, #e94560); }

  .form { background: var(--surface-hover, #1c2333); border-radius: var(--radius-sm, 8px); padding: 16px; margin-top: 12px; }
  .form-actions { display: flex; gap: 8px; margin-top: 16px; }

  .toggle-group { display: flex; gap: 4px; margin-top: 6px; }
  .toggle-btn { padding: 8px 16px; border-radius: 20px; font-size: var(--text-sm, 14px); cursor: pointer; border: 1px solid var(--border, #30363d); background: transparent; color: var(--text-muted, #8b949e); min-height: 40px; transition: all 0.15s; font-family: inherit; }
  .toggle-btn.sel { background: var(--accent, #e94560); color: #fff; border-color: var(--accent, #e94560); }

  .cal-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border, #30363d); }
  .cal-info { flex: 1; min-width: 0; }
  .cal-name { font-weight: 500; }
  .cal-url { font-size: var(--text-xs, 13px); color: var(--text-muted, #8b949e); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .danger-zone { margin-top: 24px; padding: 16px; border: 1px solid var(--danger, #e94560); border-radius: var(--radius, 16px); }
  .danger-title { color: var(--danger, #e94560); font-weight: 600; margin-bottom: 8px; }
`;

class FpSettings extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._showMemberForm = false;
    this._editMemberIdx = -1;
    this._showCalForm = false;
    this._editCalIdx = -1;
  }

  connectedCallback() {
    this._render();
  }

  _getConfig() {
    return store.get('config') || {};
  }

  _setConfig(config) {
    store.set('config', config);
    eventBus.emit('config-updated', config);
  }

  _render() {
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><div id="root"></div>`;
    this._renderContent();
  }

  _renderContent() {
    const root = this.shadowRoot.getElementById('root');
    if (!root) return;
    const config = this._getConfig();

    root.innerHTML = `
      <h2>Settings</h2>
      ${this._familySection(config)}
      ${this._weatherSection(config)}
      ${this._trainsSection(config)}
      ${this._calendarsSection(config)}
      ${this._displaySection(config)}
      ${this._dataSection()}
    `;
    this._bindAll(root);
  }

  /* ================================================================ */
  /* Family Members                                                    */
  /* ================================================================ */

  _familySection(config) {
    const members = config?.family?.members || [];
    const rows = members.map((m, i) => `
      <div class="row">
        <span class="dot" style="background:${m.color}"></span>
        <span class="emoji">${m.emoji || '👤'}</span>
        <div class="row-info"><span class="row-label">${escapeHtml(m.name)}</span></div>
        <button class="btn btn-secondary btn-sm" data-action="edit-member" data-idx="${i}">Edit</button>
        <button class="btn btn-danger btn-sm" data-action="delete-member" data-idx="${i}">×</button>
      </div>
    `).join('');

    const form = this._showMemberForm ? this._memberForm(config) : '';
    const addBtn = this._showMemberForm ? '' : `<button class="btn btn-primary btn-block" data-action="show-member-form">+ Add Family Member</button>`;

    return `<details open><summary>👨‍👩‍👧‍👦 Family Members</summary><div class="section">${rows}${addBtn}${form}</div></details>`;
  }

  _memberForm(config) {
    const members = config?.family?.members || [];
    const editing = this._editMemberIdx >= 0 ? members[this._editMemberIdx] : null;
    const name = editing?.name || '';
    const color = editing?.color || FAMILY_COLORS[members.length % FAMILY_COLORS.length];
    const emoji = editing?.emoji || '';

    return `<div class="form" id="member-form">
      <label>Name</label>
      <input type="text" id="mf-name" value="${escapeHtml(name)}" placeholder="e.g. Mum, Dad, Olivia..." />
      <label>Colour</label>
      <div class="color-picker">
        ${FAMILY_COLORS.map(c => `<div class="color-opt ${c===color?'sel':''}" data-color="${c}" style="background:${c}"></div>`).join('')}
      </div>
      <label>Emoji</label>
      <div class="emoji-picker">
        ${FAMILY_EMOJIS.map(e => `<div class="emoji-opt ${e===emoji?'sel':''}" data-emoji="${e}">${e}</div>`).join('')}
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" data-action="save-member">${editing ? 'Update' : 'Add'}</button>
        <button class="btn btn-secondary" data-action="cancel-member">Cancel</button>
      </div>
    </div>`;
  }

  /* ================================================================ */
  /* Weather                                                           */
  /* ================================================================ */

  _weatherSection(config) {
    const w = config?.weather || {};
    return `<details><summary>🌤️ Weather</summary><div class="section">
      <label>OpenWeatherMap API Key</label>
      <input type="password" id="w-key" value="${escapeHtml(w.apiKey || '')}" placeholder="Your API key" />
      <label>Latitude</label>
      <input type="text" id="w-lat" value="${w.lat ?? 51.1284}" placeholder="51.1284" />
      <label>Longitude</label>
      <input type="text" id="w-lon" value="${w.lon ?? -0.6505}" placeholder="-0.6505" />
      <button class="btn btn-primary btn-block" data-action="save-weather">Save Weather Settings</button>
    </div></details>`;
  }

  /* ================================================================ */
  /* Trains                                                            */
  /* ================================================================ */

  _trainsSection(config) {
    const t = config?.trains || {};
    return `<details><summary>🚂 Trains</summary><div class="section">
      <label>Realtime Trains Username</label>
      <input type="text" id="t-user" value="${escapeHtml(t.username || '')}" placeholder="RTT username" />
      <label>Realtime Trains Password</label>
      <input type="password" id="t-pass" value="${escapeHtml(t.password || '')}" placeholder="RTT password" />
      <label>Station Code</label>
      <input type="text" id="t-station" value="${escapeHtml(t.station || 'WIT')}" placeholder="e.g. WIT" />
      <button class="btn btn-primary btn-block" data-action="save-trains">Save Train Settings</button>
    </div></details>`;
  }

  /* ================================================================ */
  /* Calendars                                                         */
  /* ================================================================ */

  _calendarsSection(config) {
    const cals = config?.calendars || [];
    const rows = cals.map((c, i) => `
      <div class="cal-row">
        <span class="dot" style="background:${c.color || '#58a6ff'}"></span>
        <div class="cal-info">
          <div class="cal-name">${escapeHtml(c.name)}</div>
          <div class="cal-url">${escapeHtml(c.url)}</div>
        </div>
        <button class="btn btn-danger btn-sm" data-action="delete-cal" data-idx="${i}">×</button>
      </div>
    `).join('');

    const form = this._showCalForm ? this._calForm(config) : '';
    const addBtn = this._showCalForm ? '' : `<button class="btn btn-primary btn-block" data-action="show-cal-form">+ Add Calendar</button>`;

    return `<details><summary>📅 Calendars</summary><div class="section">${rows}${addBtn}${form}</div></details>`;
  }

  _calForm(config) {
    const cals = config?.calendars || [];
    const editing = this._editCalIdx >= 0 ? cals[this._editCalIdx] : null;
    const name = editing?.name || '';
    const url = editing?.url || '';
    const color = editing?.color || '#58a6ff';

    return `<div class="form" id="cal-form">
      <label>Calendar Name</label>
      <input type="text" id="cf-name" value="${escapeHtml(name)}" placeholder="e.g. Family, Work, School" />
      <label>ICS Feed URL</label>
      <input type="url" id="cf-url" value="${escapeHtml(url)}" placeholder="https://calendar.google.com/.../basic.ics" />
      <label>Colour</label>
      <div class="color-picker">
        ${FAMILY_COLORS.map(c => `<div class="color-opt ${c===color?'sel':''}" data-calcolor="${c}" style="background:${c}"></div>`).join('')}
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" data-action="save-cal">${editing ? 'Update' : 'Add'}</button>
        <button class="btn btn-secondary" data-action="cancel-cal">Cancel</button>
      </div>
    </div>`;
  }

  /* ================================================================ */
  /* Display                                                           */
  /* ================================================================ */

  _displaySection(config) {
    const d = config?.display || {};
    const fmt = d.clockFormat || '24h';
    const timeout = d.screensaverTimeout ?? 5;

    return `<details><summary>🖥️ Display</summary><div class="section">
      <label>Clock Format</label>
      <div class="toggle-group">
        <button class="toggle-btn ${fmt==='24h'?'sel':''}" data-action="set-clock" data-val="24h">24h</button>
        <button class="toggle-btn ${fmt==='12h'?'sel':''}" data-action="set-clock" data-val="12h">12h</button>
      </div>
      <label>Screensaver Timeout (minutes)</label>
      <input type="number" id="d-timeout" value="${timeout}" min="1" max="60" />
      <button class="btn btn-secondary btn-block" data-action="save-display">Save Display Settings</button>
      <button class="btn btn-secondary btn-block" data-action="fullscreen" style="margin-top:8px">⛶ Toggle Fullscreen</button>
    </div></details>`;
  }

  /* ================================================================ */
  /* Data                                                              */
  /* ================================================================ */

  _dataSection() {
    return `<details><summary>💾 Data</summary><div class="section">
      <button class="btn btn-secondary btn-block" data-action="export">Export All Data</button>
      <label style="margin-top:12px">Import Data</label>
      <input type="file" id="import-file" accept=".json" style="margin-top:6px" />
      <div class="danger-zone">
        <div class="danger-title">Danger Zone</div>
        <button class="btn btn-danger btn-block" data-action="clear-all">Clear All Data</button>
      </div>
    </div></details>`;
  }

  /* ================================================================ */
  /* Event binding                                                     */
  /* ================================================================ */

  _bindAll(root) {
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) {
        // Color picker
        const colorOpt = e.target.closest('[data-color]');
        if (colorOpt) {
          colorOpt.closest('.color-picker').querySelectorAll('.color-opt').forEach(o => o.classList.remove('sel'));
          colorOpt.classList.add('sel');
          return;
        }
        const calcolor = e.target.closest('[data-calcolor]');
        if (calcolor) {
          calcolor.closest('.color-picker').querySelectorAll('.color-opt').forEach(o => o.classList.remove('sel'));
          calcolor.classList.add('sel');
          return;
        }
        // Emoji picker
        const emojiOpt = e.target.closest('[data-emoji]');
        if (emojiOpt) {
          emojiOpt.closest('.emoji-picker').querySelectorAll('.emoji-opt').forEach(o => o.classList.remove('sel'));
          emojiOpt.classList.add('sel');
          return;
        }
        return;
      }

      const action = btn.dataset.action;
      await this._handleAction(action, btn, root);
    });

    // File import
    const fileInput = root.querySelector('#import-file');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this._handleImport(e));
    }
  }

  async _handleAction(action, btn, root) {
    const config = this._getConfig();

    switch (action) {
      /* ---- Family ---- */
      case 'show-member-form':
        this._showMemberForm = true; this._editMemberIdx = -1; this._renderContent(); break;
      case 'cancel-member':
        this._showMemberForm = false; this._editMemberIdx = -1; this._renderContent(); break;
      case 'edit-member':
        this._showMemberForm = true; this._editMemberIdx = parseInt(btn.dataset.idx); this._renderContent(); break;
      case 'delete-member': {
        const idx = parseInt(btn.dataset.idx);
        if (!config.family) config.family = { members: [] };
        config.family.members.splice(idx, 1);
        this._setConfig(config);
        eventBus.emit('family-updated');
        this._renderContent();
        break;
      }
      case 'save-member': {
        const name = root.querySelector('#mf-name')?.value?.trim();
        if (!name) return;
        const color = root.querySelector('.color-opt.sel')?.dataset?.color || FAMILY_COLORS[0];
        const emoji = root.querySelector('.emoji-opt.sel')?.dataset?.emoji || '👤';
        if (!config.family) config.family = { members: [] };
        if (this._editMemberIdx >= 0) {
          config.family.members[this._editMemberIdx] = { name, color, emoji };
        } else {
          config.family.members.push({ name, color, emoji });
        }
        this._setConfig(config);
        eventBus.emit('family-updated');
        this._showMemberForm = false; this._editMemberIdx = -1;
        this._renderContent();
        break;
      }

      /* ---- Weather ---- */
      case 'save-weather': {
        if (!config.weather) config.weather = {};
        config.weather.apiKey = root.querySelector('#w-key')?.value?.trim() || '';
        config.weather.lat = parseFloat(root.querySelector('#w-lat')?.value) || 51.1284;
        config.weather.lon = parseFloat(root.querySelector('#w-lon')?.value) || -0.6505;
        config.weather.units = 'metric';
        this._setConfig(config);
        this._renderContent();
        break;
      }

      /* ---- Trains ---- */
      case 'save-trains': {
        if (!config.trains) config.trains = {};
        config.trains.username = root.querySelector('#t-user')?.value?.trim() || '';
        config.trains.password = root.querySelector('#t-pass')?.value?.trim() || '';
        config.trains.station = root.querySelector('#t-station')?.value?.trim().toUpperCase() || 'WIT';
        this._setConfig(config);
        this._renderContent();
        break;
      }

      /* ---- Calendars ---- */
      case 'show-cal-form':
        this._showCalForm = true; this._editCalIdx = -1; this._renderContent(); break;
      case 'cancel-cal':
        this._showCalForm = false; this._editCalIdx = -1; this._renderContent(); break;
      case 'delete-cal': {
        const idx = parseInt(btn.dataset.idx);
        if (!config.calendars) config.calendars = [];
        config.calendars.splice(idx, 1);
        this._setConfig(config);
        this._renderContent();
        break;
      }
      case 'save-cal': {
        const name = root.querySelector('#cf-name')?.value?.trim();
        const url = root.querySelector('#cf-url')?.value?.trim();
        if (!name || !url) return;
        const color = root.querySelector('[data-calcolor].sel')?.dataset?.calcolor || '#58a6ff';
        if (!config.calendars) config.calendars = [];
        if (this._editCalIdx >= 0) {
          config.calendars[this._editCalIdx] = { name, url, color };
        } else {
          config.calendars.push({ name, url, color });
        }
        this._setConfig(config);
        this._showCalForm = false; this._editCalIdx = -1;
        this._renderContent();
        break;
      }

      /* ---- Display ---- */
      case 'set-clock': {
        if (!config.display) config.display = {};
        config.display.clockFormat = btn.dataset.val;
        this._setConfig(config);
        store.set('clockFormat', btn.dataset.val);
        this._renderContent();
        break;
      }
      case 'save-display': {
        if (!config.display) config.display = {};
        config.display.screensaverTimeout = parseInt(root.querySelector('#d-timeout')?.value) || 5;
        this._setConfig(config);
        store.set('screensaverTimeout', config.display.screensaverTimeout);
        this._renderContent();
        break;
      }
      case 'fullscreen':
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          document.documentElement.requestFullscreen().catch(() => {});
        }
        break;

      /* ---- Data ---- */
      case 'export':
        await this._handleExport();
        break;
      case 'clear-all':
        if (confirm('This will delete ALL data including chores, shopping lists, messages, and settings. Are you sure?')) {
          await this._clearAll();
        }
        break;
    }
  }

  async _handleExport() {
    try {
      const data = {
        config: this._getConfig(),
        chore_definitions: await db.getAll('chore_definitions'),
        chore_completions: await db.getAll('chore_completions'),
        shopping_items: await db.getAll('shopping_items'),
        messages: await db.getAll('messages'),
        family_members: await db.getAll('family_members'),
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-planner-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Settings] Export failed:', err);
    }
  }

  async _handleImport(e) {
    const file = e.target?.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.config) this._setConfig(data.config);
      const stores = ['chore_definitions','chore_completions','shopping_items','messages','family_members'];
      for (const s of stores) {
        if (Array.isArray(data[s])) {
          for (const item of data[s]) {
            await db.put(s, item);
          }
        }
      }
      eventBus.emit('family-updated');
      eventBus.emit('chores-changed');
      this._renderContent();
    } catch (err) {
      console.error('[Settings] Import failed:', err);
    }
  }

  async _clearAll() {
    const stores = ['chore_definitions','chore_completions','shopping_items','messages','family_members','calendar_events'];
    for (const s of stores) {
      try { await db.clear(s); } catch { /* ok */ }
    }
    localStorage.removeItem('fp_state');
    store.set('config', {});
    eventBus.emit('family-updated');
    eventBus.emit('chores-changed');
    this._renderContent();
  }
}

customElements.define('fp-settings', FpSettings);
