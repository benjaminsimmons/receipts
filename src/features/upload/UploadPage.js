import React, { useState } from 'react';
import { useGraphClient } from '../../services/graphClient';
import { scanReceiptsPath } from '../../onedrive/paths';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from '../../auth/msalConfig';

export default function UploadPage() {
  const { uploadFile } = useGraphClient();
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle');

  const handleChange = (e) => {
    setFiles(e.target.files ? Array.from(e.target.files) : []);
    setStatus('idle');
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
    try {
      for (let i = 0; i < files.length; i += 1) {
        const f = files[i];
        setStatus(`uploading ${i + 1}/${files.length}`);
        const destPath = `${scanReceiptsPath(year)}/${f.name}`;
        await uploadFile(destPath, f);
      }
      setStatus('done');
    } catch (e) {
      console.error('upload error', e);
      const body = e && e.body ? ` - ${String(e.body).slice(0, 200)}` : '';
      setStatus(`error: ${e.message}${body}`);
    }
  };

  return (
    <div>
      <h2>Upload</h2>
      <p>Select a receipt image or PDF to upload to OneDrive.</p>
      <input type="file" onChange={handleChange} multiple />
      <button onClick={handleUpload} disabled={!(files && files.length) || status === 'uploading'}>
        Upload
      </button>
      <div>
        <strong>Status:</strong> {status}
      </div>
    </div>
  );
}
