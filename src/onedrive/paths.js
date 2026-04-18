/**
 * OneDrive path helpers for the Receipts app.
 * Keep folder naming centralized to avoid drift across features.
 */

export function scanContainerPath(scanYear) {
  if (!scanYear) throw new Error('scanYear required');
  // Store scans directly under the year folder inside the app folder (e.g. Apps/receipts-spa/2026)
  return `${String(scanYear)}`;
}

export function scanReceiptsPath(scanYear) {
  // Keep receipts directly under the year folder (no extra 'receipts' subfolder)
  return `${scanContainerPath(scanYear)}`;
}

export function scanMetaPath(scanYear) {
  return `${scanContainerPath(scanYear)}/meta`;
}

export function archiveContainerPath(financialYear) {
  if (!financialYear) throw new Error('financialYear required');
  return `Receipts/Archive/FY${String(financialYear)}`;
}

export function archiveReceiptsPath(financialYear) {
  return `${archiveContainerPath(financialYear)}/receipts`;
}

export function configCategoriesPath() {
  return `Receipts/config/categories.json`;
}
