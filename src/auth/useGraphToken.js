import { useMsal } from '@azure/msal-react';
import { loginRequest } from './msalConfig';
import { useCallback } from 'react';

export default function useGraphToken() {
  const { instance, accounts } = useMsal();

  const acquireToken = useCallback(async () => {
    if (!accounts || accounts.length === 0) return null;
    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      return response.accessToken;
    } catch (e) {
      // fallback to interactive
      const resp = await instance.acquireTokenPopup({ ...loginRequest });
      return resp.accessToken;
    }
  }, [instance, accounts]);

  return { acquireToken };
}
