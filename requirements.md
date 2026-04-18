# Requirements

1. **OneDrive-based receipts PWA/SPA**
   - Storage location: Store files inside the OneDrive app folder (Apps/receipts-spa/) to avoid requiring broader permissions.
   - Scan-year folders: Organize receipts into year folders under the app folder (e.g. `Apps/receipts-spa/2026/<filename>`).
   - Financial year in metadata: Include metadata for the financial year in each receipt.
   - OCR suggest-only: Implement OCR (Optical Character Recognition) to suggest text without automatically saving it.
   - Global categories in `config/categories.json` inside the app folder: Maintain global categories for receipts, including ETag updates to ensure fresh data.
   - IndexedDB incremental sync: Support syncing with IndexedDB incrementally to save bandwidth and resources.
   - Offline image blob caching: Cache images as blobs for offline access.
   - Archive-by-financial-year move workflow: Implement a workflow to archive receipts by the financial year.

   Additional requirements for duplicate handling
   - **Filename collisions:** If two files share the same filename but different contents, the system must avoid silent overwrites. Store files using a canonical storage name (UUID-based) while preserving the original filename in metadata, or detect and resolve collisions by renaming.
   - **Duplicate image detection:** Detect duplicate image uploads (exact or near-duplicates) to avoid storing the same content multiple times. Use a content-hash (e.g., SHA-256) for exact duplicate detection and consider a perceptual hash (pHash) for near-duplicate detection. Store hashes in receipt metadata and in a local index to quickly detect duplicates before uploading.

   Notes on hashing approaches
   - **Content hashing (SHA-256):** Fast and reliable for exact duplicates; can be computed client-side via the Web Crypto SubtleCrypto.digest API. Prevents storing byte-identical files.
   - **Perceptual hashing (pHash / aHash / dHash):** Detects visually similar images (cropped, re-encoded, slightly edited). More compute and false-positive risk; useful to surface likely duplicates to the user for confirmation.
   - **Heuristics:** Combine filesize, dimensions, EXIF timestamp, and hashes to reduce computation and false positives.

   Shared deduplication index (cross-device)
   - **Requirement:** When cross-device or multi-user duplicate detection is required, the app must support a shared deduplication index to detect duplicates across devices.
   - **Implementation options:**
      - **Server-backed index (recommended):** a small authenticated service or serverless function that accepts content-hash registrations (contentHash -> driveItemId, uuid) and answers lookup requests. This provides fast, consistent cross-device deduplication.
      - **OneDrive-based index (alternative):** a JSON index file stored in the app folder (e.g., `Apps/receipts-spa/hash-index.json`) updated with ETag-based optimistic concurrency. Simpler but requires careful merge/conflict handling and may be slower.
   - **Privacy & security:** The shared index must store only non-PII entries (hashes and minimal metadata such as driveItemId and uuid). The service must require authentication and rate-limit updates; consider batching writes.
   - **Fallback:** If a shared index is unavailable, the app must fall back to local per-device IndexedDB hash index and continue functioning correctly.

View and Search Metadata
   - **Requirement:** Provide a metadata viewer that lets users browse uploaded receipts' metadata and search/filter by common fields (original filename, uuid, scanYear, uploadedAt, categories, and contentHash).
   - **UI:** Expose a searchable list or table in the app (`/metadata` or a Settings area) with column sorting, text search, and filters for year and category.
   - **Performance:** Support incremental loading and client-side filtering for responsiveness; serverless OneDrive-only implementations should page via Graph `children` and fetch meta JSON on demand.
   - **Permissions:** Respect the same OneDrive app-folder permissions and do not expose files outside the app folder. The metadata viewer must only read meta JSON files stored under `<year>/meta/*.json`.
   - **Export:** Allow exporting search results to CSV for user reporting or backup.

Display file from metadata view
   - **Requirement:** From the metadata viewer, allow users to open or preview the actual receipt file referenced by the meta JSON.
   - **Behavior:** Clicking an item in the metadata list must provide options to Preview (in a modal or pane), Open in new tab, and Download. Preview should support common types (images: JPEG/PNG/WebP, PDFs) using an embedded viewer; unknown types should present a safe download link.
   - **Data fetching:** Fetch file content on demand via Graph (e.g., `GET /me/drive/special/approot:/<path>:/content`) using the app's access token; lazy-load binaries to avoid excessive bandwidth.
   - **Thumbnails & performance:** Use Graph thumbnails when available or store lightweight thumbnails in metadata to speed the list view; support pagination and fetch meta JSON content on demand to keep main listing fast.
   - **Security & scope:** Never expose files outside the app folder. All file fetches must use authenticated Graph requests and respect ETag/versioning where useful. Do not render file content until permissions are verified.
   - **UX considerations:** Show loading and error states, a clear download link, and a fallback to direct download if inline preview fails. Provide an accessible keyboard-friendly modal and ensure images/PDFs can be zoomed/scrolled.

