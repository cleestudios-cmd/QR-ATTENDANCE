# Deploying QR-ATTENDANCE to Vercel

This document shows a minimal, tested set of steps to deploy the QR-ATTENDANCE SPA to Vercel and verify the scanner deep-link `/scan/:sessionToken` works in production.

Prerequisites
- A Vercel account (https://vercel.com)
- Repository connected to Vercel (GitHub/GitLab/Bitbucket)
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` available from your Supabase project
- HTTPS is required for camera access (Vercel provides HTTPS)

Add `vercel.json` (SPA fallback)
1. Create `vercel.json` at the project root with a catch-all rewrite so client-side routes load `index.html`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Environment variables
1. In the Vercel Project dashboard → Settings → Environment Variables, add:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
2. Set these for the appropriate environments (Preview and Production).

Build settings
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install` (default) — adjust if you use `pnpm`/`yarn`

Local pre-deploy verification
1. Install deps and build:

```bash
npm install
npm run build
```

2. Serve `dist` with an SPA fallback (test deep links):

```bash
npx serve dist -s  # or any static server that supports SPA fallback
```

3. Open `https://localhost:5000/scan/some-token` (or the local server URL) and confirm the app loads (SessionLanding should render).

Production scanner link behavior
- In production the scanner link will be `https://<your-domain>/scan/:sessionToken` (NOT `localhost`).
- Because of the `vercel.json` rewrite, loading that URL will return `index.html` and the SPA router will read `:sessionToken` from the path.
- Camera access requires HTTPS and user permission; mobile browsers will only allow camera usage on secure contexts.

Post-deploy verification (on Vercel)
1. Deploy (push to the connected branch or use `vercel` CLI).
2. In Vercel dashboard set the `VITE_` env vars if not already set and redeploy.
3. Open the deployed site (HTTPS).
4. In the Admin UI: create a class -> Start Session -> copy the scanner link shown in the UI.
5. Open the scanner link directly (fresh tab or different device). It should load the SessionLanding and then the Scanner UI when session is active.
6. Test camera permissions and scanning on a mobile device.
7. Test offline queue: scan while offline, reconnect, and confirm queued logs are flushed to Supabase.

Troubleshooting
- If you get a 404 for direct `/scan/...` links: confirm `vercel.json` is at repo root and contains the rewrite; confirm Output Directory is `dist`.
- If camera is blocked: ensure page is served over HTTPS and camera permissions are granted in browser settings.

Notes
- Keep `VITE_` prefixed env vars for Vite so they are embedded at build time. Do not publish your anon key publicly; use Vercel environment variables.
- If you prefer not to include `vercel.json`, you can configure the Vercel dashboard to set a custom route to rewrite all paths to `/index.html`, but adding `vercel.json` to the repo is reproducible and recommended.
