# Implementation Plan (Full Slice Plan) — benjaminsimmons/receipts

This plan is designed to work well with GitHub Copilot by keeping tasks small, testable, and aligned to `requirements.md`.

## Tech stack (fixed)
- Create React App (JavaScript, no TypeScript)
- React Router
- React Bootstrap
- MSAL (`@azure/msal-browser`, `@azure/msal-react`) for PKCE + Graph tokens
- Dexie for IndexedDB
- tesseract.js for OCR
- GitHub Pages deploy (use HashRouter for simplest routing)

## Repo structure (target)
```
src/
  app/
    App.js
    routes.js
    Layout.js
  auth/
    msalConfig.js
    authProvider.js
    useGraphToken.js
  onedrive/
    paths.js
    graph.js
    receiptsRoot.js
  data/
    db.js
    metaRepo.js
    categoriesRepo.js
    blobCacheRepo.js
    syncEngine.js
  features/
    upload/
    UploadPage.js
    uploadService.js
    uploadQueue.js
    ocr/
    OcrQueuePage.js
    ocrService.js
    categorize/
    CategorizePage.js
    ReceiptEditor.js
    categories/
    CategoriesPage.js
    archive/
    ArchivePage.js
    archiveService.js
    settings/
    SettingsPage.js
  components/
    Loading.js
    ErrorAlert.js
    ConfirmModal.js
  utils/
    fy.js
    uuid.js
    concurrency.js
```

---

## Slice A — CRA + Pages + Routing + UI Shell
**Deliverables**
- CRA app boots
- React Bootstrap wired (import bootstrap css)
- React Router (HashRouter)
- Layout + nav + placeholder pages

**Acceptance**
- `npm start` runs
- routes render: Upload / OCR / Categorize / Categories / Archive / Settings

---

## Slice B — MSAL Auth (PKCE)
**Deliverables**
- Configure MSAL with redirect URIs for local + GitHub Pages
- Login/Logout button in navbar
- Acquire token for Graph and call `/me`

**Acceptance**
- After login, show user display name
- Graph `/me` call succeeds

---

## Slice C — Graph Client (thin wrapper)
**Deliverables**
- `src/onedrive/graph.js`: wrapper around `fetch` with token
- helpers:
  - `graphGet`, `graphPut`, `graphPatch`, `graphPost`, `graphDelete`
  - parse Graph errors into readable messages

**Acceptance**
- Centralized error handling and JSON parsing works

---

## Slice D — OneDrive Paths + Ensure Folder
**Deliverables**
- `paths.js` with path builders:
  - `scanContainerPath(scanYear)` => year folder under the app root (e.g. `2026`)
  - `archiveContainerPath(fy)` => `Receipts/Archive/FY####`
- `ensureFolderPath(path)` creates folders as needed
- `getItemByPath`, `listChildrenByPath`

**Acceptance**
- Can ensure `config/categories.json` exists under the app folder
- Can list children of a folder by path

---

## Slice E — Categories (CRUD + ETag)
**Deliverables**
- Read `config/categories.json` inside the app folder; create default if missing
- Add category (stable id)
- Rename category
- Archive/unarchive category
- Update with If-Match ETag; on 412 conflict: reload, re-apply, retry

**Acceptance**
- Categories persist across refresh and devices

---

## Slice F — IndexedDB (Dexie) + Data Repos
**Deliverables**
- `db.js` defines tables:
  - `receiptMeta` (uuid, containerType, containerName, scanYear, financialYear, categoryId, merchant, receiptDate, updatedAt, driveItemId, eTag)
  - `driveMeta` (driveItemId -> eTag, lastModified)
  - `categories`
  - `settings`
  - `blobCache` (key, driveItemId, eTag, blob, sizeBytes, lastAccessed)
- Repos: metaRepo, categoriesRepo, blobCacheRepo

**Acceptance**
- Can store and query receipt metadata quickly

---

## Slice G — Metadata Sync Engine (Incremental)
**Deliverables**
- Sync `<year>/meta` into IndexedDB (e.g. `Apps/receipts-spa/2026/meta`):
  - list children (id + eTag + modified)
  - fetch changed/new JSONs only
  - remove entries missing remotely
- Same engine supports Archive containers later

**Acceptance**
- First run caches all meta
- Second run fetches near-zero if unchanged

---

## Slice H — Bulk Upload (Scan Year folders)
**Deliverables**
- Upload page:
  - choose scan year (default current year)
  - drag/drop multi-file JPGs
  - upload concurrency limit
  - progress + retry
- For each JPG:
  - uuid
  - upload to the app folder year path, e.g. `2026/<filename>` (stored under `Apps/receipts-spa/2026/filename`)
  - write meta JSON to `<year>/meta/uuid.json` (e.g. `Apps/receipts-spa/2026/meta/uuid.json`) with initial meta per requirements
  - upsert into IndexedDB

**Acceptance**
- Can upload 100+ JPGs reliably

---

## Slice I — OCR Queue (Separate from Upload)
**Deliverables**
- OCR queue page listing `ocr.state != done`
- For each:
  - download image (or reuse local reference immediately post-upload)
  - run tesseract.js
  - produce `ocrSuggestion` fields + optional raw text upload
  - update meta JSON; update IndexedDB

**Acceptance**
- OCR never auto-applies to receipt fields
- OCR state updates to done/error

---

## Slice J — Categorize / Review
**Deliverables**
- Categorize page:
  - list uncategorized
  - receipt editor: image preview + fields + suggestion “Apply” buttons
  - category picker (global categories)
  - when receiptDate changes: recompute and store financialYear
  - save meta updates with ETag; conflict handling

**Acceptance**
- User can quickly categorize and edit core fields

---

## Slice K — Offline Image Cache (On-demand)
**Deliverables**
- When viewing receipt image:
  - attempt to load from `blobCache` by `driveItemId+eTag`
  - if missing and online: download, store blob, then display
- Implement LRU eviction to max MB from settings
- Settings page:
  - cache mode Off/On-demand/Always (Always == cache whenever viewed; no prefetch)
  - max cache MB
  - clear cached images

**Acceptance**
- After viewing receipts, airplane mode still shows cached images

---

## Slice L — Archive by Financial Year (MOVE; Resumable)
**Deliverables**
- Archive page:
  - choose FY
  - show eligible count (financialYear == FY)
  - run resumable move job
- Move order per receipt:
  1) JPG
  2) OCR payload (if any)
  3) META (last)
- Update meta archive.state transitions; allow retry errors
- After move, receipt is indexed under archive container

**Acceptance**
- Can archive FY2026, refresh mid-run, resume, and complete without duplicates

---

## Slice M — PWA polish (optional)
**Deliverables**
- Add CRA-compatible service worker/PWA config
- Cache app shell for offline launch

**Acceptance**
- App installs and launches offline (metadata/image availability depends on caches)

---

## Definition of Done (overall)
- Meets `requirements.md` acceptance criteria
- No backend required
- Works on iPhone + Mac + (optional) Windows

---

## Low Priority Deliverables
These items are useful improvements or operational features that can be scheduled after the main slices are complete.

- **Chunked / resumable uploads:** support for large files (>60MB) with upload session + retry. (medium→high)
- **Per-file progress + optional parallelism:** show progress per file and optionally upload multiple files concurrently (medium).
- **Migration dry-run & rollback:** preview migration actions and provide a rollback path if needed (low→medium).
- **Fallback storage adapter:** pluggable storage backend (Azure Blob, S3, or custom API) for tenants without OneDrive (medium).
- **CI/CD pipeline:** GitHub Actions to run tests, lint, and build/deploy (low).
- **Expanded integration tests:** end-to-end tests that mock MSAL/Graph flows and validate upload→OCR→categorize pathways (medium).
- **Accessibility audit & fixes:** keyboard navigation, ARIA attributes, focus management (low).
- **Error reporting & analytics:** integrate Sentry/Telemetry for production error tracking and usage metrics (low).
- **Localization readiness:** extract UI strings and support at least one extra locale (low).
- **Admin diagnostics page:** show OneDrive status, quota, recent errors, and a migration dry-run report (low→medium).

These deliverables are intentionally low priority — they improve robustness and operations but are not required for the core user flows.
