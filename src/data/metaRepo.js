// Simple meta repository storing receipt meta objects keyed by uuid.
// Uses IndexedDB when available, falls back to in-memory Map for environments without IDB.

const DB_NAME = 'receipts-local-db';
const STORE_NAME = 'meta';

let inMemory = new Map();

function supportsIDB() {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

async function openDb() {
  if (!supportsIDB()) return null;
  // Open current DB to inspect stores
  const cur = await new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const required = [STORE_NAME, 'hashIndex'];
  const missing = required.filter((s) => !cur.objectStoreNames.contains(s));
  if (!missing.length) return cur;
  const newVersion = cur.version + 1;
  cur.close();
  // Upgrade DB to create missing stores
  const upgraded = await new Promise((resolve, reject) => {
    const rq = indexedDB.open(DB_NAME, newVersion);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'uuid' });
      if (!db.objectStoreNames.contains('hashIndex')) db.createObjectStore('hashIndex', { keyPath: 'hash' });
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
  return upgraded;
}

// Expose a helper to attempt opening/upgrading the DB so UI can trigger repairs
async function ensureStores() {
  if (!supportsIDB()) return { supported: false };
  try {
    const db = await openDb();
    if (db) db.close();
    return { supported: true };
  } catch (e) {
    return { supported: true, error: String(e) };
  }
}

async function putMeta(meta) {
  if (!meta || !meta.uuid) throw new Error('meta.uuid required');
  if (!supportsIDB()) {
    inMemory.set(meta.uuid, meta);
    return meta;
  }
  const db = await openDb();
  if (!db) {
    inMemory.set(meta.uuid, meta);
    return meta;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(meta);
    req.onsuccess = () => resolve(meta);
    req.onerror = () => reject(req.error);
  });
}

async function getMeta(uuid) {
  if (!uuid) return null;
  if (!supportsIDB()) return inMemory.get(uuid) || null;
  const db = await openDb();
  if (!db) return inMemory.get(uuid) || null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(uuid);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export { putMeta, getMeta, ensureStores };

export default { putMeta, getMeta };

async function listAllMeta() {
  if (!supportsIDB()) {
    return Array.from(inMemory.values());
  }
  const db = await openDb();
  if (!db) return Array.from(inMemory.values());
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const items = [];
    const req = store.openCursor();
    req.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (cursor) {
        items.push(cursor.value);
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export { listAllMeta };
