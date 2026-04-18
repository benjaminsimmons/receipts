// Simple IndexedDB-backed last-run report storage with in-memory fallback
import { openDB } from 'idb';

const DB_NAME = 'receipts-db';
const STORE = 'runReports';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    },
  });
}

export async function putLastReport(report) {
  const db = await getDB();
  await db.put(STORE, report, 'last');
}

export async function getLastReport() {
  const db = await getDB();
  const r = await db.get(STORE, 'last');
  return r || null;
}

export default { putLastReport, getLastReport };
