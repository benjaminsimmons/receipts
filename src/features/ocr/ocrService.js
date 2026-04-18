// Run OCR using a dedicated web worker if available; otherwise fall back to in-thread tesseract.js
let sharedWorker = null;
let pending = new Map();
let nextId = 1;

function createWorkerInstance() {
  try {
    // CRA-compatible worker instantiation
    const w = new Worker(new URL('./ocrWorker.js', import.meta.url));
    w.onmessage = (ev) => {
      const { id, result, error } = ev.data || {};
      const resolver = pending.get(id);
      if (resolver) {
        if (error) resolver.reject(new Error(error));
        else resolver.resolve(result);
        pending.delete(id);
      }
    };
    w.onerror = (e) => {
      // propagate to all pending
      pending.forEach((r) => r.reject(new Error(e.message || 'ocr worker error')));
      pending.clear();
    };
    return w;
  } catch (e) {
    return null;
  }
}

async function runInThread(blob, { lang = 'eng' } = {}) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker({ logger: () => {} });
  try {
    await worker.load();
    await worker.loadLanguage(lang);
    await worker.initialize(lang);
    const url = URL.createObjectURL(blob);
    const { data } = await worker.recognize(url);
    const text = data && data.text ? data.text : '';
    const confidence = data && typeof data.confidence !== 'undefined' ? data.confidence : null;
    URL.revokeObjectURL(url);
    return { text, confidence };
  } finally {
    try { await worker.terminate(); } catch (e) { /* ignore */ }
  }
}

export async function runOCRFromBlob(blob, opts = {}) {
  if (typeof window === 'undefined') throw new Error('runOCRFromBlob must run in browser');
  // Create worker lazily
  if (!sharedWorker && typeof Worker !== 'undefined') {
    sharedWorker = createWorkerInstance();
  }
  if (sharedWorker) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      try {
        sharedWorker.postMessage({ id, blob, lang: opts.lang || 'eng' });
      } catch (e) {
        pending.delete(id);
        reject(e);
      }
    });
  }
  // Fallback to in-thread run
  return runInThread(blob, opts);
}

export default { runOCRFromBlob };
