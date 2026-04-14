/**
 * chores.js — <fp-chores> Custom Element
 * Daily chore tracker with assignment, completion, and points leaderboard.
 */

import { escapeHtml, generateId, getToday, getDayName } from '../utils.js';
import { store, eventBus } from '../state.js';
import { db } from '../db.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isTodayChore(chore) {
  const today = getDayName(new Date()).toLowerCase();
  const dayNum = new Date().getDay();
  if (chore.frequency === 'daily') return true;
  if (chore.frequency === 'weekdays') return dayNum >= 1 && dayNum <= 5;
  if (chore.frequency === 'weekly' || chore.frequency === 'specific') {
    return chore.days?.map(d => d.toLowerCase()).includes(today);
  }
  return false;
}

function getMemberColor(name) {
  const members = store.get('config')?.family?.members || [];
  const m = members.find(m => m.name === name);
  if (m) return m.color;
  const colors = ['#58a6ff','#f78166','#a371f7','#2dc653','#f4d03f','#ff9bce'];
  let h = 0;
  for (let i = 0; i < (name||'').length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
}

function getMembers() {
  return store.get('config')?.family?.members || [];
}

function startOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const STYLES = `
  :host { display: flex; flex-direction: column; width: 100%; height: 100%; font-family: var(--font, system-ui, sans-serif); color: var(--text, #e6edf3); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-shrink: 0; }
  .title { font-size: var(--text-lg, 18px); font-weight: 600; }
  .count { font-size: var(--text-sm, 14px); color: var(--text-muted, #8b949e); }
  .list { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .chore-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--radius-sm, 8px); min-height: 56px; cursor: pointer; transition: background var(--transition, 0.15s ease); user-select: none; -webkit-user-select: none; }
  .chore-row:active { background: var(--surface-hover, #1c2333); }
  .dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
  .chore-info { flex: 1; min-width: 0; }
  .chore-title { font-size: var(--text-base, 16px); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chore-title.done { text-decoration: line-through; opacity: 0.5; }
  .chore-assign { font-size: var(--text-xs, 13px); color: var(--text-muted, #8b949e); }
  .points { font-size: var(--text-xs, 13px); padding: 2px 8px; border-radius: 12px; background: rgba(244,208,63,0.15); color: var(--warning, #f4d03f); white-space: nowrap; }
  .check { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--border, #30363d); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s ease; font-size: 18px; }
  .check.done { background: var(--success, #2dc653); border-color: var(--success, #2dc653); color: #fff; }
  .check.pop { animation: pop 0.3s ease; }
  @keyframes pop { 0% { transform: scale(1); } 50% { transform: scale(1.3); } 100% { transform: scale(1); } }
  .empty { text-align: center; color: var(--text-muted, #8b949e); padding: 32px 16px; font-size: var(--text-sm, 14px); }

  /* Tabs (full mode) */
  .tabs { display: flex; gap: 4px; margin-bottom: 16px; flex-shrink: 0; }
  .tab { flex: 1; padding: 10px; text-align: center; border-radius: var(--radius-sm, 8px); font-size: var(--text-sm, 14px); font-weight: 500; cursor: pointer; background: transparent; color: var(--text-muted, #8b949e); border: 1px solid var(--border, #30363d); transition: all var(--transition, 0.15s ease); min-height: 48px; }
  .tab.active { background: var(--accent, #e94560); color: #fff; border-color: var(--accent, #e94560); }

  /* Manage form */
  .form { padding: 16px; background: var(--surface-hover, #1c2333); border-radius: var(--radius-sm, 8px); margin-top: 12px; }
  .form label { display: block; font-size: var(--text-sm, 14px); color: var(--text-muted, #8b949e); margin-bottom: 4px; margin-top: 12px; }
  .form label:first-child { margin-top: 0; }
  .form input[type="text"], .form input[type="number"] { width: 100%; padding: 10px 14px; background: var(--bg, #0d1117); border: 1px solid var(--border, #30363d); border-radius: var(--radius-sm, 8px); color: var(--text, #e6edf3); font-size: var(--text-base, 16px); min-height: 48px; }
  .form input:focus { outline: none; border-color: var(--accent, #e94560); }
  .freq-btns, .day-btns, .member-btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .freq-btn, .day-btn, .member-btn { padding: 8px 14px; border-radius: 20px; font-size: var(--text-sm, 14px); cursor: pointer; border: 1px solid var(--border, #30363d); background: transparent; color: var(--text-muted, #8b949e); min-height: 40px; transition: all var(--transition, 0.15s ease); }
  .freq-btn.sel, .day-btn.sel, .member-btn.sel { background: var(--accent, #e94560); color: #fff; border-color: var(--accent, #e94560); }
  .form-actions { display: flex; gap: 8px; margin-top: 16px; }
  .btn { padding: 10px 20px; border-radius: var(--radius-sm, 8px); font-size: var(--text-base, 16px); font-weight: 500; cursor: pointer; min-height: 48px; border: none; transition: all var(--transition, 0.15s ease); }
  .btn-primary { background: var(--accent, #e94560); color: #fff; }
  .btn-secondary { background: var(--surface-hover, #1c2333); color: var(--text, #e6edf3); }
  .btn-danger { background: rgba(233,69,96,0.15); color: var(--danger, #e94560); }
  .btn-sm { padding: 6px 12px; font-size: var(--text-sm, 14px); min-height: 36px; }

  /* Manage list */
  .manage-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--border, #30363d); min-height: 56px; }
  .manage-info { flex: 1; }
  .manage-title { font-weight: 500; }
  .manage-meta { font-size: var(--text-xs, 13px); color: var(--text-muted, #8b949e); }
  .manage-actions { display: flex; gap: 6px; }

  /* Leaderboard */
  .lb-row { display: flex; align-items: center; gap: 12px; padding: 12px; }
  .lb-emoji { font-size: 28px; }
  .lb-info { flex: 1; }
  .lb-name { font-weight: 500; }
  .lb-bar-wrap { height: 8px; background: var(--border, #30363d); border-radius: 4px; margin-top: 4px; }
  .lb-bar { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
  .lb-pts { font-size: var(--text-lg, 18px); font-weight: 600; min-width: 50px; text-align: right; }
  .lb-trophy { font-size: 20px; }
`;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

class FpChores extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._defs = [];
    this._completions = [];
    this._tab = 'today';
    this._showForm = false;
    this._editId = null;
  }

  connectedCallback() {
    this._mode = this.getAttribute('mode') || 'default';
    this._renderShell();
    this._load();
    this._unsub = eventBus.on('family-updated', () => this._renderContent());
    this._unsub2 = eventBus.on('chores-changed', () => this._load());
  }

  disconnectedCallback() {
    if (this._unsub) this._unsub();
    if (this._unsub2) this._unsub2();
  }

  async _load() {
    try {
      this._defs = await db.getAll('chore_definitions');
      this._completions = await db.getAll('chore_completions');
    } catch { this._defs = []; this._completions = []; }
    this._renderContent();
  }

  _renderShell() {
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><div id="root"></div>`;
  }

  _renderContent() {
    const root = this.shadowRoot.getElementById('root');
    if (!root) return;
    if (this._mode === 'full') {
      root.innerHTML = this._fullHtml();
    } else {
      root.innerHTML = this._dashHtml();
    }
    this._bind(root);
  }

  /* ---- Dashboard view ---- */

  _dashHtml() {
    const today = getToday();
    const todayChores = this._defs.filter(isTodayChore);
    const doneIds = new Set(this._completions.filter(c => c.date === today).map(c => c.choreId));
    const doneCount = todayChores.filter(c => doneIds.has(c.id)).length;

    if (!todayChores.length) {
      return `<div class="header"><span class="title">Today's Chores</span></div><div class="empty">No chores for today. ${this._defs.length === 0 ? 'Add chores in the full view!' : ''}</div>`;
    }

    const rows = todayChores.map(c => {
      const done = doneIds.has(c.id);
      const col = getMemberColor(c.assignedTo);
      return `<div class="chore-row" data-id="${c.id}" data-action="toggle">
        <span class="dot" style="background:${col}"></span>
        <div class="chore-info">
          <div class="chore-title ${done ? 'done' : ''}">${escapeHtml(c.title)}</div>
          <div class="chore-assign">${escapeHtml(c.assignedTo || 'Unassigned')}</div>
        </div>
        <span class="points">${c.points || 0} ⭐</span>
        <div class="check ${done ? 'done' : ''}">${done ? '✓' : ''}</div>
      </div>`;
    }).join('');

    return `<div class="header"><span class="title">Today's Chores</span><span class="count">${doneCount}/${todayChores.length}</span></div><div class="list">${rows}</div>`;
  }

  /* ---- Full view ---- */

  _fullHtml() {
    const tabs = `<div class="tabs">
      <button class="tab ${this._tab==='today'?'active':''}" data-tab="today">Today</button>
      <button class="tab ${this._tab==='manage'?'active':''}" data-tab="manage">Manage</button>
      <button class="tab ${this._tab==='leaderboard'?'active':''}" data-tab="leaderboard">Leaderboard</button>
    </div>`;

    let content = '';
    if (this._tab === 'today') content = this._todayTabHtml();
    else if (this._tab === 'manage') content = this._manageTabHtml();
    else content = this._leaderboardHtml();

    return tabs + `<div class="list">${content}</div>`;
  }

  _todayTabHtml() {
    const today = getToday();
    const todayChores = this._defs.filter(isTodayChore);
    const doneIds = new Set(this._completions.filter(c => c.date === today).map(c => c.choreId));

    if (!todayChores.length) return `<div class="empty">No chores scheduled for today.</div>`;

    return todayChores.map(c => {
      const done = doneIds.has(c.id);
      const col = getMemberColor(c.assignedTo);
      return `<div class="chore-row" data-id="${c.id}" data-action="toggle">
        <span class="dot" style="background:${col}"></span>
        <div class="chore-info">
          <div class="chore-title ${done ? 'done' : ''}">${escapeHtml(c.title)}</div>
          <div class="chore-assign">${escapeHtml(c.assignedTo || 'Unassigned')}</div>
        </div>
        <span class="points">${c.points || 0} ⭐</span>
        <div class="check ${done ? 'done' : ''}">${done ? '✓' : ''}</div>
      </div>`;
    }).join('');
  }

  _manageTabHtml() {
    const rows = this._defs.map(c => {
      const freqLabel = c.frequency === 'daily' ? 'Daily' : c.frequency === 'weekdays' ? 'Weekdays' : c.frequency === 'weekly' ? 'Weekly' : 'Specific';
      return `<div class="manage-row">
        <div class="manage-info">
          <div class="manage-title">${escapeHtml(c.title)}</div>
          <div class="manage-meta">${freqLabel} · ${escapeHtml(c.assignedTo || 'Unassigned')} · ${c.points || 0}pts</div>
        </div>
        <div class="manage-actions">
          <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${c.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${c.id}">×</button>
        </div>
      </div>`;
    }).join('');

    const form = this._showForm ? this._formHtml() : '';
    const addBtn = this._showForm ? '' : `<button class="btn btn-primary" data-action="showform" style="margin-top:12px;width:100%">+ Add Chore</button>`;

    return rows + addBtn + form;
  }

  _formHtml() {
    const editing = this._editId ? this._defs.find(d => d.id === this._editId) : null;
    const title = editing?.title || '';
    const freq = editing?.frequency || 'daily';
    const days = editing?.days || [];
    const assignedTo = editing?.assignedTo || '';
    const points = editing?.points ?? 5;
    const members = getMembers();

    const showDays = freq === 'weekly' || freq === 'specific';

    return `<div class="form">
      <label>Title</label>
      <input type="text" id="f-title" value="${escapeHtml(title)}" placeholder="e.g. Empty dishwasher" />
      <label>Frequency</label>
      <div class="freq-btns">
        ${['daily','weekdays','weekly','specific'].map(f => `<button class="freq-btn ${freq===f?'sel':''}" data-freq="${f}">${f[0].toUpperCase()+f.slice(1)}</button>`).join('')}
      </div>
      <div id="days-wrap" style="display:${showDays?'block':'none'}">
        <label>Days</label>
        <div class="day-btns">
          ${DAYS.map(d => `<button class="day-btn ${days.map(x=>x.toLowerCase()).includes(d)?'sel':''}" data-day="${d}">${d.slice(0,3)}</button>`).join('')}
        </div>
      </div>
      <label>Assign to</label>
      <div class="member-btns">
        ${members.length ? members.map(m => `<button class="member-btn ${assignedTo===m.name?'sel':''}" data-member="${escapeHtml(m.name)}" style="border-color:${m.color}">${m.emoji||''} ${escapeHtml(m.name)}</button>`).join('') : '<span style="color:var(--text-muted);font-size:14px">Add family members in Settings</span>'}
      </div>
      <label>Points</label>
      <input type="number" id="f-points" value="${points}" min="0" max="100" />
      <div class="form-actions">
        <button class="btn btn-primary" data-action="save">${editing ? 'Update' : 'Save'}</button>
        <button class="btn btn-secondary" data-action="cancelform">Cancel</button>
      </div>
    </div>`;
  }

  _leaderboardHtml() {
    const members = getMembers();
    if (!members.length) return `<div class="empty">Add family members in Settings to see the leaderboard.</div>`;

    const weekStart = startOfWeek();
    const weekCompletions = this._completions.filter(c => new Date(c.completedAt) >= weekStart);
    const defMap = new Map(this._defs.map(d => [d.id, d]));
    const scores = {};
    members.forEach(m => { scores[m.name] = 0; });
    for (const c of weekCompletions) {
      const def = defMap.get(c.choreId);
      if (def && scores[c.completedBy] !== undefined) {
        scores[c.completedBy] += def.points || 0;
      }
    }
    const maxPts = Math.max(1, ...Object.values(scores));
    const sorted = members.slice().sort((a, b) => (scores[b.name]||0) - (scores[a.name]||0));

    return sorted.map((m, i) => {
      const pts = scores[m.name] || 0;
      const pct = (pts / maxPts * 100).toFixed(0);
      return `<div class="lb-row">
        <span class="lb-emoji">${m.emoji || '👤'}</span>
        <div class="lb-info">
          <div class="lb-name">${escapeHtml(m.name)} ${i===0 && pts > 0 ? '<span class="lb-trophy">🏆</span>' : ''}</div>
          <div class="lb-bar-wrap"><div class="lb-bar" style="width:${pct}%;background:${m.color}"></div></div>
        </div>
        <span class="lb-pts" style="color:${m.color}">${pts}</span>
      </div>`;
    }).join('');
  }

  /* ---- Event binding ---- */

  _bind(root) {
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) {
        const tab = e.target.closest('[data-tab]');
        if (tab) { this._tab = tab.dataset.tab; this._showForm = false; this._editId = null; this._renderContent(); return; }
        const freq = e.target.closest('[data-freq]');
        if (freq) { root.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('sel')); freq.classList.add('sel'); const dw = root.querySelector('#days-wrap'); if (dw) dw.style.display = (freq.dataset.freq==='weekly'||freq.dataset.freq==='specific')?'block':'none'; return; }
        const day = e.target.closest('[data-day]');
        if (day) { day.classList.toggle('sel'); return; }
        const member = e.target.closest('[data-member]');
        if (member) { root.querySelectorAll('.member-btn').forEach(b => b.classList.remove('sel')); member.classList.add('sel'); return; }
        return;
      }

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'toggle') {
        await this._toggleChore(id, root);
      } else if (action === 'showform') {
        this._showForm = true; this._editId = null; this._renderContent();
      } else if (action === 'cancelform') {
        this._showForm = false; this._editId = null; this._renderContent();
      } else if (action === 'edit') {
        this._showForm = true; this._editId = id; this._renderContent();
      } else if (action === 'delete') {
        await db.delete('chore_definitions', id);
        eventBus.emit('chores-changed');
      } else if (action === 'save') {
        await this._saveChore(root);
      }
    });
  }

  async _toggleChore(choreId, root) {
    const today = getToday();
    const existing = this._completions.find(c => c.choreId === choreId && c.date === today);
    if (existing) {
      await db.delete('chore_completions', existing.id);
    } else {
      const def = this._defs.find(d => d.id === choreId);
      await db.put('chore_completions', {
        id: generateId(),
        choreId,
        completedBy: def?.assignedTo || 'Unknown',
        completedAt: new Date().toISOString(),
        date: today
      });
      // Animate
      const check = root.querySelector(`[data-id="${choreId}"] .check`);
      if (check) { check.classList.add('pop'); setTimeout(() => check.classList.remove('pop'), 300); }
    }
    await this._load();
  }

  async _saveChore(root) {
    const title = root.querySelector('#f-title')?.value?.trim();
    if (!title) return;
    const freqBtn = root.querySelector('.freq-btn.sel');
    const frequency = freqBtn?.dataset?.freq || 'daily';
    const selDays = [...root.querySelectorAll('.day-btn.sel')].map(b => b.dataset.day);
    const memberBtn = root.querySelector('.member-btn.sel');
    const assignedTo = memberBtn?.dataset?.member || '';
    const points = parseInt(root.querySelector('#f-points')?.value) || 5;

    const chore = {
      id: this._editId || generateId(),
      title,
      icon: '',
      frequency,
      days: (frequency === 'weekly' || frequency === 'specific') ? selDays : [],
      assignedTo,
      points,
      createdAt: this._editId ? (this._defs.find(d => d.id === this._editId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };

    await db.put('chore_definitions', chore);
    this._showForm = false;
    this._editId = null;
    eventBus.emit('chores-changed');
  }
}

customElements.define('fp-chores', FpChores);
