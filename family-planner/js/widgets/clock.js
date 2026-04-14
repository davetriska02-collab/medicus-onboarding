/**
 * clock.js — <fp-clock> Custom Element
 *
 * Displays the current time and date. Updates every second.
 *
 * Attributes:
 *   mode="compact"  — Compact single-row layout for the 80 px app header.
 *                     Omit for the default large-clock dashboard style.
 *
 * Dependencies:
 *   formatTime, formatDate from ../utils.js
 *   store                  from ../state.js
 *
 * Usage:
 *   <fp-clock mode="compact"></fp-clock>
 *   <fp-clock></fp-clock>
 */

import { formatTime, formatDate } from '../utils.js';
import { store } from '../state.js';

class FpClock extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  connectedCallback() {
    this._render();
    this._tick();
    this._timer = setInterval(() => this._tick(), 1000);
    // Re-tick whenever the user changes the clock format in Settings
    this._unsub = store.subscribe('clockFormat', () => this._tick());
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    if (this._unsub) this._unsub();
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  /**
   * Writes the full shadow DOM. Called once on connection; size variants are
   * achieved through CSS rather than re-rendering, keeping the DOM stable for
   * the live _tick() updates.
   */
  _render() {
    const isCompact = this.getAttribute('mode') === 'compact';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          gap: var(--gap, 12px);
          font-family: var(--font, system-ui, sans-serif);
        }

        .wrapper {
          display: flex;
          align-items: baseline;
          gap: 8px;
          flex-wrap: nowrap;
        }

        .time {
          font-size: ${isCompact ? '28px' : '72px'};
          font-weight: ${isCompact ? '500' : '200'};
          color: var(--text, #e6edf3);
          letter-spacing: 0.02em;
          line-height: 1;
          /* Prevent layout shift as digits change */
          font-variant-numeric: tabular-nums;
        }

        .seconds {
          font-size: ${isCompact ? '16px' : '32px'};
          font-weight: 300;
          color: var(--text-muted, #8b949e);
          font-variant-numeric: tabular-nums;
        }

        .date {
          font-size: ${isCompact ? '14px' : '20px'};
          color: var(--text-muted, #8b949e);
          white-space: nowrap;
        }
      </style>

      <div class="wrapper">
        <span class="time"    id="time"></span>
        <span class="seconds" id="seconds"></span>
        <span class="date"    id="date"></span>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // Clock logic
  // -------------------------------------------------------------------------

  /**
   * Updates the time, seconds, and date text nodes from the current moment.
   * Reads clockFormat from the store; falls back to the value baked into
   * config.display.clockFormat, then to '24h'.
   */
  _tick() {
    const now = new Date();

    const fmt =
      store.get('clockFormat') ||
      store.get('config')?.display?.clockFormat ||
      '24h';

    const timeEl    = this.shadowRoot.getElementById('time');
    const secEl     = this.shadowRoot.getElementById('seconds');
    const dateEl    = this.shadowRoot.getElementById('date');

    if (timeEl) timeEl.textContent = formatTime(now, fmt);
    if (secEl)  secEl.textContent  = ':' + String(now.getSeconds()).padStart(2, '0');
    if (dateEl) dateEl.textContent = formatDate(now);
  }
}

customElements.define('fp-clock', FpClock);
