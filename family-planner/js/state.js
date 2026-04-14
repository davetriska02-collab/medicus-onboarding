/**
 * state.js — Central event bus and reactive state store for the Family Planner Portal
 */

import { debounce } from './utils.js';

const LS_KEY = 'fp_state';

// ---------------------------------------------------------------------------
// EventBus
// ---------------------------------------------------------------------------

/**
 * A thin wrapper around EventTarget that adds emit() and returns unsubscribe
 * functions from on().
 */
export class EventBus extends EventTarget {
  /**
   * Dispatches a CustomEvent with the given name and detail payload.
   * @param {string} event  — event name
   * @param {*} detail      — arbitrary payload attached to event.detail
   */
  emit(event, detail) {
    this.dispatchEvent(new CustomEvent(event, { detail, bubbles: false }));
  }

  /**
   * Subscribes to an event. Returns an unsubscribe function.
   * @param {string} event
   * @param {EventListenerOrEventListenerObject} callback
   * @returns {() => void}
   */
  on(event, callback) {
    this.addEventListener(event, callback);
    return () => this.removeEventListener(event, callback);
  }

  /**
   * Unsubscribes a previously-registered callback.
   * @param {string} event
   * @param {EventListenerOrEventListenerObject} callback
   */
  off(event, callback) {
    this.removeEventListener(event, callback);
  }
}

/** Singleton event bus used throughout the app. */
export const eventBus = new EventBus();

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Simple reactive key-value store.
 *
 * - State is persisted to localStorage under 'fp_state' (debounced 500 ms).
 * - Every set() emits a `state:${key}` event on the shared eventBus.
 */
export class Store {
  /**
   * @param {Record<string, *>} initial  — default values (merged with persisted state)
   */
  constructor(initial = {}) {
    /** @type {Record<string, *>} */
    this._state = { ...initial };

    // Merge persisted state on top of defaults
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const persisted = JSON.parse(raw);
        if (persisted && typeof persisted === 'object') {
          this._state = { ...this._state, ...persisted };
        }
      }
    } catch (err) {
      console.warn('[Store] Failed to load persisted state:', err);
    }

    // Debounced persistence to avoid thrashing localStorage
    this._persist = debounce(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(this._state));
      } catch (err) {
        console.warn('[Store] Failed to persist state:', err);
      }
    }, 500);
  }

  /**
   * Returns the value for a key (or undefined if not set).
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    return this._state[key];
  }

  /**
   * Sets a value, persists state, and emits `state:${key}` on eventBus.
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    this._state[key] = value;
    this._persist();
    eventBus.emit(`state:${key}`, { key, value });
  }

  /**
   * Returns a shallow copy of the entire state object.
   * @returns {Record<string, *>}
   */
  getAll() {
    return { ...this._state };
  }

  /**
   * Listens for changes to a specific key. Returns an unsubscribe function.
   * The callback receives the CustomEvent (event.detail = { key, value }).
   * @param {string} key
   * @param {function(CustomEvent): void} callback
   * @returns {() => void}
   */
  subscribe(key, callback) {
    return eventBus.on(`state:${key}`, callback);
  }
}

/** Singleton state store used throughout the app. */
export const store = new Store();
