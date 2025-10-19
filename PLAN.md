NBA Fantasy “Draft Helper” — Technical Plan

Goal (MVP)

Build a simple site with a Draft page that:
	•	Lists 2024–25 player per-game fantasy averages (from our generated JSON).
	•	Lets you tick a checkbox to mark a player as drafted → row greys out.
	•	Supports search, position filter, sort by FPTS desc (default).
	•	Persists state in localStorage so your ticks survive reloads.
	•	Deploys as a static site (Vercel/GitHub Pages/etc.).

⸻

Data Source
	•	File: fantasy_averages_2024_25.json (already built by build_fantasy_averages.py)
	•	Suggested location in the site: /public/fantasy_averages_2024_25.json
	•	Expected shape (per row):
	{
  "player_id": 203999,
  "player": "Player Name",
  "team": "DEN",
  "pos": "C",
  "gp": 74,
  "min": 32.4,
  "pts": 26.1,
  "reb": 12.3,
  "ast": 8.7,
  "stl": 1.3,
  "blk": 0.9,
  "fgm": 9.7,
  "fga": 17.5,
  "fg3m": 1.1,
  "ftm": 4.2,
  "tov": 3.4,
  "fpts": 57.83
}

Tech Stack (minimal + flexible)
	•	Frontend:
	•	Option A (recommended): Next.js + plain React (no DB needed).
	•	Option B: Plain HTML + JS (single page) for absolute simplicity.
	•	Styling: Tailwind CSS or vanilla CSS (either is fine).
	•	State persistence: localStorage (key names include a draftId so you can track multiple drafts later).
	•	Hosting: Vercel (or GitHub Pages/Cloudflare Pages).

⸻

UX / Pages
	•	Sidebar: “Draft”, and a placeholder for “About” or “Settings”.
	•	Draft page components:
	•	Toolbar:
	•	Search input (by player/team).
	•	Position filter (PG/SG/SF/PF/C, multi-select optional; start with single-select).
	•	Toggle: “Hide drafted”.
	•	Sort select: FPTS (desc) (default), PTS, REB, AST, etc.
	•	Counters: Drafted N / Remaining M / Total T.
	•	Actions: Reset (clear drafted state), Export/Import (JSON of drafted IDs).
	•	Player table:
	•	Checkbox at row start.
	•	Columns: Player, Team, Pos, GP, MIN, FPTS (bold), then high-level stats (PTS/REB/AST/STL/BLK).
	•	Drafted rows: greyed (e.g., opacity-50) and/or name with strikethrough.
	•	Empty states: Show a small note if filters hide everything.

Accessibility:
	•	Checkboxes must have labels; table headers are buttons for sorting; keyboard tab order is natural.

Performance:
	•	~500–600 rows renders fine. If you feel lag later, add row virtualization (e.g., @tanstack/react-virtual).

⸻

State & Persistence
	•	Single draft session:
	•	localStorage["draftHelper:v1:2024-25:default:drafted"] → JSON array of drafted player_id values.
	•	localStorage["draftHelper:v1:filters"] → persisted UI filters/sort.
	•	Multiple draft boards (optional later): add draftId param in the key, e.g., :friends-league-2025.

⸻

Implementation Steps
2) Layout & Routing
	•	Create app/layout.tsx (or pages/_app.tsx if using pages router) with a sidebar shell.
	•	Add a route/page at /draft.

3) Data loader
	•	In /draft/page.tsx (or a component it uses), fetch('/fantasy_averages_2024_25.json') on mount.
	•	Store in state: players: Player[].

4) Draft state
	•	Maintain a Set<number> of drafted IDs in React state: drafted.
	•	On toggle: update state + localStorage.
	•	Initialize from localStorage on mount.

5) Filters & sorting
	•	query (string), posFilter (string), hideDrafted (boolean), sortKey ('fpts'|'pts'|'reb'|...), sortDir (1 or -1).
	•	Derived visibleRows = applyFilters(players).sort(...).map(...).

6) UI polish
	•	Use a sticky header; clickable table headers for sorting.
	•	Grey drafted rows: add a CSS class on drafted.has(player_id).

7) Utilities
	•	Reset: clear drafted set & localStorage.
	•	Export: JSON.stringify([...drafted]) → download.
	•	Import: upload JSON → validate → set drafted.

8) Deploy
	•	Push to GitHub, deploy on Vercel.
	•	Verify the JSON fetch works on production (it will from /public).

⸻
Acceptance Criteria (MVP)
	•	JSON loads and renders a table with FPTS-desc default sorting.
	•	Search by player and team works.
	•	Filter by position works.
	•	Ticking a player greys out row and persists across reloads.
	•	Toggle to hide drafted rows.
	•	Reset clears all drafted state.
	•	Deployed and usable on mobile + desktop.

⸻

Nice-to-haves (after MVP)
	•	Export/Import drafted list (JSON).
	•	Multi-draft support (draftId query param → separate localStorage buckets).
	•	Row virtualization for ultra-smooth scrolling.
	•	Theming (light/dark).
	•	Simple backend sync (Supabase) for cross-device boards.
	•	Add columns: 3PA, FT%, or custom weights; or a “My Rankings” drag-and-drop list.

⸻
