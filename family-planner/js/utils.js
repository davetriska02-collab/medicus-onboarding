/**
 * utils.js — Shared utility functions for the Family Planner Portal
 */

/**
 * Replaces &, <, >, ", ' with safe HTML entities.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats a Date as HH:MM (24h) or h:MM am/pm (12h).
 * @param {Date} date
 * @param {'24h'|'12h'} format
 * @returns {string}
 */
export function formatTime(date, format = '24h') {
  if (!(date instanceof Date) || isNaN(date)) return '--:--';

  const h = date.getHours();
  const m = date.getMinutes();
  const mm = String(m).padStart(2, '0');

  if (format === '12h') {
    const period = h < 12 ? 'am' : 'pm';
    const h12 = h % 12 || 12;
    return `${h12}:${mm}\u202f${period}`;
  }

  return `${String(h).padStart(2, '0')}:${mm}`;
}

/** Full day names indexed by getDay() (0 = Sunday). */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Full month names indexed by getMonth(). */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
/** Short month names. */
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats a Date as "Monday 14 April 2026" (UK long format).
 * @param {Date} date
 * @returns {string}
 */
export function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  const day = DAY_NAMES[date.getDay()];
  const d = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${d} ${month} ${year}`;
}

/**
 * Formats a Date as "Mon 14 Apr" (short UK format).
 * @param {Date} date
 * @returns {string}
 */
export function formatDateShort(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  const day = DAY_NAMES[date.getDay()].slice(0, 3);
  const d = date.getDate();
  const month = MONTH_SHORT[date.getMonth()];
  return `${day} ${d} ${month}`;
}

/**
 * Returns a human-readable relative time string.
 * @param {Date} date
 * @returns {string}  e.g. "Just now", "2 min ago", "1 hour ago", "Yesterday"
 */
export function formatRelativeTime(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec} sec ago`;
  if (diffMin === 1) return '1 min ago';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr === 1) return '1 hour ago';
  if (diffHr < 24) return `${diffHr} hours ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;

  return formatDateShort(date);
}

/**
 * Returns a unique ID using crypto.randomUUID() with a Date.now() fallback.
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Standard debounce: returns a function that delays invoking fn until after ms
 * milliseconds have elapsed since the last invocation.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function debounce(fn, ms) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, ms);
  };
}

/**
 * Returns today's date as a YYYY-MM-DD string in local time.
 * @returns {string}
 */
export function getToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns the full day name for a given Date.
 * @param {Date} date
 * @returns {string}  e.g. "Monday"
 */
export function getDayName(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  return DAY_NAMES[date.getDay()];
}

/**
 * Groups an array of items by the result of keyFn, returning a Map.
 * @template T
 * @param {T[]} array
 * @param {function(T): string|number} keyFn
 * @returns {Map<string|number, T[]>}
 */
export function groupBy(array, keyFn) {
  const map = new Map();
  for (const item of array) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

/**
 * Returns a Promise that resolves after the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
