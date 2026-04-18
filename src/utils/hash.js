// Client-side hashing utilities
// computeSHA256(blobOrBuffer): returns hex string of SHA-256

async function arrayBufferFrom(input) {
  if (input instanceof ArrayBuffer) return input;
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return await input.arrayBuffer();
  }
  if (typeof input === 'string') {
    const TextEncoderCtor = (typeof globalThis !== 'undefined' && globalThis.TextEncoder)
      ? globalThis.TextEncoder
      : (typeof Buffer !== 'undefined' ? class {
        encode(s) { return new Uint8Array(Buffer.from(s, 'utf8')); }
      } : undefined);
    if (!TextEncoderCtor) throw new Error('No TextEncoder available');
    return new TextEncoderCtor().encode(input).buffer;
  }
  if (input && input.buffer instanceof ArrayBuffer) return input.buffer;
  throw new TypeError('Unsupported input for hashing');
}

function toHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const h = bytes[i].toString(16).padStart(2, '0');
    s += h;
  }
  return s;
}

export async function computeSHA256(input) {
  const buf = await arrayBufferFrom(input);

  // Prefer Web Crypto Subtle if available
  const subtle = (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) ? globalThis.crypto.subtle : null;
  if (subtle && subtle.digest) {
    const digest = await subtle.digest('SHA-256', buf);
    return toHex(digest);
  }

  // Fallback to Node.js crypto (for tests / Node environments)
  try {
    // Use eval('require') to avoid webpack trying to polyfill node 'crypto'
    // eslint-disable-next-line no-eval, global-require
    const { createHash } = eval('require')('crypto');
    const hash = createHash('sha256');
    hash.update(Buffer.from(buf));
    return hash.digest('hex');
  } catch (e) {
    throw new Error('No crypto available for hashing');
  }
}

export default { computeSHA256 };
