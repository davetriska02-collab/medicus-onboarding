/**
 * fetch-cache.js — Cached fetch utility with stale-while-revalidate support.
 *
 * Uses its own lightweight IndexedDB instance ('fpCache') to avoid any
 * circular dependency with db.js.
 */

const CACHE_DB_NAME = 'fpCache';
const CACHE_DB_VERSION = 1;
const CACHE_STORE = 'cache';
const DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes

/** @type {IDBDatabase|null} */
let cacheDb = null;

/**
 * Opens (or returns the already-open) fpCache IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
async function openCacheDb() {
  if (cacheDb) return cacheDb;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);

    req.onupgradeneeded = () => {
      req.result.createObjectStore(CACHE_STORE, { keyPath: 'id' });
    };

    req.onsuccess = () => {
      cacheDb = req.result;
      // Allow re-open if the connection is closed externally
      cacheDb.onclose = () => { cacheDb = null; };
      resolve(cacheDb);
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Reads a cache entry by key.
 * @param {string} key
 * @returns {Promise<{id: string, data: *, timestamp: number}|undefined>}
 */
async function cacheGet(key) {
  const db = await openCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readonly');
    const req = tx.objectStore(CACHE_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Writes a cache entry.
 * @param {string} key
 * @param {*} data
 * @returns {Promise<void>}
 */
async function cacheSet(key, data) {
  const db = await openCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readwrite');
    const entry = { id: key, data, timestamp: Date.now() };
    const req = tx.objectStore(CACHE_STORE).put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Builds a normalised cache key from a URL string.
 * @param {string} url
 * @returns {string}
 */
function buildCacheKey(url) {
  // Strip trailing slashes and lowercase for consistency
  return url.trim().replace(/\/+$/, '').toLowerCase();
}

/**
 * Fetches a URL with IndexedDB-backed caching.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {number}  [options.ttl=900000]   Cache TTL in ms (default 15 min)
 * @param {object}  [options.headers={}]   Extra request headers
 * @param {string|null} [options.auth]     "username:password" for Basic auth
 * @param {string|null} [options.cacheKey] Override the cache key
 * @returns {Promise<*>}  Parsed JSON response. Stale responses include { stale: true }.
 */
export async function cachedFetch(url, options = {}) {
  const {
    ttl = DEFAULT_TTL,
    headers = {},
    auth = null,
    cacheKey = null,
  } = options;

  const key = cacheKey ?? buildCacheKey(url);

  // 1. Check cache
  let cached;
  try {
    cached = await cacheGet(key);
  } catch {
    cached = undefined;
  }

  const now = Date.now();
  if (cached && (now - cached.timestamp) < ttl) {
    // Fresh hit — return immediately
    return cached.data;
  }

  // 2. Build request headers
  const reqHeaders = { ...headers };
  if (auth) {
    reqHeaders['Authorization'] = `Basic ${btoa(auth)}`;
  }

  // 3. Attempt network fetch
  try {
    const response = await fetch(url, { headers: reqHeaders });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // 4. Write fresh entry to cache
    try {
      await cacheSet(key, data);
    } catch (cacheWriteErr) {
      console.warn('[cachedFetch] Failed to write cache:', cacheWriteErr);
    }

    return data;

  } catch (fetchErr) {
    // 5. Fetch failed — return stale cache if available
    if (cached) {
      console.warn(`[cachedFetch] Fetch failed for "${url}", returning stale cache.`, fetchErr);
      return { ...cached.data, stale: true };
    }

    // 6. No cache at all — re-throw
    throw fetchErr;
  }
}
