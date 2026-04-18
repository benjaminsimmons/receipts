/* eslint-disable no-restricted-globals */
// Web Worker for OCR using tesseract.js
self.onmessage = async (ev) => {
  const { id, blob, lang = 'eng' } = ev.data || {};
  try {
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
      self.postMessage({ id, result: { text, confidence } });
    } finally {
      try { await worker.terminate(); } catch (e) { /* ignore */ }
    }
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};

export {};
