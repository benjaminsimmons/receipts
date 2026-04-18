import React, { useState } from 'react';
import { useGraphClient } from '../../services/graphClient';
import { scanReceiptsPath } from '../../onedrive/paths';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from '../../auth/msalConfig';
import { computeSHA256 } from '../../utils/hash';
import { getByHash, putHash } from '../../data/hashIndex';
import { putMeta } from '../../data/metaRepo';
import useGraphToken from '../../auth/useGraphToken';
import { fetchSharedIndex, updateSharedIndex } from '../../data/sharedIndex';
import { putLastReport } from '../../data/runReports';
import { Toast, Modal, Button } from 'react-bootstrap';

export default function UploadPage() {
  const { uploadFile } = useGraphClient();
  const { acquireToken } = useGraphToken();
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [duplicatesSkipped, setDuplicatesSkipped] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [lastReport, setLastReport] = useState(null);

  const handleChange = (e) => {
    setFiles(e.target.files ? Array.from(e.target.files) : []);
    setStatus('idle');
    setDuplicatesSkipped(0);
  };

  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const handleUpload = async () => {
    if (!files || files.length === 0) return;
    setStatus('uploading');

    // Ensure the user is signed in via the app's sign-in flow.
    if (!isAuthenticated) {
      try {
        await instance.loginPopup(loginRequest);
      } catch (e) {
        // popup failed (blocked or environment); fall back to redirect flow
        console.warn('loginPopup failed, falling back to loginRedirect', e);
        try {
          // loginRedirect will navigate away; awaiting keeps behavior consistent in tests
          await instance.loginRedirect(loginRequest);
          return;
        } catch (e2) {
          console.error('loginRedirect failed', e2);
          setStatus(`error: login failed`);
          return;
        }
      }
    }

    const year = new Date().getFullYear();
    let sharedIndex = {};
    let sharedETag = null;
    let sharedModified = false;
    let uploadedCount = 0;
    const failures = [];

    // try to load shared index from OneDrive (if available)
    try {
      const si = await fetchSharedIndex(acquireToken);
      if (si && si.index) {
        sharedIndex = si.index;
        sharedETag = si.eTag;
      }
    } catch (e) {
      // accept failure to read shared index and continue with local-only dedupe
      // eslint-disable-next-line no-console
      console.warn('fetchSharedIndex failed; continuing without shared index', e);
    }

    try {
      for (let i = 0; i < files.length; i += 1) {
        const f = files[i];
        setStatus(`uploading ${i + 1}/${files.length}`);

        // compute content hash
        const contentHash = await computeSHA256(f);

        // check local index for existing file
        const existing = await getByHash(contentHash);
        if (existing && existing.driveItemId) {
          setDuplicatesSkipped((n) => n + 1);
          continue;
        }

        // check shared index (cross-device) for existing file
        if (sharedIndex && sharedIndex[contentHash] && sharedIndex[contentHash].driveItemId) {
          // add to local index for faster future checks
          try {
            await putHash(contentHash, { driveItemId: sharedIndex[contentHash].driveItemId, uuid: sharedIndex[contentHash].uuid });
          } catch (e2) {
            // ignore non-fatal error
            // eslint-disable-next-line no-console
            console.warn('putHash failed after shared-index hit', e2);
          }
          setDuplicatesSkipped((n) => n + 1);
          continue;
        }

        // No existing hash: upload file and meta, then record mapping
        try {
          const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2,11)}`;
          const destPath = `${scanReceiptsPath(year)}/${uuid}${getExtension(f.name)}`;
          const uploadResp = await uploadFile(destPath, f);

          const meta = {
            uuid,
            originalFileName: f.name,
            scanYear: year,
            uploadedAt: new Date().toISOString(),
            driveItemId: uploadResp && uploadResp.id ? uploadResp.id : null,
            eTag: uploadResp && uploadResp.eTag ? uploadResp.eTag : null,
            contentHash,
          };

          const metaPath = `${scanReceiptsPath(year)}/meta/${uuid}.json`;
          const metaBlob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' });
          await uploadFile(metaPath, metaBlob, { headers: { 'Content-Type': 'application/json' } });

          // record hash -> driveItemId + uuid locally
          await putHash(contentHash, { driveItemId: meta.driveItemId, uuid });
          // add to shared index map to write back later
          try {
            sharedIndex[contentHash] = { driveItemId: meta.driveItemId, uuid };
            sharedModified = true;
          } catch (e3) {
            // ignore non-fatal
            // eslint-disable-next-line no-console
            console.warn('sharedIndex update failed', e3);
          }
          // upsert meta into local IndexedDB
          try {
            await putMeta(meta);
          } catch (e) {
            // non-fatal: log and continue
            // eslint-disable-next-line no-console
            console.warn('putMeta failed', e);
          }
          uploadedCount += 1;
        } catch (errInner) {
          failures.push({ fileName: f.name, error: String(errInner && errInner.message ? errInner.message : errInner) });
        }
      }

      // attempt to write back shared index if we changed it
      if (sharedModified) {
        try {
          await updateSharedIndex(acquireToken, sharedIndex, sharedETag);
        } catch (e) {
          // non-fatal: log and continue
          // eslint-disable-next-line no-console
          console.warn('updateSharedIndex failed', e);
        }
      }

      setStatus('done');
      const report = { uploadedCount, duplicatesSkipped, failures, timestamp: new Date().toISOString() };
      try {
        await putLastReport(report);
      } catch (e) {
        // ignore persistence failures
        // eslint-disable-next-line no-console
        console.warn('putLastReport failed', e);
      }
      setLastReport(report);
      setShowToast(true);
    } catch (e) {
      console.error('upload error', e);
      const body = e && e.body ? ` - ${String(e.body).slice(0, 200)}` : '';
      setStatus(`error: ${e.message}${body}`);
    }
  };

  function getExtension(name) {
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx) : '';
  }

  return (
    <div>
      <h2>Upload</h2>
      <p>Select a receipt image or PDF to upload to OneDrive.</p>
      <input type="file" onChange={handleChange} multiple />
      <button onClick={handleUpload} disabled={!(files && files.length) || status === 'uploading'}>
        Upload
      </button>
      <div>
        <strong>Duplicates skipped:</strong> {duplicatesSkipped}
      </div>
      <div>
        <strong>Status:</strong> {status}
      </div>
      <Toast
        show={showToast}
        onClose={() => setShowToast(false)}
        style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1060 }}
      >
        <Toast.Header>
          <strong className="me-auto">Upload Complete</strong>
        </Toast.Header>
        <Toast.Body>
          Uploaded: {lastReport ? lastReport.uploadedCount : 0} — Duplicates: {duplicatesSkipped}
          <div className="mt-2">
            <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>Details</Button>
          </div>
        </Toast.Body>
      </Toast>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Last Run Report</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {lastReport ? (
            <div>
              <p><strong>Uploaded:</strong> {lastReport.uploadedCount}</p>
              <p><strong>Duplicates skipped:</strong> {lastReport.duplicatesSkipped}</p>
              <p><strong>Failures:</strong></p>
              {lastReport.failures && lastReport.failures.length ? (
                <ul>
                  {lastReport.failures.map((f, idx) => (
                    <li key={idx}>{f.fileName}: {f.error}</li>
                  ))}
                </ul>
              ) : <p>None</p>}
              <p><small>{lastReport.timestamp}</small></p>
            </div>
          ) : (
            <p>No report available.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
