Yahoo Fantasy NBA — Phase 1 Scaffold

What’s included
- Serverless API routes under `api/` (Vercel-compatible):
  - `api/auth/yahoo.js`: Redirects to Yahoo OAuth authorize.
  - `api/auth/yahoo/callback.js`: Handles code → token exchange and stores tokens in a simple in-memory session.
  - `api/yahoo/games.js`: Calls Yahoo Fantasy API to list games for the logged-in user.
  - `api/yahoo/leagues.js`: Lists leagues for provided `game_keys`.
  - `api/yahoo/teams.js`: Lists teams for a provided `league_key`.
  - Frontend dashboard: main `index.html` + `app.js` integrates Yahoo panel and renders players.

Environment variables
- Configure these in your Vercel project settings (do NOT expose in client):
  - `YAHOO_CLIENT_ID`
  - `YAHOO_CLIENT_SECRET`
  - `YAHOO_REDIRECT_URI` → must match your Yahoo app, e.g. `https://<your-domain>/api/auth/yahoo/callback`
- For local `.env.local`, keep secrets safe; they are not read automatically by Vercel functions.

Deploying on Vercel
1) Push this repo to the connected Vercel project.
2) In Vercel dashboard → Project → Settings → Environment Variables, add the three vars above (same names).
3) Ensure your Yahoo app redirect URI matches `https://<your-vercel-domain>/api/auth/yahoo/callback`.
4) Visit `https://<your-vercel-domain>/` and click “Sign in with Yahoo”.

Local development (optional)
- You can run `vercel dev` (Vercel CLI) to emulate serverless functions locally.
- Make sure env vars are exported in your shell or in a local env file that your dev runner loads.

Notes
- Token storage is in-memory and will reset on cold starts/redeploys. This is fine for exploration; switch to a durable store later.
- We never ship `YAHOO_CLIENT_SECRET` to the browser; API routes proxy all Yahoo calls.
- Add more endpoints as needed (matchups, rosters, transactions) following the same pattern used here.
