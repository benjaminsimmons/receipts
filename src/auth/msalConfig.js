// Minimal MSAL configuration. Fill REACT_APP_MSAL_CLIENT_ID in environment.
// By default the authority uses `common` so the app accepts personal Microsoft accounts
// (consumer) and organizational accounts. To lock to a tenant, set REACT_APP_MSAL_AUTHORITY.
const clientId = process.env.REACT_APP_MSAL_CLIENT_ID || '4a4d7bc3-318c-452d-afb5-cf32d7f0462d';
const authority = process.env.REACT_APP_MSAL_AUTHORITY || 'https://login.microsoftonline.com/common';

export const msalConfig = {
  auth: {
    clientId,
    authority,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  // Use Files.ReadWrite for broader compatibility with consumer OneDrive accounts.
  scopes: ['User.Read', 'Files.ReadWrite'],
};
