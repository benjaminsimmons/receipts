// OneDrive-backed shared index helpers. Uses an acquireToken function
// (from useGraphToken) to call Microsoft Graph directly.

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const INDEX_PATH = 'hash-index.json';

async function fetchWithAuth(acquireToken, url, opts = {}) {
  const token = await acquireToken();
  const headers = Object.assign({}, opts.headers || {}, {
    Authorization: `Bearer ${token}`,
  });
  const res = await fetch(url, Object.assign({}, opts, { headers }));
  return res;
}

export async function fetchSharedIndex(acquireToken) {
  const metaUrl = `${GRAPH_BASE}/me/drive/special/approot:/${encodeURIComponent(INDEX_PATH)}`;
  try {
    const metaRes = await fetchWithAuth(acquireToken, metaUrl);
    if (metaRes.status === 404) return null;
    if (!metaRes.ok) throw new Error(`metadata request failed ${metaRes.status}`);
    const meta = await metaRes.json();
    const eTag = meta.eTag || null;
    const contentUrl = `${metaUrl}:/content`;
    const contentRes = await fetchWithAuth(acquireToken, contentUrl);
    if (contentRes.status === 404) return { index: {}, eTag };
    if (!contentRes.ok) throw new Error(`content request failed ${contentRes.status}`);
    const text = await contentRes.text();
    const index = text ? JSON.parse(text) : {};
    return { index, eTag };
  } catch (err) {
    throw err;
  }
}

async function putContent(acquireToken, content, ifMatch) {
  const url = `${GRAPH_BASE}/me/drive/special/approot:/${encodeURIComponent(INDEX_PATH)}:/content`;
  const token = await acquireToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (ifMatch) headers['If-Match'] = ifMatch;
  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(content),
  });
  return res;
}

// Update the shared index with optimistic ETag-based writes and basic retry/merge.
export async function updateSharedIndex(acquireToken, newEntries, prevETag, maxRetries = 3) {
  let attempt = 0;
  let merged = Object.assign({}, newEntries);
  let etag = prevETag;
  while (attempt < maxRetries) {
    try {
      const res = await putContent(acquireToken, merged, etag);
      if (res.ok) {
        const json = await res.json();
        return { success: true, eTag: json.eTag || null };
      }
      if (res.status === 412 || res.status === 412 /* Precondition failed */) {
        // Conflict: fetch latest and merge
        const latest = await fetchSharedIndex(acquireToken);
        const latestIndex = (latest && latest.index) || {};
        etag = (latest && latest.eTag) || null;
        merged = Object.assign({}, latestIndex, merged);
        attempt += 1;
        continue;
      }
      // Handle other non-ok statuses by throwing
      const text = await res.text();
      throw new Error(`update failed ${res.status} ${text}`);
    } catch (err) {
      if (attempt + 1 >= maxRetries) throw err;
      attempt += 1;
    }
  }
  throw new Error('updateSharedIndex: max retries exceeded');
}

export default { fetchSharedIndex, updateSharedIndex };
