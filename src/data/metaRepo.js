// Simple meta repository storing receipt meta objects keyed by uuid.
// Uses IndexedDB when available, falls back to in-memory Map for environments without IDB.

const DB_NAME = 'receipts-local-db';
const STORE_NAME = 'meta';

let inMemory = new Map();

function supportsIDB() {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!supportsIDB()) return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'uuid' });
      }
      if (!db.objectStoreNames.contains('hashIndex')) {
        db.createObjectStore('hashIndex', { keyPath: 'hash' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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

export { putMeta, getMeta };

export default { putMeta, getMeta };
