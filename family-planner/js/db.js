/**
 * db.js — IndexedDB wrapper for the Family Planner Portal
 */

const DB_NAME_DEFAULT = 'familyPlanner';
const DB_VERSION_DEFAULT = 1;

/**
 * Object stores and their index definitions.
 * shape: { name, indexes: [{ name, keyPath, options }] }
 */
const STORES = [
  {
    name: 'chore_definitions',
    indexes: [],
  },
  {
    name: 'chore_completions',
    indexes: [
      { name: 'by_date', keyPath: 'date', options: { unique: false } },
    ],
  },
  {
    name: 'shopping_items',
    indexes: [
      { name: 'by_checked', keyPath: 'checked', options: { unique: false } },
    ],
  },
  {
    name: 'messages',
    indexes: [],
  },
  {
    name: 'family_members',
    indexes: [],
  },
  {
    name: 'calendar_events',
    indexes: [],
  },
];

export class DB {
  /**
   * @param {string} dbName
   * @param {number} version
   */
  constructor(dbName = DB_NAME_DEFAULT, version = DB_VERSION_DEFAULT) {
    this._dbName = dbName;
    this._version = version;
    /** @type {IDBDatabase|null} */
    this._db = null;
    /** @type {Promise<IDBDatabase>|null} */
    this._openPromise = null;
  }

  /**
   * Opens the database and creates/upgrades object stores as needed.
   * Idempotent — safe to call multiple times.
   * @returns {Promise<IDBDatabase>}
   */
  open() {
    if (this._db) return Promise.resolve(this._db);
    if (this._openPromise) return this._openPromise;

    this._openPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(this._dbName, this._version);

      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        for (const storeDef of STORES) {
          let store;
          if (!db.objectStoreNames.contains(storeDef.name)) {
            store = db.createObjectStore(storeDef.name, {
              keyPath: 'id',
              autoIncrement: false,
            });
          } else {
            store = event.target.transaction.objectStore(storeDef.name);
          }
          for (const idx of storeDef.indexes) {
            if (!store.indexNames.contains(idx.name)) {
              store.createIndex(idx.name, idx.keyPath, idx.options);
            }
          }
        }
      };

      req.onsuccess = () => {
        this._db = req.result;

        // If the connection is closed externally, reset so next call reopens it
        this._db.onclose = () => {
          this._db = null;
          this._openPromise = null;
        };

        resolve(this._db);
      };

      req.onerror = () => {
        this._openPromise = null;
        reject(req.error);
      };

      req.onblocked = () => {
        console.warn('[DB] open blocked — close other tabs using this database');
      };
    });

    return this._openPromise;
  }

  /**
   * Ensures the database is open before performing an operation.
   * @returns {Promise<IDBDatabase>}
   */
  async _ready() {
    if (this._db) return this._db;
    return this.open();
  }

  /**
   * Returns a single record by key, or undefined if not found.
   * @param {string} store
   * @param {string} key
   * @returns {Promise<any>}
   */
  async get(store, key) {
    const db = await this._ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Returns all records in a store.
   * @param {string} store
   * @returns {Promise<any[]>}
   */
  async getAll(store) {
    const db = await this._ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Inserts or updates a record. The value object must have an .id property.
   * @param {string} store
   * @param {object} value
   * @returns {Promise<void>}
   */
  async put(store, value) {
    if (!value || value.id === undefined || value.id === null) {
      throw new Error(`[DB] put() requires value.id — store: ${store}`);
    }
    const db = await this._ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Deletes a record by key.
   * @param {string} store
   * @param {string} key
   * @returns {Promise<void>}
   */
  async delete(store, key) {
    const db = await this._ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Removes all records from a store.
   * @param {string} store
   * @returns {Promise<void>}
   */
  async clear(store) {
    const db = await this._ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Returns the number of records in a store.
   * @param {string} store
   * @returns {Promise<number>}
   */
  async count(store) {
    const db = await this._ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}

/** Singleton DB instance used throughout the app. */
export const db = new DB();
