/**
 * trains.js — <fp-trains> Custom Element
 *
 * Shows a live departure board for a configured station using the
 * Realtime Trains (RTT) API.
 *
 * Config (from store.get('config')?.trains):
 *   { username: string, password: string, station: string }
 *
 * Attributes:
 *   (none — all config is read from store)
 *
 * Usage:
 *   <fp-trains></fp-trains>
 *
 * Dependencies:
 *   escapeHtml, formatTime  from ../utils.js
 *   store, eventBus         from ../state.js
 *   cachedFetch             from ../fetch-cache.js
 */

import { escapeHtml } from '../utils.js';
import { store, eventBus } from '../state.js';
import { cachedFetch } from '../fetch-cache.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RTT_BASE = 'https://api.rtt.io/api/v1/json/search';
const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes
const MAX_DEPARTURES = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a 4-digit HHMM string to a HH:MM display string.
 * @param {string|null} hhmm
 * @returns {string}
 */
function formatHHMM(hhmm) {
  if (!hhmm || hhmm.length < 4) return '--:--';
  return hhmm.slice(0, 2) + ':' + hhmm.slice(2, 4);
}

/**
 * Derives the display status from a service's locationDetail object.
 * @param {object} locationDetail
 * @returns {{ text: string, cls: string }}
 */
function getStatus(locationDetail) {
  if (locationDetail.displayAs === 'CANCELLED_CALL') {
    return { text: 'Cancelled', cls: 'danger' };
  }
  const sched = locationDetail.gbttBookedDeparture;
  const real  = locationDetail.realtimeDeparture;
  if (!real) return { text: 'No report', cls: 'muted' };
  if (real === sched) return { text: 'On time', cls: 'success' };
  return { text: `Exp ${formatHHMM(real)}`, cls: 'warning' };
}

// ---------------------------------------------------------------------------
// Custom Element
// ---------------------------------------------------------------------------

class FpTrains extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    /** @type {ReturnType<typeof setInterval>|null} */
    this._timer = null;

    /** @type {(() => void)|null} */
    this._unsub = null;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  connectedCallback() {
    this._renderShell();
    this._refresh();
    this._timer = setInterval(() => this._refresh(), REFRESH_INTERVAL);

    // Re-fetch if the user updates config
    this._unsub = store.subscribe('config', () => this._refresh());
  }

  disconnectedCallback() {
    if (this._timer) clearInterval(this._timer);
    if (this._unsub) this._unsub();
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  /** Writes the static shell (styles + layout skeleton) into Shadow DOM. */
  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :host {
          display: block;
          font-family: var(--font, system-ui, sans-serif);
          background: var(--surface, #161b22);
          border: 1px solid var(--border, #30363d);
          border-radius: var(--radius, 12px);
          padding: 16px;
          color: var(--text, #e6edf3);
        }

        /* ---- Header ---- */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
          gap: 8px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .title {
          font-size: var(--text-lg, 18px);
          font-weight: 600;
          color: var(--text, #e6edf3);
        }

        .station-badge {
          font-size: var(--text-xs, 11px);
          font-weight: 500;
          color: var(--text-muted, #8b949e);
          background: var(--bg, #0d1117);
          border: 1px solid var(--border, #30363d);
          border-radius: var(--radius-sm, 6px);
          padding: 2px 7px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        /* ---- Departure list ---- */
        .dep-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .dep-row {
          display: grid;
          grid-template-columns: 52px 1fr 90px 48px;
          align-items: center;
          gap: 8px;
          padding: 10px 8px;
          border-radius: var(--radius-sm, 6px);
          transition: background var(--transition, 150ms ease);
          min-height: 48px;
        }

        .dep-row:hover {
          background: var(--surface-hover, #1c2128);
        }

        .dep-header-row {
          grid-template-columns: 52px 1fr 90px 48px;
          display: grid;
          gap: 8px;
          padding: 0 8px 6px;
          border-bottom: 1px solid var(--border, #30363d);
          margin-bottom: 4px;
        }

        .col-label {
          font-size: var(--text-xs, 11px);
          color: var(--text-muted, #8b949e);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 500;
        }

        .col-time {
          font-size: var(--text-sm, 14px);
          font-weight: 600;
          color: var(--text, #e6edf3);
          font-variant-numeric: tabular-nums;
        }

        .col-dest {
          font-size: var(--text-sm, 14px);
          color: var(--text, #e6edf3);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .col-platform {
          font-size: var(--text-sm, 14px);
          color: var(--text-muted, #8b949e);
          text-align: center;
          font-variant-numeric: tabular-nums;
        }

        /* ---- Status badges ---- */
        .badge {
          display: inline-block;
          font-size: var(--text-xs, 11px);
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 20px;
          white-space: nowrap;
          line-height: 1.6;
        }

        .badge-success {
          background: color-mix(in srgb, var(--success, #3fb950) 15%, transparent);
          color: var(--success, #3fb950);
        }

        .badge-warning {
          background: color-mix(in srgb, var(--warning, #d29922) 15%, transparent);
          color: var(--warning, #d29922);
        }

        .badge-danger {
          background: color-mix(in srgb, var(--danger, #f85149) 15%, transparent);
          color: var(--danger, #f85149);
        }

        .badge-muted {
          background: color-mix(in srgb, var(--text-muted, #8b949e) 15%, transparent);
          color: var(--text-muted, #8b949e);
        }

        /* ---- Footer ---- */
        .footer {
          margin-top: 12px;
          font-size: var(--text-xs, 11px);
          color: var(--text-muted, #8b949e);
          text-align: right;
        }

        /* ---- States ---- */
        .state-msg {
          padding: 24px 8px;
          text-align: center;
          font-size: var(--text-sm, 14px);
          color: var(--text-muted, #8b949e);
        }

        .state-msg .icon {
          font-size: 28px;
          display: block;
          margin-bottom: 8px;
        }

        .error-msg {
          color: var(--danger, #f85149);
          font-size: var(--text-xs, 11px);
          padding: 4px 8px;
        }

        .loading-bar {
          height: 2px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            var(--accent, #58a6ff) 50%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite;
          border-radius: 2px;
          margin-bottom: 12px;
        }

        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      </style>

      <div class="header">
        <div class="header-left">
          <span class="title">Trains</span>
          <span class="station-badge" id="station-badge"></span>
        </div>
        <span aria-label="Train">🚂</span>
      </div>

      <div id="body"></div>

      <div class="footer" id="footer"></div>
    `;
  }

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  /** Reads config, fetches departures, and updates the DOM. */
  async _refresh() {
    const config = store.get('config')?.trains;
    const bodyEl = this.shadowRoot.getElementById('body');
    const stationBadgeEl = this.shadowRoot.getElementById('station-badge');

    if (!config?.username || !config?.password || !config?.station) {
      stationBadgeEl.textContent = '';
      bodyEl.innerHTML = `
        <div class="state-msg">
          <span class="icon">⚙️</span>
          Configure trains in Settings
        </div>
      `;
      this.shadowRoot.getElementById('footer').textContent = '';
      return;
    }

    const station = config.station.toUpperCase();
    stationBadgeEl.textContent = station;

    // Show loading indicator only on first load (body currently empty)
    if (!bodyEl.querySelector('.dep-list')) {
      bodyEl.innerHTML = '<div class="loading-bar"></div>';
    }

    const url = `${RTT_BASE}/${encodeURIComponent(station)}`;

    let data;
    try {
      data = await cachedFetch(url, {
        ttl: REFRESH_INTERVAL,
        auth: config.username + ':' + config.password,
        cacheKey: `rtt:${station}`,
      });
    } catch (err) {
      console.error('[fp-trains] Fetch error:', err);
      bodyEl.innerHTML = `
        <div class="state-msg">
          <span class="icon">⚠️</span>
          Could not load departures
        </div>
        <p class="error-msg">${escapeHtml(String(err.message ?? err))}</p>
      `;
      return;
    }

    this._renderDepartures(data, station);
  }

  // -------------------------------------------------------------------------
  // DOM update
  // -------------------------------------------------------------------------

  /**
   * Renders the departures list from the RTT API response.
   * @param {object} data  — raw JSON response from RTT
   * @param {string} station  — station code string for display
   */
  _renderDepartures(data, station) {
    const bodyEl   = this.shadowRoot.getElementById('body');
    const footerEl = this.shadowRoot.getElementById('footer');
    const stationBadgeEl = this.shadowRoot.getElementById('station-badge');

    const services = Array.isArray(data?.services) ? data.services : [];

    // RTT sometimes returns a 'location' object with the human name
    const locationName = data?.location?.name ?? station;
    stationBadgeEl.textContent = locationName;

    // Filter to departing services only (skip DESTINATION rows, etc.)
    const departures = services
      .filter(s => {
        const disp = s?.locationDetail?.displayAs;
        return disp === 'CALL' || disp === 'ORIGIN' || disp === 'CANCELLED_CALL';
      })
      .slice(0, MAX_DEPARTURES);

    if (departures.length === 0) {
      bodyEl.innerHTML = `
        <div class="state-msg">
          <span class="icon">🚉</span>
          No departures found
        </div>
      `;
      footerEl.textContent = `Last updated ${this._nowTime()}`;
      return;
    }

    const rows = departures.map(svc => {
      const loc  = svc.locationDetail ?? {};
      const dest = svc.destinationDetail?.[0]?.description ?? 'Unknown';
      const plat = loc.platform ?? '—';
      const sched = formatHHMM(loc.gbttBookedDeparture);
      const status = getStatus(loc);

      return `
        <div class="dep-row">
          <span class="col-time">${escapeHtml(sched)}</span>
          <span class="col-dest" title="${escapeHtml(dest)}">${escapeHtml(dest)}</span>
          <span class="badge badge-${escapeHtml(status.cls)}">${escapeHtml(status.text)}</span>
          <span class="col-platform">${escapeHtml(String(plat))}</span>
        </div>
      `;
    }).join('');

    bodyEl.innerHTML = `
      <div class="dep-header-row">
        <span class="col-label">Time</span>
        <span class="col-label">Destination</span>
        <span class="col-label">Status</span>
        <span class="col-label" style="text-align:center">Plat</span>
      </div>
      <div class="dep-list">${rows}</div>
    `;

    const staleNote = data?.stale ? ' (cached)' : '';
    footerEl.textContent = `Last updated ${this._nowTime()}${staleNote}`;
  }

  /**
   * Returns the current time as HH:MM.
   * @returns {string}
   */
  _nowTime() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}

customElements.define('fp-trains', FpTrains);
