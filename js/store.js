// ─────────────────────────────────────────────────────────────────────────────
// Medicus Onboarding — data layer
//
// Two storage modes:
//   local   progress lives in this browser's localStorage (single device)
//   shared  progress lives in a JSON file the practice chooses — typically
//           medicus-onboarding-data.json in the same shared-drive folder as
//           the app — via the File System Access API (Edge/Chrome).
//
// Multi-user safety: every mutation stamps person.updated; saves re-read the
// shared file and merge person-by-person (newest wins), so two people working
// on their own records never overwrite each other.
//
// Auth: each person sets a PIN on first login; a practice admin passcode
// unlocks the training-lead view. Hashes only (SHA-256) are stored. This is
// deterrence against casual nosiness, not real security — the data file is
// readable by anyone with access to the folder. No patient data is stored.
// ─────────────────────────────────────────────────────────────────────────────

const STORE_VERSION = 3;
const LOCAL_KEY = "medicus-onboarding-v2"; // unchanged so existing data migrates
const SESSION_KEY = "medicus-session";
const SAVE_DEBOUNCE_MS = 400;

let store = blankStore();
let storageMode = "local";        // 'local' | 'shared'
let sharedHandle = null;          // FileSystemFileHandle
let needsReconnect = false;       // handle saved but permission not yet granted
let saveTimer = null;

function blankStore() {
  return { version: STORE_VERSION, practice: null, people: {}, order: [] };
}

function migrate(data) {
  if (!data || typeof data !== "object") return blankStore();
  if (!data.version) {
    // v2: { people, order } with no auth fields
    data = { version: STORE_VERSION, practice: null, people: data.people || {}, order: data.order || [] };
  }
  for (const p of Object.values(data.people)) {
    if (!("pinHash" in p)) p.pinHash = null;
    if (!p.updated) p.updated = p.created || Date.now();
  }
  if (!Array.isArray(data.order)) data.order = Object.keys(data.people);
  return data;
}

// ── Hashing ─────────────────────────────────────────────────────────────────

async function hashSecret(text) {
  const data = new TextEncoder().encode("medicus-onboarding|" + text);
  if (crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // non-secure-context fallback (FNV-1a) — deterrence only
  let h = 0x811c9dc5;
  for (const b of data) { h ^= b; h = Math.imul(h, 0x01000193); }
  return "fnv" + (h >>> 0).toString(16);
}

// ── IndexedDB (persists the shared-file handle between sessions) ────────────

function idb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open("medicus-onboarding", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const tx = db.transaction("kv").objectStore("kv").get(key);
      tx.onsuccess = () => res(tx.result);
      tx.onerror = () => res(undefined);
    });
  } catch (e) { return undefined; }
}

async function idbSet(key, val) {
  try {
    const db = await idb();
    await new Promise((res) => {
      const tx = db.transaction("kv", "readwrite").objectStore("kv").put(val, key);
      tx.onsuccess = res;
      tx.onerror = res;
    });
  } catch (e) { /* non-fatal */ }
}

// ── Merge ───────────────────────────────────────────────────────────────────

function mergeStores(base, mine) {
  const out = blankStore();
  // practice settings: newest wins
  const bp = base.practice, mp = mine.practice;
  out.practice = !bp ? mp : !mp ? bp : ((mp.updated || 0) >= (bp.updated || 0) ? mp : bp);
  // people: person-level newest-wins
  const ids = new Set([...Object.keys(base.people), ...Object.keys(mine.people)]);
  for (const id of ids) {
    const a = base.people[id], b = mine.people[id];
    out.people[id] = !a ? b : !b ? a : ((b.updated || 0) >= (a.updated || 0) ? b : a);
  }
  out.order = [...new Set([...base.order, ...mine.order])].filter((id) => out.people[id]);
  // explicit deletions: a person missing from `mine` but present in `base`
  // stays (we can't distinguish delete from not-yet-seen) — deletions are
  // handled by tombstones below
  const tombs = { ...(base.tombstones || {}), ...(mine.tombstones || {}) };
  for (const [id, ts] of Object.entries(tombs)) {
    if (out.people[id] && (out.people[id].updated || 0) <= ts) {
      delete out.people[id];
      out.order = out.order.filter((x) => x !== id);
    }
  }
  if (Object.keys(tombs).length) out.tombstones = tombs;
  return out;
}

// ── Shared-file IO ──────────────────────────────────────────────────────────

async function readSharedFile() {
  const file = await sharedHandle.getFile();
  const text = await file.text();
  return migrate(text.trim() ? JSON.parse(text) : null);
}

async function writeSharedFile(data) {
  const w = await sharedHandle.createWritable();
  await w.write(JSON.stringify(data, null, 1));
  await w.close();
}

async function refreshFromShared() {
  if (storageMode !== "shared" || !sharedHandle || needsReconnect) return false;
  try {
    store = mergeStores(await readSharedFile(), store);
    return true;
  } catch (e) {
    console.warn("Shared file read failed:", e);
    return false;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

async function initStorage() {
  const handle = await idbGet("dataFile");
  if (handle && handle.queryPermission) {
    sharedHandle = handle;
    storageMode = "shared";
    const perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm === "granted") {
      try {
        store = await readSharedFile();
        needsReconnect = false;
        return;
      } catch (e) {
        needsReconnect = true; // file moved/locked — let the user re-pick
        return;
      }
    }
    needsReconnect = true; // permission needs a click (browser rule)
    return;
  }
  // local mode
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    store = migrate(raw ? JSON.parse(raw) : null);
  } catch (e) {
    store = blankStore();
  }
}

// Called from a click: re-grant permission on the remembered handle.
async function reconnectShared() {
  const perm = await sharedHandle.requestPermission({ mode: "readwrite" });
  if (perm !== "granted") return false;
  store = await readSharedFile();
  needsReconnect = false;
  return true;
}

// Called from a click: create or open the practice data file.
// create=true → save-picker (new file); false → open-picker (existing file).
async function connectSharedFile(create) {
  const handle = create
    ? await showSaveFilePicker({
        suggestedName: "medicus-onboarding-data.json",
        types: [{ description: "Medicus onboarding data", accept: { "application/json": [".json"] } }],
      })
    : (await showOpenFilePicker({
        types: [{ description: "Medicus onboarding data", accept: { "application/json": [".json"] } }],
      }))[0];
  sharedHandle = handle;
  storageMode = "shared";
  needsReconnect = false;
  if (create) {
    await writeSharedFile(store);
  } else {
    store = mergeStores(await readSharedFile(), store);
    await writeSharedFile(store);
  }
  await idbSet("dataFile", handle);
}

function supportsSharedMode() {
  return typeof window.showSaveFilePicker === "function";
}

function saveStore() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, SAVE_DEBOUNCE_MS);
}

async function persistNow() {
  if (storageMode === "shared" && sharedHandle && !needsReconnect) {
    try {
      store = mergeStores(await readSharedFile(), store);
      await writeSharedFile(store);
    } catch (e) {
      console.warn("Shared save failed, caching locally:", e);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
      if (typeof toast === "function") toast("Couldn't reach the shared file — saved on this device", "err");
    }
  } else {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
  }
}

// ── People ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

function getPerson(id) { return store.people[id] || null; }

function touch(person) { person.updated = Date.now(); }

function newPerson(name, role) {
  const p = {
    id: uid(), name: name.trim(), role, created: Date.now(), updated: Date.now(), pinHash: null,
    progress: { read: {}, wt: {}, quiz: {}, comps: {}, signoff: {}, assessment: null },
  };
  store.people[p.id] = p;
  store.order.push(p.id);
  saveStore();
  return p;
}

function deletePerson(id) {
  delete store.people[id];
  store.order = store.order.filter((x) => x !== id);
  store.tombstones = store.tombstones || {};
  store.tombstones[id] = Date.now();
  saveStore();
}

// ── Session / auth ──────────────────────────────────────────────────────────
// Sessions are per-tab (sessionStorage): right for shared practice machines —
// closing the tab logs you out.

function session() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
}

function setSession(s) {
  if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else sessionStorage.removeItem(SESSION_KEY);
}

function isAdmin() { const s = session(); return s && s.kind === "admin"; }
function sessionUser() { const s = session(); return s && s.kind === "user" ? getPerson(s.id) : null; }

window.addEventListener("focus", async () => {
  if (storageMode === "shared" && !needsReconnect) {
    if (await refreshFromShared() && typeof route === "function") route();
  }
});

Object.assign(window, {
  blankStore, initStorage, reconnectShared, connectSharedFile, supportsSharedMode,
  saveStore, persistNow, refreshFromShared, hashSecret,
  uid, getPerson, touch, newPerson, deletePerson,
  session, setSession, isAdmin, sessionUser,
});
