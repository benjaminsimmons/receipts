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

