import React, { useState } from 'react';
import { useGraphClient } from '../../services/graphClient';

export default function SettingsPage() {
  const { listFiles, movePath } = useGraphClient();
  const [status, setStatus] = useState('idle');

  const migrate = async () => {
    setStatus('scanning');
    try {
      // List the top-level Receipts folder
      const res = await listFiles('Receipts');
      const children = (res && res.value) || [];
      // For each ScanYYYY folder, move it to YYYY
      for (const item of children) {
        if (item.name && /^Scan\d{4}$/.test(item.name)) {
          const year = item.name.replace(/^Scan/, '');
          setStatus(`moving ${item.name} -> ${year}`);
          await movePath(`Receipts/${item.name}`, `${year}`);
        }
      }
      setStatus('done');
    } catch (e) {
      console.error('migration failed', e);
      const body = e && e.body ? ` - ${String(e.body).slice(0, 200)}` : '';
      setStatus(`error: ${e.message}${body}`);
    }
  };

  return (
    <div>
      <h2>Settings</h2>
      <p>App settings and diagnostics.</p>
      <div>
        <button onClick={migrate}>Migrate existing Receipts structure</button>
      </div>
      <div>
        <strong>Status:</strong> {status}
      </div>
    </div>
  );
}
