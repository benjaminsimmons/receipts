import { fetchSharedIndex, updateSharedIndex } from '../sharedIndex';

describe('sharedIndex', () => {
  const fakeToken = 'fake-token';
  const acquireToken = jest.fn(() => Promise.resolve(fakeToken));

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('fetchSharedIndex returns parsed index and eTag when present', async () => {
    // first fetch: metadata
    const meta = { id: '1', eTag: 'etag-1' };
    const indexObj = { 'hash1': { driveItemId: 'did1', uuid: 'u1' } };

    global.fetch.mockImplementationOnce(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(meta) }))
      .mockImplementationOnce(() => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(indexObj)) }));

    const res = await fetchSharedIndex(acquireToken);
    expect(res).toBeTruthy();
    expect(res.eTag).toBe('etag-1');
    expect(res.index).toEqual(indexObj);
    expect(acquireToken).toHaveBeenCalled();
  });

  test('fetchSharedIndex returns null when metadata is 404', async () => {
    global.fetch.mockImplementation(() => Promise.resolve({ ok: false, status: 404 }));
    const res = await fetchSharedIndex(acquireToken);
    expect(res).toBeNull();
  });

  test('updateSharedIndex writes content and returns new eTag', async () => {
    // Simulate PUT returning ok with json eTag
    global.fetch.mockImplementation((url, opts) => {
      if (opts && opts.method === 'PUT') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ eTag: 'new-etag' }) });
      }
      // metadata/content reads - return 404 for simplicity
      return Promise.resolve({ ok: false, status: 404 });
    });

    const result = await updateSharedIndex(acquireToken, { h: { driveItemId: 'd', uuid: 'u' } }, null);
    expect(result).toBeTruthy();
    expect(result.eTag).toBe('new-etag');
  });

  test('updateSharedIndex handles 412 conflict by fetching latest and retrying', async () => {
    let call = 0;
    global.fetch.mockImplementation((url, opts) => {
      // First PUT attempt -> 412
      if (opts && opts.method === 'PUT') {
        call += 1;
        if (call === 1) return Promise.resolve({ ok: false, status: 412, text: () => Promise.resolve('precondition failed') });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ eTag: 'etag-after' }) });
      }
      // metadata fetch (called by fetchSharedIndex) -> return meta and content
      if (url && typeof url === 'string' && url.endsWith('hash-index.json')) {
        // metadata
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ eTag: 'old-etag' }) });
      }
      if (url && typeof url === 'string' && url.endsWith('hash-index.json:/content')) {
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ existing: { driveItemId: 'x', uuid: 'y' } })) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const result = await updateSharedIndex(acquireToken, { newh: { driveItemId: 'd2', uuid: 'u2' } }, 'old-etag');
    expect(result.success).toBe(true);
    expect(result.eTag).toBe('etag-after');
  });
});
