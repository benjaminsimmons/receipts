// Simple hash index for mapping contentHash -> { driveItemId, uuid }
// Uses IndexedDB when available, otherwise falls back to in-memory Map (useful for tests).

const DB_NAME = 'receipts-local-db';
const STORE_NAME = 'hashIndex';

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
  const missing = !cur.objectStoreNames.contains(STORE_NAME);
  if (!missing) return cur;
  const newVersion = cur.version + 1;
  cur.close();
  // Upgrade DB to create missing store
  const upgraded = await new Promise((resolve, reject) => {
    const rq = indexedDB.open(DB_NAME, newVersion);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'hash' });
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
  return upgraded;
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

async function listAllHashes() {
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

export { listAllHashes };
