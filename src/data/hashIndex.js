// Simple hash index for mapping contentHash -> { driveItemId, uuid }
// Uses IndexedDB when available, otherwise falls back to in-memory Map (useful for tests).

const DB_NAME = 'receipts-local-db';
const STORE_NAME = 'hashIndex';

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
        db.createObjectStore(STORE_NAME, { keyPath: 'hash' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getByHash(hash) {
  if (!hash) return null;
  if (!supportsIDB()) {
    return inMemory.get(hash) || null;
  }
  const db = await openDb();
  if (!db) return inMemory.get(hash) || null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(hash);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function putHash(hash, meta) {
  if (!hash) throw new Error('hash required');
  const record = Object.assign({ hash }, meta || {});
  if (!supportsIDB()) {
    inMemory.set(hash, record);
    return record;
  }
  const db = await openDb();
  if (!db) {
    inMemory.set(hash, record);
    return record;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export { getByHash, putHash };

export default { getByHash, putHash };
