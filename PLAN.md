Yahoo Fantasy NBA — Integration Plan

Goal (phase 1)
- Use our Yahoo app (the one we just created with Client ID and Client Secret) to sign in with Yahoo and get an OAuth access token + refresh token.
- After sign-in, hit Yahoo Fantasy Sports API to list the user’s fantasy game → leagues → teams → rosters.
- Display this data in a simple web UI so we can see what Yahoo is actually giving us and how far we can push it.
- Keep it local-first (Next.js/Node) but write it so we can later deploy to Vercel.

What we have now
- Yahoo Client ID: **stored in .env.local** as `YAHOO_CLIENT_ID=...`
- Yahoo Client Secret: **stored in .env.local** as `YAHOO_CLIENT_SECRET=...`
- Redirect URI: must be **HTTPS** and must match what we set in the Yahoo app, e.g.
  - `YAHOO_REDIRECT_URI=https://<your-tunnel-or-vercel-domain>/api/auth/yahoo/callback`
  - For local testing we will use a tunnel (ngrok / cloudflared) so Yahoo can call back over HTTPS.

High-level flow
1. User clicks “Sign in with Yahoo”.
2. We redirect them to Yahoo’s OAuth authorize URL with our client_id, redirect_uri, and scopes.
3. Yahoo sends us back to `/api/auth/yahoo/callback` with a `code`.
4. Our API route exchanges that `code` for **access_token** and **refresh_token** using client_id + client_secret.
5. We store tokens in the session (in-memory first; later we can add DB/storage).
6. With the access token, we call Yahoo Fantasy endpoints to see what data we can get (games, leagues, teams, players, stats).

Scopes we likely need
- `fspt-r` (fantasy sports read) — main one for reading leagues / teams / rosters.
- If Yahoo rejects, we will check the Yahoo Fantasy Sports API docs and adjust.

Endpoints we want to hit (exploration list)
- GET current user’s games: `/fantasy/v2/users;use_login=1/games`
- GET leagues for a game: `/fantasy/v2/users;use_login=1/games;game_keys=<game-key>/leagues`
- GET league teams: `/fantasy/v2/league/<league-key>/teams`
- GET team roster: `/fantasy/v2/team/<team-key>/roster`
- GET players: `/fantasy/v2/league/<league-key>/players;status=A`
- Later: matchups, transactions, standings.

App structure (Next.js, simple)
- `/pages/index.tsx` → shows “Connect to Yahoo” and, once connected, shows buttons to fetch data.
- `/pages/api/auth/yahoo.ts` → builds the Yahoo authorize URL and redirects.
- `/pages/api/auth/yahoo/callback.ts` → handles the code → token exchange.
- `/pages/api/yahoo/*` → small proxy routes that call the Yahoo API with the stored token so the browser never exposes the client secret.

Environment variables (current target)
- `YAHOO_CLIENT_ID=...`
- `YAHOO_CLIENT_SECRET=...`
- `YAHOO_REDIRECT_URI=https://<your-domain>/api/auth/yahoo/callback`
- (optional later) `SESSION_SECRET=some-long-random-string`

Token storage (phase 1)
- Keep it in server memory or encrypted cookies just for us to test.
- Show the raw JSON returned by Yahoo in the UI so we can see exact field names.

UI we want (phase 1)
- Section 1: Auth status
  - If not connected → button: “Sign in with Yahoo”.
  - If connected → show masked access token + “Refresh leagues” button.
- Section 2: Game/league explorer
  - Button: “Get my games” → list out game_key, name, season.
  - For each game → button “Get leagues for this game”.
  - For each league → button “Get teams” and “Get players”.
  - Render as simple expandable panels (no styling requirements yet).
- Section 3: Raw response viewer
  - Show the last API response in a `<pre>` block so we don’t have to log to console.

Phase 2 (after we confirm data)
- Map Yahoo players → our local JSON (e.g. match on name or NBA player_id if Yahoo exposes it).
- Build a “Draft-like” view but powered by Yahoo live data instead of static JSON.
- Add filters (team, position), and an action to “pin” / “watchlist” a Yahoo player.

Risks / Gotchas
- Yahoo enforces HTTPS on redirect URIs → must use tunnel or deployed URL.
- Tokens expire → we need to test refresh flow early.
- Some Fantasy endpoints vary by sport and year → we will need to inspect response and adjust calls.

Acceptance criteria (phase 1)
- I can click a button and go through Yahoo’s OAuth.
- I get redirected back to our app without error.
- I can hit at least one Yahoo Fantasy endpoint with the returned token and render the JSON in the browser.
- All Yahoo secrets live only in `.env.local` and are **not** shipped to the client.

Yahoo Fantasy NBA — Integration Plan (Vercel-first)

Goal (phase 1)
- Use our Yahoo app (the one we created in the Yahoo Developer Portal) to sign in with Yahoo and get an OAuth **access token** and **refresh token**.
- Do this **directly on the deployed Vercel app** (https://nba-site-one.vercel.app) so we don’t need ngrok/tunnels for now.
- After sign-in, call the Yahoo Fantasy Sports API to list the current user’s: games → leagues → teams → (optionally) rosters.
- Show the raw JSON in the UI so we can see exactly what Yahoo returns and what we can map.

What we have now
- App is deployed to Vercel at: **https://nba-site-one.vercel.app**
- Yahoo app already exists and has:
  - **Client ID (Consumer Key)** → to be stored as `YAHOO_CLIENT_ID`
  - **Client Secret (Consumer Secret)** → to be stored as `YAHOO_CLIENT_SECRET`
  - **Redirect URI** set in Yahoo → must be: `https://nba-site-one.vercel.app/api/auth/yahoo/callback`
- We have added these to **Vercel → Project → Settings → Environment Variables** (and to `.env.local` locally):
  - `YAHOO_CLIENT_ID=...`
  - `YAHOO_CLIENT_SECRET=...`
  - `YAHOO_REDIRECT_URI=https://nba-site-one.vercel.app/api/auth/yahoo/callback`
- Because the app is running on HTTPS on Vercel, Yahoo is happy — **no ngrok needed right now**.

High-level flow (current)
1. User opens https://nba-site-one.vercel.app and sees a "Sign in with Yahoo" button.
2. Clicking it hits our API route (e.g. `/api/auth/yahoo`) which builds the Yahoo OAuth authorize URL using:
   - client_id = `process.env.YAHOO_CLIENT_ID`
   - redirect_uri = `process.env.YAHOO_REDIRECT_URI`
   - scope = fantasy sports + openid/email (we ticked these in the Yahoo app)
   - response_type = `code`
   Then it **redirects** the browser to that Yahoo URL.
3. User signs in to Yahoo and approves access.
4. Yahoo redirects back to **`/api/auth/yahoo/callback`** (on Vercel) with a `code` in the querystring.
5. Our callback route exchanges that `code` for tokens via Yahoo’s token endpoint, using our client_id + client_secret.
6. We temporarily store the tokens on the server (in-memory for now) or in a signed cookie so we can make further Yahoo API calls.
7. Frontend can now call our own routes (e.g. `/api/yahoo/games`) which forward the request to Yahoo using the stored access_token.

Scopes we will use
- **Fantasy Sports → Read** (the box we ticked in the Yahoo app): gives us fantasy endpoints.
- **OpenID Connect → Email**: handy to identify which Yahoo user we authenticated.
- If Yahoo errors on scopes, we will adjust in the auth URL.

API endpoints to explore
- Get current user’s games: `GET /fantasy/v2/users;use_login=1/games`
- Get leagues for a specific game: `GET /fantasy/v2/users;use_login=1/games;game_keys=<game-key>/leagues`
- Get teams for a league: `GET /fantasy/v2/league/<league-key>/teams`
- Get a team roster: `GET /fantasy/v2/team/<team-key>/roster`
- Later: players, matchups, standings, transactions.

App structure (Next.js / Vercel)
- `pages/index.tsx`
  - Shows auth status.
  - If not authenticated → show button: **"Sign in with Yahoo"** (calls `/api/auth/yahoo`).
  - If authenticated → show controls to fetch games, leagues, teams, and a raw JSON viewer.
- `pages/api/auth/yahoo.ts`
  - Builds Yahoo authorize URL and redirects there.
  - Uses env vars only (no secrets in client).
- `pages/api/auth/yahoo/callback.ts`
  - Receives `code` from Yahoo.
  - Exchanges `code` → `access_token` + `refresh_token`.
  - Stores tokens (for now: in a simple in-memory map keyed by a cookie / random id).
  - Redirects back to `/`.
- `pages/api/yahoo/games.ts`
  - Reads token from storage.
  - Calls Yahoo endpoint and returns JSON to the browser.
- `pages/api/yahoo/leagues.ts`, `pages/api/yahoo/teams.ts`, etc. → same pattern.

Token storage (phase 1, simple)
- Because we are on Vercel and this is just us testing, we can keep an **in-memory** token store or return the token straight to the browser and only display it.
- Long term we should **not** send access_token to the client; instead we should use an encrypted cookie or a small database (Supabase / Vercel KV / Turso).

UI we want (phase 1)
1. **Auth section**
   - If no session → show “Sign in with Yahoo”.
   - If session → show “Connected as &lt;email&gt;” and a button “Refresh my Yahoo data”.
2. **Explorer section**
   - Button: “Get my games” → list game_key, name, season.
   - For each game → button: “Get leagues for this game”.
   - For each league → button: “Get teams” and “Get roster”.
   - Everything in simple `<div>`s, no styling requirements yet.
3. **Raw response section**
   - `<pre>{JSON.stringify(lastResponse, null, 2)}</pre>` so we can see Yahoo’s exact structure.

Phase 2 (after we confirm data)
- Map Yahoo players to our existing NBA helper data (names, positions, team abbreviations).
- Add a panel to show “My Yahoo league → My team → My roster” inside our existing UI.
- Add buttons to fetch **weekly matchups** and **transactions** to see live data.
- Add token refresh logic (call Yahoo with `refresh_token` when the access token expires).

Risks / Notes
- **Redirect URI mismatch** will be the most common error → make sure Yahoo and Vercel BOTH say: `https://nba-site-one.vercel.app/api/auth/yahoo/callback`.
- Vercel functions are stateless → in-memory token store will reset on redeploy / cold start → OK for now because this is just us testing.
- We must **never** expose `YAHOO_CLIENT_SECRET` to the browser.

Acceptance criteria (phase 1)
- From the deployed URL I can click “Sign in with Yahoo”, login, and get redirected back without error.
- I can click “Get my games” and see actual Yahoo Fantasy NBA/NFL/NHL games tied to my Yahoo account.
- I can click into at least one game and list leagues.
- All secrets live in Vercel env vars and are NOT in client-side bundles.