import useGraphToken from '../auth/useGraphToken';
import { useCallback } from 'react';

// Minimal Graph client hook for OneDrive operations used by the app.
export function useGraphClient() {
  const { acquireToken } = useGraphToken();

  const uploadFile = useCallback(
    async (drivePath, file) => {
      if (!file) throw new Error('file required');
      const token = await acquireToken();
      if (!token) throw new Error('Unable to acquire access token');

      const encodedPath = encodeURIComponent(drivePath);
      // Use the app folder (approot) so files are stored in the app-specific OneDrive folder
      const url = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodedPath}:/content`;

      const resp = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: file,
      });

      if (!resp.ok) {
        const text = await resp.text();
        const err = new Error(`Upload failed: ${resp.status} ${resp.statusText}`);
        err.body = text;
        throw err;
      }

      return resp.json();
    },
    [acquireToken]
  );

  const listFiles = useCallback(
    async (drivePath) => {
      const token = await acquireToken();
      if (!token) throw new Error('Unable to acquire access token');
      const encodedPath = encodeURIComponent(drivePath);
      const url = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodedPath}:/children`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const text = await resp.text();
        const err = new Error(`List files failed: ${resp.status} ${resp.statusText}`);
        err.body = text;
        throw err;
      }
      return resp.json();
    },
    [acquireToken]
  );

  // Move an item or folder from oldPath to newPath inside the app folder.
  // oldPath and newPath are relative to the app folder (e.g. 'Receipts/Scan2026' -> '2026')
  const movePath = useCallback(
    async (oldPath, newPath) => {
      const token = await acquireToken();
      if (!token) throw new Error('Unable to acquire access token');

      const encodedOld = encodeURIComponent(oldPath);
      const url = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodedOld}:/move`;

      // parentReference.path should point to the destination folder's parent in the approot
      const parts = newPath.split('/').filter(Boolean);
      const name = parts.pop();
      const parentPath = parts.length ? `/drive/special/approot:/${parts.join('/')}` : '/drive/special/approot:/';

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ parentReference: { path: parentPath }, name }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        const err = new Error(`Move failed: ${resp.status} ${resp.statusText}`);
        err.body = text;
        throw err;
      }

      return resp.json();
    },
    [acquireToken]
  );

  return { uploadFile, listFiles, movePath };
}

export default useGraphClient;
