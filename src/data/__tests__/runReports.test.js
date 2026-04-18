// Mock idb with a simple in-memory store for tests where indexedDB isn't available
jest.mock('idb', () => {
  const store = new Map();
  return {
    openDB: async () => ({
      put: async (storeName, value, key) => { store.set(key, value); },
      get: async (storeName, key) => store.get(key),
    }),
  };
});

import { putLastReport, getLastReport } from '../runReports';

describe('runReports', () => {
  test('putLastReport and getLastReport roundtrip', async () => {
    const report = { uploadedCount: 2, duplicatesSkipped: 1, failures: [], timestamp: new Date().toISOString() };
    await putLastReport(report);
    const r = await getLastReport();
    expect(r).toBeTruthy();
    expect(r.uploadedCount).toBe(2);
    expect(r.duplicatesSkipped).toBe(1);
  });
});
