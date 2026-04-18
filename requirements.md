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

