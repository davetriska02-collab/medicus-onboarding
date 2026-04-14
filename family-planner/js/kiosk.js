/**
 * kiosk.js — Screensaver and fullscreen management for the Family Planner Portal.
 *
 * After a configurable idle timeout, a full-screen clock overlay is shown.
 * The clock repositions itself every 30 seconds to prevent OLED/LCD burn-in.
 * Any user interaction (touch, mouse, keyboard) dismisses the screensaver and
 * resets the idle timer.
 */

/** How often (ms) the screensaver clock repositions itself. */
const REPOSITION_INTERVAL_MS = 30_000;

/** Minimum distance from each edge (as a fraction of the safe dimension). */
const EDGE_GUARD = 0.1;

export class Kiosk {
  /**
   * @param {number} timeoutMinutes  Idle time before screensaver activates (default 5).
   */
  constructor(timeoutMinutes = 5) {
    this._timeoutMs = timeoutMinutes * 60 * 1000;

    /** @type {number|null} */
    this._idleTimer = null;

    /** @type {number|null} */
    this._repositionTimer = null;

    /** @type {HTMLElement|null} */
    this._overlay = null;

    /** @type {HTMLElement|null} */
    this._clockEl = null;

    /** @type {number|null} */
    this._tickTimer = null;

    // Bind so we can remove the same function references later
    this._handleActivity = this._handleActivity.bind(this);
    this._handleOverlayTap = this._handleOverlayTap.bind(this);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Starts the idle timer and attaches activity listeners.
   * Call once during app initialisation.
   */
  init() {
    const activityEvents = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll'];
    for (const evt of activityEvents) {
      window.addEventListener(evt, this._handleActivity, { passive: true });
    }

    this.resetTimer();
  }

  /** Resets the idle countdown. */
  resetTimer() {
    if (this._idleTimer !== null) {
      clearTimeout(this._idleTimer);
    }
    this._idleTimer = setTimeout(() => this.showScreensaver(), this._timeoutMs);
  }

  /** Shows the fullscreen screensaver overlay. */
  showScreensaver() {
    if (this._overlay) return; // Already visible

    // Build the overlay element
    const overlay = document.createElement('div');
    overlay.id = 'fp-screensaver';
    overlay.setAttribute('role', 'presentation');
    overlay.setAttribute('aria-label', 'Screensaver — tap to dismiss');

    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '9999',
      background: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      // Prevent text selection on repeated taps
      userSelect: 'none',
      WebkitUserSelect: 'none',
    });

    // Clock container — absolutely positioned so we can move it around
    const clockEl = document.createElement('div');
    clockEl.setAttribute('aria-live', 'off');
    Object.assign(clockEl.style, {
      position: 'absolute',
      textAlign: 'center',
      color: '#fff',
      // Smooth repositioning
      transition: 'top 1s ease, left 1s ease',
    });

    const timeEl = document.createElement('div');
    Object.assign(timeEl.style, {
      fontSize: 'clamp(4rem, 15vw, 10rem)',
      fontWeight: '200',
      letterSpacing: '0.05em',
      lineHeight: '1',
      fontFamily: 'system-ui, sans-serif',
    });

    const dateEl = document.createElement('div');
    Object.assign(dateEl.style, {
      fontSize: 'clamp(1rem, 3vw, 2rem)',
      fontWeight: '300',
      marginTop: '0.5em',
      opacity: '0.7',
      fontFamily: 'system-ui, sans-serif',
    });

    clockEl.appendChild(timeEl);
    clockEl.appendChild(dateEl);
    overlay.appendChild(clockEl);

    this._overlay = overlay;
    this._clockEl = clockEl;
    this._timeEl = timeEl;
    this._dateEl = dateEl;

    document.body.appendChild(overlay);

    // Render clock immediately
    this._tickClock();
    this._tickTimer = setInterval(() => this._tickClock(), 1000);

    // Initial position
    this._repositionClock();
    this._repositionTimer = setInterval(() => this._repositionClock(), REPOSITION_INTERVAL_MS);

    // Dismiss on any interaction with the overlay
    overlay.addEventListener('click', this._handleOverlayTap);
    overlay.addEventListener('touchstart', this._handleOverlayTap, { passive: true });
    overlay.addEventListener('keydown', this._handleOverlayTap);
  }

  /** Hides the screensaver overlay and restarts the idle timer. */
  hideScreensaver() {
    if (!this._overlay) return;

    if (this._tickTimer !== null) {
      clearInterval(this._tickTimer);
      this._tickTimer = null;
    }
    if (this._repositionTimer !== null) {
      clearInterval(this._repositionTimer);
      this._repositionTimer = null;
    }

    this._overlay.removeEventListener('click', this._handleOverlayTap);
    this._overlay.removeEventListener('touchstart', this._handleOverlayTap);
    this._overlay.removeEventListener('keydown', this._handleOverlayTap);

    this._overlay.remove();
    this._overlay = null;
    this._clockEl = null;
    this._timeEl = null;
    this._dateEl = null;

    this.resetTimer();
  }

  /**
   * Requests (or exits) fullscreen mode for the document element.
   * @returns {Promise<void>}
   */
  async toggleFullscreen() {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      } catch (err) {
        console.warn('[Kiosk] Fullscreen request failed:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.warn('[Kiosk] Exit fullscreen failed:', err);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Any user activity resets the timer (and hides the screensaver if active). */
  _handleActivity() {
    if (this._overlay) {
      this.hideScreensaver();
    } else {
      this.resetTimer();
    }
  }

  /** Tap/click on the overlay dismisses the screensaver. */
  _handleOverlayTap(event) {
    // Prevent the activity handler from also firing a double reset
    event.stopPropagation();
    this.hideScreensaver();
  }

  /** Updates the time and date text inside the screensaver clock. */
  _tickClock() {
    if (!this._timeEl || !this._dateEl) return;

    const now = new Date();

    // Time: HH:MM (24-hour)
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    this._timeEl.textContent = `${hh}:${mm}`;

    // Date: "Monday 14 April 2026"
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    this._dateEl.textContent =
      `${DAY_NAMES[now.getDay()]} ${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  }

  /**
   * Moves the clock to a random position within safe bounds to prevent burn-in.
   * Uses CSS top/left on the absolutely-positioned clock element.
   */
  _repositionClock() {
    if (!this._clockEl || !this._overlay) return;

    // Measure available space (allow the clock to take up ~40% of each axis)
    const vw = this._overlay.clientWidth || window.innerWidth;
    const vh = this._overlay.clientHeight || window.innerHeight;

    const minFrac = EDGE_GUARD;
    const maxFrac = 1 - EDGE_GUARD - 0.25; // leave 25% for clock width/height estimate

    const leftPct = (minFrac + Math.random() * (maxFrac - minFrac)) * 100;
    const topPct  = (minFrac + Math.random() * (maxFrac - minFrac)) * 100;

    // Clamp just in case
    const safeLeft = Math.max(5, Math.min(65, leftPct));
    const safeTop  = Math.max(5, Math.min(65, topPct));

    this._clockEl.style.left = `${safeLeft}%`;
    this._clockEl.style.top  = `${safeTop}%`;

    // Remove flex centering from overlay so absolute positioning takes effect
    this._overlay.style.alignItems = 'unset';
    this._overlay.style.justifyContent = 'unset';

    // Suppress unused variable warning for vw/vh used only for documentation
    void vw; void vh;
  }
}

/** Singleton Kiosk instance. */
export const kiosk = new Kiosk();
