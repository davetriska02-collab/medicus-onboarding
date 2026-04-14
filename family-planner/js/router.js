/**
 * router.js — Simple hash-based router for the Family Planner Portal.
 *
 * Views are toggled by the .active class on elements with [data-view].
 * Nav buttons receive .active when their [data-nav] matches the current hash.
 */

const DEFAULT_HASH = '#dashboard';

export class Router {
  constructor() {
    /** @type {Map<string, {viewId: string, title: string}>} */
    this._routes = new Map();

    /** @type {string} */
    this._current = DEFAULT_HASH;

    this._onHashChange = this._onHashChange.bind(this);
  }

  /**
   * Registers a route.
   * @param {string} hash    — e.g. '#dashboard'
   * @param {string} viewId  — value of [data-view] attribute on the view element
   * @param {string} title   — document title to set when active
   */
  register(hash, viewId, title) {
    this._routes.set(hash, { viewId, title });
  }

  /**
   * Programmatically navigates to a hash, updating the URL and DOM.
   * @param {string} hash
   */
  navigate(hash) {
    const target = this._routes.has(hash) ? hash : DEFAULT_HASH;

    // Update the browser URL (triggers hashchange which calls _activate)
    if (window.location.hash !== target) {
      window.location.hash = target;
    } else {
      // Hash is already set — activate directly (no hashchange will fire)
      this._activate(target);
    }
  }

  /**
   * The currently active hash.
   * @returns {string}
   */
  get current() {
    return this._current;
  }

  /**
   * Starts listening for hashchange events and handles the initial hash.
   * Call once after routes are registered and the DOM is ready.
   */
  init() {
    window.addEventListener('hashchange', this._onHashChange);

    // Resolve the initial hash
    const initialHash = window.location.hash || DEFAULT_HASH;
    const resolvedHash = this._routes.has(initialHash) ? initialHash : DEFAULT_HASH;

    // Set the hash (navigate will fire hashchange or call _activate directly)
    this.navigate(resolvedHash);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** @param {HashChangeEvent} _event */
  _onHashChange(_event) {
    const hash = window.location.hash || DEFAULT_HASH;
    this._activate(hash);
  }

  /**
   * Updates the DOM to reflect the active route.
   * @param {string} hash
   */
  _activate(hash) {
    const route = this._routes.get(hash);
    if (!route) {
      // Unknown hash — fall back to default
      this.navigate(DEFAULT_HASH);
      return;
    }

    this._current = hash;

    // Update document title
    if (route.title) {
      document.title = route.title;
    }

    // Toggle .active on all [data-view] elements
    const views = document.querySelectorAll('[data-view]');
    for (const view of views) {
      view.classList.toggle('active', view.dataset.view === route.viewId);
    }

    // Toggle .active on all [data-nav] elements (nav buttons, links, etc.)
    const navItems = document.querySelectorAll('[data-nav]');
    for (const item of navItems) {
      item.classList.toggle('active', item.dataset.nav === hash);
    }
  }
}

/** Singleton router used throughout the app. */
export const router = new Router();
