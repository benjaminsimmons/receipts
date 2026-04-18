Personal OneDrive setup for Receipts

Overview
- The app can use personal (consumer) Microsoft accounts (OneDrive) as well as work/school accounts.

Azure app registration notes
1. In Azure Portal > App registrations > New registration:
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI (Single-page application): `https://your-app-origin/` (e.g. `http://localhost:3000`)
2. Under "Authentication" make sure SPA redirect URI is added.
3. Under "API permissions" > "Microsoft Graph" add Delegated permissions:
   - `User.Read`
   - `Files.ReadWrite`
   Then grant admin consent if you control the tenant (not required for consumer accounts).

App configuration in this repo
- `src/auth/msalConfig.js` defaults to `authority = 'https://login.microsoftonline.com/common'` so the app accepts personal accounts.
- If you want to lock to a single tenant, set `REACT_APP_MSAL_AUTHORITY` to `https://login.microsoftonline.com/<tenantId>`.
- Provide `REACT_APP_MSAL_CLIENT_ID` (the Application (client) ID) in your environment.

Local testing
1. Set env vars (in `.env` or in your environment):

```
REACT_APP_MSAL_CLIENT_ID=<your-client-id>
# optional: override authority
# REACT_APP_MSAL_AUTHORITY=https://login.microsoftonline.com/common
```

2. Start the dev server:

```bash
npm install
npm start
```

3. Sign in with a personal Microsoft account and verify `GET https://graph.microsoft.com/v1.0/me/drive` returns drive metadata (no error). Then try uploads from the Upload page.

Notes
- `Files.ReadWrite` grants read/write access to the signed-in user's OneDrive. Use least privilege if you can (e.g., `Files.ReadWrite.AppFolder`) but prefer `Files.ReadWrite` for broader consumer compatibility.
- Consumer accounts do not require SharePoint/OneDrive-for-Business licenses.
