import {
  scanContainerPath,
  scanReceiptsPath,
  scanMetaPath,
  archiveContainerPath,
  archiveReceiptsPath,
  configCategoriesPath,
} from './paths';

test('scan container and child paths', () => {
  expect(scanContainerPath(2026)).toBe('2026');
  expect(scanReceiptsPath(2026)).toBe('2026');
  expect(scanMetaPath(2026)).toBe('2026/meta');
});

test('archive container and child paths', () => {
  expect(archiveContainerPath(2025)).toBe('Receipts/Archive/FY2025');
  expect(archiveReceiptsPath(2025)).toBe('Receipts/Archive/FY2025/receipts');
});

test('config categories path', () => {
  expect(configCategoriesPath()).toBe('Receipts/config/categories.json');
});
