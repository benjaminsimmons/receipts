import React, { useState, useEffect } from 'react';
import { runOCRFromBlob } from './ocrService';
import { putMeta, listAllMeta, getMeta } from '../../data/metaRepo';
import { putHash } from '../../data/hashIndex';
import { computeSHA256 } from '../../utils/hash';
import { getByHash } from '../../data/hashIndex';
import { Button, Spinner, Modal, ProgressBar } from 'react-bootstrap';
import { useGraphClient } from '../../services/graphClient';
import { scanReceiptsPath } from '../../onedrive/paths';

export default function OcrQueuePage() {
  const { uploadFile, downloadById, listFiles } = useGraphClient();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState({});
  const [statusMap, setStatusMap] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await listAllMeta();
        // Pending items: those without ocrSuggestion or ocrPath but having driveItemId
        const pending = (all || []).filter((m) => !m.ocrSuggestion && m.driveItemId);
        if (mounted) setItems(pending);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('listAllMeta failed', e);
        setDbStatus({ ok: false, error: String(e) });
      }
    })();
    return () => { mounted = false; };
  }, []);

  const refreshList = async (showAll = false) => {
    try {
      const all = await listAllMeta();
      const pending = (all || []).filter((m) => !m.ocrSuggestion && m.driveItemId);
      setItems(showAll ? (all || []) : pending);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('refresh failed', e);
    }
  };

  const repairDb = async () => {
    setDbStatus({ repairing: true });
    try {
      const { ensureStores } = await import('../../data/metaRepo');
      const res = await ensureStores();
      if (res.error) {
        setDbStatus({ ok: false, error: res.error });
      } else {
        setDbStatus({ ok: true });
      }
      // attempt refresh after repair
      await refreshList(false);
    } catch (e) {
      setDbStatus({ ok: false, error: String(e) });
    }
  };

  const runOCR = async () => {
    const selectedIds = Object.keys(selected).filter((k) => selected[k]);
    for (let i = 0; i < selectedIds.length; i += 1) {
      const uuid = selectedIds[i];
      setStatusMap((s) => ({ ...s, [uuid]: { state: 'running' } }));
      try {
        const meta = await getMeta(uuid);
        if (!meta || !meta.driveItemId) {
          setStatusMap((s) => ({ ...s, [uuid]: { state: 'error', error: 'no driveItemId' } }));
          continue;
        }
        const blob = await downloadById(meta.driveItemId);
        const { text, confidence } = await runOCRFromBlob(blob);
        // upload OCR text
        const ocrPath = `${scanReceiptsPath(meta.scanYear || new Date().getFullYear())}/ocr/${uuid}.txt`;
        const ocrBlob = new Blob([text || ''], { type: 'text/plain' });
        await uploadFile(ocrPath, ocrBlob, { headers: { 'Content-Type': 'text/plain' } });
        // update meta
        const updated = Object.assign({}, meta, { ocrSuggestion: text, ocrConfidence: confidence, ocrPath, uploadedAt: new Date().toISOString() });
        await putMeta(updated);
        setStatusMap((s) => ({ ...s, [uuid]: { state: 'done', text, confidence } }));
      } catch (err) {
        setStatusMap((s) => ({ ...s, [uuid]: { state: 'error', error: String(err) } }));
      }
    }
    // refresh pending list
    try {
      const all = await listAllMeta();
      const pending = (all || []).filter((m) => !m.ocrSuggestion && m.driveItemId);
      setItems(pending);
      setSelected({});
    } catch (e) {
      // ignore
    }
  };

  const rebuildIndexFromOneDrive = async () => {
    setStatusMap({});
    setStatusMap((s) => ({ ...s, __rebuild: { state: 'running', progress: 0 } }));
    try {
      const rootRes = await listFiles('');
      const rootChildren = (rootRes && rootRes.value) || [];
      const yearFolders = rootChildren.filter((c) => c && c.folder).map((c) => c.name);
      let total = 0;
      let processed = 0;
      // first pass: count meta files
      for (const year of yearFolders) {
        try {
          const metaList = await listFiles(`${year}/meta`);
          if (metaList && Array.isArray(metaList.value)) total += metaList.value.length;
        } catch (e) {
          // folder may not exist; ignore
        }
      }
      for (const year of yearFolders) {
        try {
          const metaList = await listFiles(`${year}/meta`);
          const files = (metaList && metaList.value) || [];
          for (const fi of files) {
            try {
              const blob = await downloadById(fi.id);
              const text = await blob.text();
              const meta = JSON.parse(text);
              await putMeta(meta);
              if (meta.contentHash) {
                try { await putHash(meta.contentHash, { driveItemId: meta.driveItemId, uuid: meta.uuid }); } catch (e) { /* ignore */ }
              }
            } catch (e) {
              // ignore single file errors
            }
            processed += 1;
            setStatusMap((s) => ({ ...s, __rebuild: { state: 'running', progress: Math.round((processed / (total || 1)) * 100) } }));
          }
        } catch (e) {
          // ignore
        }
      }
      setStatusMap((s) => ({ ...s, __rebuild: { state: 'done', progress: 100 } }));
      await refreshList(false);
    } catch (e) {
      setStatusMap((s) => ({ ...s, __rebuild: { state: 'error', error: String(e) } }));
    }
  };

  return (
    <div>
      <h2>OCR Queue</h2>
      <p>Select pending receipts from local index to run OCR.</p>
      <div className="mt-2">
        <Button onClick={runOCR} disabled={!items || items.length === 0 || Object.values(selected).every((v) => !v)}>
          Run OCR on selected
        </Button>{' '}
        <Button variant="secondary" onClick={() => refreshList(false)}>Refresh</Button>{' '}
        <Button variant="warning" onClick={() => setShowConfirm(true)}>Rebuild index from OneDrive</Button>{' '}
        <Button variant="danger" onClick={async () => {
          if (typeof indexedDB === 'undefined') return;
          try {
            // delete DB and refresh local state
            await new Promise((resolve, reject) => {
              const req = indexedDB.deleteDatabase('receipts-local-db');
              req.onsuccess = () => resolve();
              req.onerror = () => reject(req.error);
              req.onblocked = () => resolve();
            });
            // small delay to ensure deletion
            setTimeout(async () => { await refreshList(false); setDebugInfo({ reset: true }); }, 250);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('reset db failed', e);
          }
        }}>Reset local DB</Button>{' '}
        <Button variant="info" onClick={repairDb}>Repair DB</Button>{' '}
        <Button variant="light" onClick={async () => {
          try {
            const all = await listAllMeta();
            // import listAllHashes dynamically
            const { listAllHashes } = await import('../../data/hashIndex');
            const hashes = await listAllHashes();
            setDebugInfo({ totalMeta: (all||[]).length, pending: (all||[]).filter(m => !m.ocrSuggestion && m.driveItemId).length, hashCount: hashes.length });
            // log full arrays for inspection
            // eslint-disable-next-line no-console
            console.log('meta entries:', all);
            // eslint-disable-next-line no-console
            console.log('hash entries:', hashes);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('dump failed', e);
          }
        }}>Dump meta to console</Button>{' '}
        <label style={{ marginLeft: 12 }}>
          <input type="checkbox" onChange={(e) => refreshList(e.target.checked)} /> Show all meta
        </label>
      </div>
      {statusMap && statusMap.__rebuild && (
        <div className="mt-2">
          <strong>Rebuild:</strong> {statusMap.__rebuild.state} {statusMap.__rebuild.progress ? `(${statusMap.__rebuild.progress}%)` : ''}
          <div className="mt-1">
            <ProgressBar now={statusMap.__rebuild.progress || 0} label={`${statusMap.__rebuild.progress || 0}%`} />
          </div>
        </div>
      )}
      {debugInfo && (
        <div className="mt-2">
          <small>Meta: {debugInfo.totalMeta} entries — Pending: {debugInfo.pending} — HashIndex: {debugInfo.hashCount}</small>
        </div>
      )}
      {dbStatus && (
        <div className="mt-2">
          <strong>DB:</strong> {dbStatus.repairing ? 'Repairing...' : dbStatus.ok ? 'OK' : `Error: ${dbStatus.error}`}
        </div>
      )}
      <div className="mt-3">
        {items.length === 0 ? <p>No pending items found.</p> : (
          <div>
            {items.map((m) => {
              const s = statusMap[m.uuid];
              return (
                <div key={m.uuid} style={{ marginBottom: 12 }}>
                  <input type="checkbox" checked={!!selected[m.uuid]} onChange={(e) => setSelected((s2) => ({ ...s2, [m.uuid]: e.target.checked }))} />{' '}
                  <strong>{m.originalFileName || m.uuid}</strong>
                  {' - '}
                  <em>{m.scanYear}</em>
                  {' - '}
                  {s ? (
                    s.state === 'running' ? <span><Spinner animation="border" size="sm" /> Running</span>
                    : s.state === 'done' ? <span>Done (confidence: {Math.round(s.confidence || 0)})</span>
                    : <span>Error: {s.error}</span>
                  ) : <span>Ready</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Modal show={showConfirm} onHide={() => setShowConfirm(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Rebuild Local Index</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          This will scan your OneDrive app folder and download all metadata JSON files into the local index. It may take some time and consume bandwidth. Continue?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={async () => { setShowConfirm(false); await rebuildIndexFromOneDrive(); }}>Start Rebuild</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

