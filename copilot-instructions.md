# Copilot Instructions — Receipt Organizer (benjaminsimmons/receipts)

You are implementing a GitHub Pages-hosted SPA (Create React App, JavaScript) that stores all data in OneDrive via Microsoft Graph.

## Hard requirements (must follow)
1) **No backend server**. All persistence is OneDrive files/folders + client-side IndexedDB.
2) **Folder organization is by scan year**, not financial year:
   - Active: `Receipts/ScanYYYY/{receipts,meta,ocr}/`
   - Archive: `Receipts/Archive/FY####/{receipts,meta,ocr}/`
   - Config: `Receipts/config/categories.json`
3) **Financial year is stored in metadata** (`receipt.financialYear`) and used for filtering and archiving.
4) **OCR is suggest-only**:
   - OCR results populate `ocrSuggestion.*`
   - NEVER auto-write suggestions into `receipt.*` fields without explicit user action.
5) **Global categories are rename-safe**:
   - Receipts store `categoryId`
   - Category renames only edit `categories.json`
6) **Use ETag / If-Match** on writes to avoid lost updates:
   - categories.json updates must use If-Match and handle conflicts
   - metadata updates should use If-Match where practical and handle conflicts
7) **Do not bulk download receipt images**:
   - only download JPG when viewing/editing
8) **Offline image cache**:
   - cache viewed images locally in IndexedDB (Dexie)
   - key by `driveItemId + eTag` (NOT by temporary download URLs)
   - implement LRU eviction based on settings max MB
9) **Archive-by-financial-year is a MOVE operation** and must be resumable:
   - Mark meta `archive.state="archiving"` first
   - Move order: JPG → OCR (if any) → META (meta last)
   - Handle interruptions; allow retry; avoid duplicate moves

## Metadata schema (v1) — required fields
Receipt meta JSON must include at least:
- `schemaVersion: 1`
- `uuid`
- `container: { type: "scan"|"archive", name: "ScanYYYY"|"FY####" }`
- `scan: { scanDate, scanYear, sourceDeviceId }`
- `receipt: { receiptDate, financialYear, merchant, total, currency, categoryId, tags, notes }`
- `status: { ocr: {state,updatedAt,...}, categorization: {state,updatedAt} }`
- `ocrSuggestion: { merchant, receiptDate, total, currency, rawTextRef }`
- `archive: { state, targetFinancialYear, archivedAt, archiveBatchId, error? }`
- `audit: { createdAt, updatedAt, updatedByDeviceId, version }`

Rules:
- When user edits receiptDate, recompute and overwrite financialYear (Jul–Jun).
- `categorization.state` is `"categorized"` iff categoryId is non-null.

## Categories schema (v1)
`Receipts/config/categories.json`:
- `schemaVersion: 1`
- `updatedAt`
- `categories[]: { id, name, archived, order }`

## Financial year computation
Given `YYYY-MM-DD`:
- month 07–12 → FY = year + 1
- month 01–06 → FY = year

## Libraries (preferred)
- MSAL: `@azure/msal-browser`, `@azure/msal-react`
- IndexedDB: Dexie
- OCR: tesseract.js
- UI: React Bootstrap, React Router

## Coding guidelines
- Keep modules small and composable.
- Implement pure logic (FY calc, LRU eviction) in `src/utils/` and test it.
- Centralize Graph calls in `src/onedrive/graph.js` with consistent error handling.
- Store minimal listing indexes in IndexedDB for fast search.
- Always prefer stable identifiers (uuid, driveItemId, eTag).
