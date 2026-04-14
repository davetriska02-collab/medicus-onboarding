/**
 * calendar.js — <fp-calendar> Custom Element
 * Family calendar showing events from ICS/iCal feeds, with month grid view.
 */

import { escapeHtml, generateId, formatTime, formatDateShort } from '../utils.js';
import { store, eventBus } from '../state.js';
import { cachedFetch } from '../fetch-cache.js';

/* ------------------------------------------------------------------ */
/* ICS Parser (simplified)                                             */
/* ------------------------------------------------------------------ */

function parseICSDate(str) {
  if (!str) return null;
  const clean = str.replace(/[^0-9T]/g, '');
  if (clean.length >= 8) {
    const y = parseInt(clean.slice(0, 4));
    const m = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    if (clean.length >= 15) {
      const hh = parseInt(clean.slice(9, 11));
      const mm = parseInt(clean.slice(11, 13));
      const ss = parseInt(clean.slice(13, 15));
      if (str.endsWith('Z')) return new Date(Date.UTC(y, m, d, hh, mm, ss));
      return new Date(y, m, d, hh, mm, ss);
    }
    return new Date(y, m, d);
  }
  return null;
}

function parseICS(icsText, calName, calColor) {
  const events = [];
  const blocks = icsText.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    const get = (key) => {
      const match = block.match(new RegExp(`^${key}[^:]*:(.+)$`, 'm'));
      return match ? match[1].trim().replace(/\\n/g, '\n').replace(/\\,/g, ',') : null;
    };
    const summary = get('SUMMARY') || 'Untitled';
    const dtstart = get('DTSTART');
    const dtend = get('DTEND');
    const location = get('LOCATION') || '';

    if (!dtstart) continue;
    const start = parseICSDate(dtstart);
    if (!start) continue;
    const end = dtend ? parseICSDate(dtend) : start;
    const allDay = dtstart.length <= 8 || (get('DTSTART')?.indexOf('T') === -1 && !dtstart.includes('T'));

    events.push({
      id: generateId(),
      summary,
      start,
      end,
      allDay,
      location,
      calendar: calName,
      color: calColor
    });
  }
  return events;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabel(evtDate) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(evtDate, today)) return 'Today';
  if (isSameDay(evtDate, tomorrow)) return 'Tomorrow';
  return formatDateShort(evtDate);
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const STYLES = `
  :host { display: flex; flex-direction: column; width: 100%; height: 100%; font-family: var(--font, system-ui, sans-serif); color: var(--text, #e6edf3); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-shrink: 0; }
  .title { font-size: var(--text-lg, 18px); font-weight: 600; }
  .subtitle { font-size: var(--text-xs, 13px); color: var(--text-muted, #8b949e); }
  .list { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .event-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-sm, 8px); min-height: 48px; }
  .event-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .event-info { flex: 1; min-width: 0; }
  .event-summary { font-size: var(--text-base, 16px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .event-meta { font-size: var(--text-xs, 13px); color: var(--text-muted, #8b949e); }
  .event-time { font-size: var(--text-sm, 14px); color: var(--text-muted, #8b949e); white-space: nowrap; }
  .event-day { font-size: var(--text-xs, 13px); padding: 2px 8px; border-radius: 10px; background: var(--surface-hover, #1c2333); color: var(--text-muted, #8b949e); white-space: nowrap; }
  .event-day.today { background: rgba(233,69,96,0.2); color: var(--accent, #e94560); }
  .allday-badge { font-size: var(--text-xs, 13px); padding: 2px 6px; border-radius: 8px; background: rgba(88,166,255,0.15); color: #58a6ff; }
  .empty { text-align: center; color: var(--text-muted, #8b949e); padding: 32px 16px; font-size: var(--text-sm, 14px); }
  .loading { text-align: center; color: var(--text-muted, #8b949e); padding: 24px; }

  /* Full mode: month grid */
  .month-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; flex-shrink: 0; }
  .month-title { font-size: var(--text-xl, 20px); font-weight: 600; }
  .month-nav { display: flex; gap: 8px; }
  .month-btn { width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--border, #30363d); background: transparent; color: var(--text, #e6edf3); font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .month-btn:active { background: var(--surface-hover, #1c2333); }
  .weekdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: var(--text-xs, 13px); color: var(--text-muted, #8b949e); padding: 8px 0; }
  .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
  .cal-day { min-height: 48px; padding: 4px; border-radius: var(--radius-sm, 8px); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; transition: background var(--transition, 0.15s ease); }
  .cal-day:active { background: var(--surface-hover, #1c2333); }
  .cal-day.today { border: 2px solid var(--accent, #e94560); }
  .cal-day.selected { background: var(--surface-hover, #1c2333); }
  .cal-day.other-month { opacity: 0.3; }
  .cal-num { font-size: var(--text-sm, 14px); }
  .cal-dots { display: flex; gap: 2px; }
  .cal-dot { width: 5px; height: 5px; border-radius: 50%; }
  .day-events { margin-top: 12px; border-top: 1px solid var(--border, #30363d); padding-top: 12px; flex: 1; overflow-y: auto; }
  .day-events-title { font-size: var(--text-sm, 14px); color: var(--text-muted, #8b949e); margin-bottom: 8px; }
`;

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

class FpCalendar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._events = [];
    this._loading = false;
    this._viewMonth = new Date().getMonth();
    this._viewYear = new Date().getFullYear();
    this._selectedDate = new Date();
  }

  connectedCallback() {
    this._mode = this.getAttribute('mode') || 'default';
    this._renderShell();
    this._load();
    this._timer = setInterval(() => this._load(), 30 * 60 * 1000);
    this._unsub = eventBus.on('config-updated', () => this._load());
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    if (this._unsub) this._unsub();
  }

  async _load() {
    const calendars = store.get('config')?.calendars || [];
    if (!calendars.length) {
      this._events = [];
      this._renderContent();
      return;
    }

    this._loading = true;
    this._renderContent();

    const allEvents = [];
    for (const cal of calendars) {
      if (!cal.url) continue;
      try {
        const text = await cachedFetch(cal.url, {
          ttl: 30 * 60 * 1000,
          cacheKey: `cal_${cal.name}`
        }).then(r => {
          // cachedFetch returns JSON, but ICS is text. We need raw text.
          // Fallback: fetch directly for ICS
          return typeof r === 'string' ? r : null;
        }).catch(() => null);

        if (!text) {
          // Try direct fetch for ICS (not JSON)
          try {
            const resp = await fetch(cal.url);
            if (resp.ok) {
              const icsText = await resp.text();
              const parsed = parseICS(icsText, cal.name, cal.color || '#58a6ff');
              allEvents.push(...parsed);
            }
          } catch { /* skip */ }
        } else {
          const parsed = parseICS(text, cal.name, cal.color || '#58a6ff');
          allEvents.push(...parsed);
        }
      } catch { /* skip this calendar */ }
    }

    this._events = allEvents.sort((a, b) => a.start - b.start);
    this._loading = false;
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
    this._bindEvents(root);
  }

  /* ---- Dashboard (compact) ---- */

  _dashHtml() {
    const calendars = store.get('config')?.calendars || [];
    if (!calendars.length) {
      return `<div class="header"><span class="title">📅 Calendar</span></div><div class="empty">Add calendar feeds in Settings to see events here.</div>`;
    }
    if (this._loading) {
      return `<div class="header"><span class="title">📅 Calendar</span></div><div class="loading">Loading events...</div>`;
    }

    const now = new Date();
    const upcoming = this._events.filter(e => e.end >= now).slice(0, 7);

    if (!upcoming.length) {
      return `<div class="header"><span class="title">📅 Calendar</span></div><div class="empty">No upcoming events.</div>`;
    }

    const rows = upcoming.map(e => {
      const dl = dayLabel(e.start);
      const isToday = dl === 'Today';
      const time = e.allDay ? '<span class="allday-badge">All day</span>' : `<span class="event-time">${formatTime(e.start)}</span>`;
      return `<div class="event-row">
        <span class="event-dot" style="background:${e.color}"></span>
        <div class="event-info">
          <div class="event-summary">${escapeHtml(e.summary)}</div>
          <div class="event-meta">${escapeHtml(e.calendar)}</div>
        </div>
        ${time}
        <span class="event-day ${isToday ? 'today' : ''}">${dl}</span>
      </div>`;
    }).join('');

    return `<div class="header"><span class="title">📅 Calendar</span><span class="subtitle">${upcoming.length} upcoming</span></div><div class="list">${rows}</div>`;
  }

  /* ---- Full (month grid + day events) ---- */

  _fullHtml() {
    const y = this._viewYear;
    const m = this._viewMonth;
    const today = new Date();

    // Month header with nav
    const header = `<div class="month-header">
      <button class="month-btn" data-action="prev">‹</button>
      <span class="month-title">${MONTHS[m]} ${y}</span>
      <button class="month-btn" data-action="next">›</button>
    </div>`;

    // Weekday headers (Mon first)
    const weekdays = `<div class="weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => `<span>${d}</span>`).join('')}</div>`;

    // Build calendar grid
    const firstDay = new Date(y, m, 1);
    let startOffset = firstDay.getDay() - 1; // Monday = 0
    if (startOffset < 0) startOffset = 6; // Sunday

    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();

    let cells = '';
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      let day, isOther = false, dateObj;
      if (i < startOffset) {
        day = prevDays - startOffset + i + 1;
        isOther = true;
        dateObj = new Date(y, m - 1, day);
      } else if (i >= startOffset + daysInMonth) {
        day = i - startOffset - daysInMonth + 1;
        isOther = true;
        dateObj = new Date(y, m + 1, day);
      } else {
        day = i - startOffset + 1;
        dateObj = new Date(y, m, day);
      }

      const isToday = isSameDay(dateObj, today);
      const isSelected = isSameDay(dateObj, this._selectedDate);
      const dayEvents = this._events.filter(e => isSameDay(e.start, dateObj));
      const dots = dayEvents.slice(0, 3).map(e => `<span class="cal-dot" style="background:${e.color}"></span>`).join('');

      cells += `<div class="cal-day ${isOther ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateObj.toISOString()}">
        <span class="cal-num">${day}</span>
        <div class="cal-dots">${dots}</div>
      </div>`;
    }

    const grid = `<div class="cal-grid">${cells}</div>`;

    // Selected day events
    const selEvents = this._events.filter(e => isSameDay(e.start, this._selectedDate));
    const selTitle = dayLabel(this._selectedDate);
    let dayEventsHtml = '';
    if (selEvents.length) {
      dayEventsHtml = selEvents.map(e => {
        const time = e.allDay ? '<span class="allday-badge">All day</span>' : `<span class="event-time">${formatTime(e.start)}</span>`;
        return `<div class="event-row">
          <span class="event-dot" style="background:${e.color}"></span>
          <div class="event-info">
            <div class="event-summary">${escapeHtml(e.summary)}</div>
            <div class="event-meta">${escapeHtml(e.calendar)}${e.location ? ' · ' + escapeHtml(e.location) : ''}</div>
          </div>
          ${time}
        </div>`;
      }).join('');
    } else {
      dayEventsHtml = `<div class="empty">No events on ${selTitle}.</div>`;
    }

    return `${header}${weekdays}${grid}<div class="day-events"><div class="day-events-title">${selTitle}</div>${dayEventsHtml}</div>`;
  }

  /* ---- Events ---- */

  _bindEvents(root) {
    root.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]');
      if (action) {
        if (action.dataset.action === 'prev') {
          this._viewMonth--;
          if (this._viewMonth < 0) { this._viewMonth = 11; this._viewYear--; }
          this._renderContent();
        } else if (action.dataset.action === 'next') {
          this._viewMonth++;
          if (this._viewMonth > 11) { this._viewMonth = 0; this._viewYear++; }
          this._renderContent();
        }
        return;
      }

      const dayEl = e.target.closest('.cal-day');
      if (dayEl?.dataset.date) {
        this._selectedDate = new Date(dayEl.dataset.date);
        this._renderContent();
      }
    });
  }
}

customElements.define('fp-calendar', FpCalendar);
