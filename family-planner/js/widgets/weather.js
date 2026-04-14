/**
 * weather.js — <fp-weather> Custom Element
 *
 * Displays current weather conditions fetched from the OpenWeatherMap
 * One Call API 3.0, with an optional 3-day forecast.
 *
 * Attributes:
 *   mode="compact"   — Temperature + emoji only; fits in the 80 px header.
 *   mode="forecast"  — Current conditions + 3-day forecast cards.
 *   (no mode)        — Same as "forecast".
 *
 * Config (read from store.get('config').weather):
 *   apiKey  {string}  — OpenWeatherMap API key (required)
 *   lat     {number}  — Latitude
 *   lon     {number}  — Longitude
 *   units   {string}  — 'metric' | 'imperial' (default: 'metric')
 *
 * Dependencies:
 *   escapeHtml      from ../utils.js
 *   store           from ../state.js
 *   cachedFetch     from ../fetch-cache.js
 *
 * Usage:
 *   <fp-weather mode="compact"></fp-weather>
 *   <fp-weather mode="forecast"></fp-weather>
 *   <fp-weather></fp-weather>
 */

import { escapeHtml } from '../utils.js';
import { store } from '../state.js';
import { cachedFetch } from '../fetch-cache.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const CACHE_TTL_MS        = 15 * 60 * 1000; // 15 minutes

/** Short day names indexed by Date.getDay() (0 = Sunday). */
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps an OpenWeatherMap condition id + icon code to an emoji.
 * Icon codes ending in 'd' are daytime; 'n' are night-time.
 *
 * @param {number} id         — OWM condition id
 * @param {string} [icon='']  — OWM icon code, e.g. "01d" or "02n"
 * @returns {string}
 */
function conditionEmoji(id, icon = '') {
  const isNight = icon.endsWith('n');

  if (id >= 200 && id < 300) return '⛈️';                        // Thunderstorm
  if (id >= 300 && id < 400) return '🌦️';                       // Drizzle
  if (id >= 500 && id < 600) return '🌧️';                       // Rain
  if (id >= 600 && id < 700) return '🌨️';                       // Snow
  if (id >= 700 && id < 800) return '🌫️';                       // Mist/Fog/Haze
  if (id === 800) return isNight ? '🌙' : '☀️';                 // Clear
  if (id === 801 || id === 802) return isNight ? '☁️' : '⛅';   // Few/Scattered clouds
  if (id >= 803)  return '☁️';                                   // Broken/Overcast clouds

  return '🌤️'; // Default fallback
}

/**
 * Rounds a temperature to the nearest integer and appends the degree symbol.
 * @param {number} temp
 * @returns {string}  e.g. "12°"
 */
function fmtTemp(temp) {
  return `${Math.round(temp)}°`;
}

/**
 * Returns a short day name for a Unix timestamp (seconds).
 * @param {number} dt  — Unix timestamp in seconds
 * @returns {string}   — e.g. "Mon"
 */
function dayLabel(dt) {
  return DAY_SHORT[new Date(dt * 1000).getDay()];
}

/**
 * Formats a staleness timestamp into a human-readable "X min ago" string.
 * @param {number} fetchedAt  — Date.now() value when the data was fetched
 * @returns {string}
 */
function staleLabel(fetchedAt) {
  const mins = Math.round((Date.now() - fetchedAt) / 60_000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  return `${mins} min ago`;
}

// ---------------------------------------------------------------------------
// Custom Element
// ---------------------------------------------------------------------------

class FpWeather extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    /** @type {object|null} Most recent API response */
    this._data = null;
    /** @type {number|null} Timestamp when _data was last fetched */
    this._fetchedAt = null;
    /** @type {string|null} Last error message */
    this._error = null;
    /** @type {boolean} */
    this._loading = false;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  connectedCallback() {
    this._renderShell();
    this._load();
    this._timer = setInterval(() => this._load(), REFRESH_INTERVAL_MS);

    // Re-load if the config changes (e.g. user sets API key in Settings)
    this._unsub = store.subscribe('config', () => {
      this._load();
    });
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    if (this._unsub) this._unsub();
  }

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  /**
   * Reads weather config from the store, validates it, then calls the API.
   * Updates internal state and re-renders on completion.
   */
  async _load() {
    const config  = store.get('config') ?? {};
    const weather = config.weather ?? {};
    const { apiKey, lat, lon, units = 'metric' } = weather;

    if (!apiKey) {
      this._error   = 'no-key';
      this._loading = false;
      this._renderContent();
      return;
    }

    if (lat == null || lon == null) {
      this._error   = 'no-location';
      this._loading = false;
      this._renderContent();
      return;
    }

    this._loading = true;
    this._error   = null;
    this._renderContent();

    const url =
      `https://api.openweathermap.org/data/3.0/onecall` +
      `?lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lon)}` +
      `&units=${encodeURIComponent(units)}` +
      `&exclude=minutely,hourly,alerts` +
      `&appid=${encodeURIComponent(apiKey)}`;

    try {
      const data = await cachedFetch(url, { ttl: CACHE_TTL_MS });
      this._data      = data;
      this._fetchedAt = data.stale ? this._fetchedAt : Date.now();
      this._error     = null;
    } catch (err) {
      console.error('[fp-weather] Fetch failed:', err);
      this._error = 'fetch-failed';
    } finally {
      this._loading = false;
      this._renderContent();
    }
  }

  // -------------------------------------------------------------------------
  // Rendering — shell (styles + mount point, written once)
  // -------------------------------------------------------------------------

  /**
   * Writes the shadow root's static skeleton (styles + a #mount div).
   * Dynamic content is injected into #mount by _renderContent().
   */
  _renderShell() {
    const mode = this.getAttribute('mode') || 'forecast';

    this.shadowRoot.innerHTML = `
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :host {
          display: block;
          font-family: var(--font, system-ui, sans-serif);
          color: var(--text, #e6edf3);
        }

        /* ---- Compact (header) ---- */
        .compact {
          display: flex;
          align-items: center;
          gap: 6px;
          line-height: 1;
        }
        .compact .temp {
          font-size: 20px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
        }
        .compact .icon {
          font-size: 22px;
          line-height: 1;
        }

        /* ---- Forecast (dashboard) ---- */
        .forecast {
          display: flex;
          flex-direction: column;
          gap: var(--gap, 12px);
        }

        .current {
          display: flex;
          align-items: flex-start;
          gap: 16px;
        }
        .current-icon {
          font-size: 64px;
          line-height: 1;
          flex-shrink: 0;
        }
        .current-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .current-temp {
          font-size: 48px;
          font-weight: 200;
          letter-spacing: -0.02em;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .current-desc {
          font-size: 15px;
          color: var(--text-muted, #8b949e);
          text-transform: capitalize;
        }
        .current-meta {
          display: flex;
          gap: 12px;
          font-size: 13px;
          color: var(--text-muted, #8b949e);
        }
        .current-meta span {
          white-space: nowrap;
        }

        /* ---- 3-day forecast strip ---- */
        .day-strip {
          display: flex;
          gap: var(--gap, 8px);
        }
        .day-card {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 6px;
          background: var(--surface, #161b22);
          border: 1px solid var(--border, #30363d);
          border-radius: var(--radius-sm, 6px);
          font-size: 13px;
        }
        .day-card .day-name {
          font-weight: 500;
          color: var(--text, #e6edf3);
        }
        .day-card .day-icon {
          font-size: 24px;
          line-height: 1;
        }
        .day-card .day-range {
          color: var(--text-muted, #8b949e);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .day-card .day-high {
          color: var(--text, #e6edf3);
          font-weight: 500;
        }

        /* ---- States ---- */
        .message {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          font-size: 14px;
          color: var(--text-muted, #8b949e);
          padding: 8px 0;
        }
        .message .icon-lg {
          font-size: 32px;
        }
        .message a {
          color: var(--accent, #58a6ff);
          text-decoration: none;
        }
        .message a:hover {
          text-decoration: underline;
        }

        .loading-pulse {
          display: inline-block;
          animation: pulse 1.4s ease-in-out infinite;
          font-size: 20px;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }

        .stale-label {
          font-size: 11px;
          color: var(--warning, #e3b341);
          margin-top: 2px;
        }

        .compact .loading-pulse { font-size: 18px; }
      </style>

      <div id="mount"></div>
    `;
  }

  // -------------------------------------------------------------------------
  // Rendering — dynamic content
  // -------------------------------------------------------------------------

  /** Decides which content template to render based on current state. */
  _renderContent() {
    const mount = this.shadowRoot.getElementById('mount');
    if (!mount) return;

    const mode = this.getAttribute('mode') || 'forecast';

    // ---- Loading (initial, no prior data) ----
    if (this._loading && !this._data) {
      mount.innerHTML =
        mode === 'compact'
          ? `<div class="compact"><span class="loading-pulse">🌤️</span></div>`
          : `<div class="message"><span class="loading-pulse">🌤️</span><span>Loading weather…</span></div>`;
      return;
    }

    // ---- Error: no API key configured ----
    if (this._error === 'no-key') {
      mount.innerHTML =
        mode === 'compact'
          ? `<div class="compact"><span class="icon" title="Configure weather in Settings">🌤️</span></div>`
          : `<div class="message">
               <span class="icon-lg">🌤️</span>
               <span>Configure weather in <a href="#settings">Settings</a></span>
             </div>`;
      return;
    }

    // ---- Error: no location set ----
    if (this._error === 'no-location') {
      mount.innerHTML =
        mode === 'compact'
          ? `<div class="compact"><span class="icon" title="Set location in Settings">📍</span></div>`
          : `<div class="message">
               <span class="icon-lg">📍</span>
               <span>Set your location in <a href="#settings">Settings</a></span>
             </div>`;
      return;
    }

    // ---- Error: fetch failed, no cached data ----
    if (this._error === 'fetch-failed' && !this._data) {
      mount.innerHTML =
        mode === 'compact'
          ? `<div class="compact"><span class="icon" title="Weather unavailable">⚠️</span></div>`
          : `<div class="message">
               <span class="icon-lg">⚠️</span>
               <span>Weather unavailable — check your connection</span>
             </div>`;
      return;
    }

    // ---- Have data (possibly stale) ----
    if (this._data) {
      mount.innerHTML =
        mode === 'compact'
          ? this._compactHtml()
          : this._forecastHtml();
      return;
    }

    // Fallback empty state
    mount.innerHTML = '';
  }

  // -------------------------------------------------------------------------
  // HTML builders
  // -------------------------------------------------------------------------

  /**
   * Compact layout: temperature + emoji, single row.
   * @returns {string}
   */
  _compactHtml() {
    const current = this._data?.current;
    if (!current) return '';

    const temp  = fmtTemp(current.temp);
    const emoji = conditionEmoji(current.weather?.[0]?.id ?? 800, current.weather?.[0]?.icon ?? '01d');

    return `
      <div class="compact">
        <span class="temp">${escapeHtml(temp)}</span>
        <span class="icon" role="img" aria-label="${escapeHtml(current.weather?.[0]?.description ?? 'weather')}">${emoji}</span>
      </div>
    `;
  }

  /**
   * Forecast layout: current conditions + 3-day strip.
   * @returns {string}
   */
  _forecastHtml() {
    const current = this._data?.current;
    const daily   = this._data?.daily ?? [];

    if (!current) return '';

    const cond     = current.weather?.[0] ?? {};
    const emoji    = conditionEmoji(cond.id ?? 800, cond.icon ?? '01d');
    const temp     = fmtTemp(current.temp);
    const feelsLike = fmtTemp(current.feels_like);
    const desc     = escapeHtml(cond.description ?? '');

    // High/low come from today's daily entry (index 0)
    const today   = daily[0] ?? {};
    const high    = today.temp?.max != null ? fmtTemp(today.temp.max) : '—';
    const low     = today.temp?.min != null ? fmtTemp(today.temp.min) : '—';

    // Stale indicator
    const staleHtml = this._data?.stale && this._fetchedAt
      ? `<p class="stale-label">Last updated ${staleLabel(this._fetchedAt)}</p>`
      : '';

    // 3-day forecast: days 1, 2, 3 (skip today at index 0)
    const dayCards = daily
      .slice(1, 4)
      .map(d => {
        const dCond  = d.weather?.[0] ?? {};
        const dEmoji = conditionEmoji(dCond.id ?? 800, dCond.icon ?? '01d');
        const dHigh  = d.temp?.max != null ? fmtTemp(d.temp.max) : '—';
        const dLow   = d.temp?.min != null ? fmtTemp(d.temp.min) : '—';
        const dName  = escapeHtml(dayLabel(d.dt));

        return `
          <div class="day-card">
            <span class="day-name">${dName}</span>
            <span class="day-icon" role="img" aria-label="${escapeHtml(dCond.description ?? '')}">${dEmoji}</span>
            <span class="day-range">
              <span class="day-high">${escapeHtml(dHigh)}</span>
              <span> / ${escapeHtml(dLow)}</span>
            </span>
          </div>
        `;
      })
      .join('');

    return `
      <div class="forecast">
        <div class="current">
          <span class="current-icon" role="img" aria-label="${desc}">${emoji}</span>
          <div class="current-details">
            <span class="current-temp">${escapeHtml(temp)}</span>
            <span class="current-desc">${desc}</span>
            <div class="current-meta">
              <span>Feels like ${escapeHtml(feelsLike)}</span>
              <span>H: ${escapeHtml(high)}</span>
              <span>L: ${escapeHtml(low)}</span>
            </div>
            ${staleHtml}
          </div>
        </div>
        ${dayCards ? `<div class="day-strip">${dayCards}</div>` : ''}
      </div>
    `;
  }
}

customElements.define('fp-weather', FpWeather);
