import React from 'react';
import { render, screen } from '@testing-library/react';
import { useGraphClient } from '../graphClient';

jest.mock('../../auth/useGraphToken', () => ({
  __esModule: true,
  default: () => ({
    acquireToken: jest.fn().mockResolvedValue('FAKE_TOKEN'),
  }),
}));

describe('useGraphClient', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function TestComponent({ onReady }) {
    const client = useGraphClient();
    React.useEffect(() => {
      onReady(client);
    }, [client, onReady]);
    return null;
  }

  test('uploadFile sends PUT with Authorization header and returns json', async () => {
    const fakeResp = { id: '123' };
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => fakeResp });

    let client;
    render(<TestComponent onReady={(c) => { client = c; }} />);

    const file = new Blob(['hello'], { type: 'text/plain' });
    const drivePath = 'Receipts/Scan2026/receipts/test.txt';

    const res = await client.uploadFile(drivePath, file);

    expect(global.fetch).toHaveBeenCalled();
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('/me/drive/special/approot:/Receipts%2FScan2026%2Freceipts%2Ftest.txt:/content');
    const options = global.fetch.mock.calls[0][1];
    expect(options.method).toBe('PUT');
    expect(options.headers.Authorization).toBe('Bearer FAKE_TOKEN');
    expect(res).toEqual(fakeResp);
  });

  test('listFiles calls children endpoint and returns json', async () => {
    const fakeResp = { value: [] };
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => fakeResp });

    let client;
    render(<TestComponent onReady={(c) => { client = c; }} />);

    const res = await client.listFiles('Receipts/Scan2026/receipts');

    expect(global.fetch).toHaveBeenCalled();
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('/me/drive/special/approot:/Receipts%2FScan2026%2Freceipts:/children');
    const options = global.fetch.mock.calls[0][1];
    expect(options.headers.Authorization).toBe('Bearer FAKE_TOKEN');
    expect(res).toEqual(fakeResp);
  });
});
