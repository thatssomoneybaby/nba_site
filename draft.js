const LS_DRAFT_KEY = "draftHelper:v1:2024-25:default:drafted";
const LS_FILTERS_KEY = "draftHelper:v1:filters";

const state = {
  players: [],
  drafted: new Set(),
  myRoster: new Set(),
  filters: {
    query: "",
    pos: "",
    hideDrafted: false,
    sortKey: "fpts",
    sortDir: -1, // desc
    highlightRoster: true,
    onlyRoster: false,
  },
};

function loadPersisted() {
  try {
    const raw = localStorage.getItem(LS_DRAFT_KEY);
    if (raw) state.drafted = new Set(JSON.parse(raw));
  } catch {}
  try {
    const f = JSON.parse(localStorage.getItem(LS_FILTERS_KEY) || "{}");
    Object.assign(state.filters, f);
  } catch {}
}

function persistDrafted() {
  localStorage.setItem(LS_DRAFT_KEY, JSON.stringify([...state.drafted]));
}

function persistFilters() {
  localStorage.setItem(LS_FILTERS_KEY, JSON.stringify(state.filters));
}

function formatNum(n) {
  return typeof n === "number" ? n.toFixed(2).replace(/\.00$/, "") : n;
}

function visibleRows() {
  const q = state.filters.query.trim().toLowerCase();
  const pos = state.filters.pos;
  const hide = state.filters.hideDrafted;
  const onlyRoster = state.filters.onlyRoster;
  let rows = state.players;
  if (q) {
    rows = rows.filter((p) =>
      (p.player || "").toLowerCase().includes(q) ||
      (p.team || "").toLowerCase().includes(q)
    );
  }
  if (pos) {
    rows = rows.filter((p) => (p.pos || "").toUpperCase().includes(pos));
  }
  if (hide) {
    rows = rows.filter((p) => !state.drafted.has(p.player_id));
  }
  if (onlyRoster) {
    rows = rows.filter((p) => state.myRoster.has(p.player_id));
  }

  const [key, dir] = [state.filters.sortKey, state.filters.sortDir];
  rows = rows.slice().sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * dir;
  });

  return rows;
}

function renderCounters() {
  const total = state.players.length;
  const drafted = state.drafted.size;
  const remaining = total - drafted;
  document.getElementById("count-drafted").textContent = `Drafted: ${drafted}`;
  document.getElementById("count-remaining").textContent = `Remaining: ${remaining}`;
  document.getElementById("count-total").textContent = `Total: ${total}`;
}

function renderTable() {
  const tbody = document.getElementById("tbody");
  const empty = document.getElementById("empty");
  const rows = visibleRows();
  tbody.innerHTML = "";

  if (!rows.length) {
    empty.hidden = false;
    renderCounters();
    return;
  }
  empty.hidden = true;

  const frag = document.createDocumentFragment();
  for (const p of rows) {
    const tr = document.createElement("tr");
    const isDrafted = state.drafted.has(p.player_id);
    const isMy = state.myRoster.has(p.player_id);

    const tdCheck = document.createElement("td");
    tdCheck.className = "col-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isDrafted;
    checkbox.ariaLabel = `Draft ${p.player}`;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.drafted.add(p.player_id);
      else state.drafted.delete(p.player_id);
      persistDrafted();
      if (state.filters.hideDrafted) {
        renderTable();
      } else {
        // toggle visual state only
        nameCell.classList.toggle("drafted", checkbox.checked);
      }
      renderCounters();
    });
    tdCheck.appendChild(checkbox);

    const tdPlayer = document.createElement("td");
    tdPlayer.className = "player";
    const nameCell = document.createElement("span");
    nameCell.textContent = p.player;
    nameCell.className = [isDrafted ? "drafted" : "", (isMy && state.filters.highlightRoster) ? "on-roster" : ""].filter(Boolean).join(" ");
    tdPlayer.appendChild(nameCell);

    const tdTeam = document.createElement("td");
    tdTeam.className = "team";
    tdTeam.textContent = p.team;

    const tdPos = document.createElement("td");
    tdPos.className = "pos";
    tdPos.textContent = p.pos;

    const tdGP = document.createElement("td");
    tdGP.textContent = p.gp;

    const tdMin = document.createElement("td");
    tdMin.textContent = formatNum(p.min);

    const tdFPTS = document.createElement("td");
    tdFPTS.textContent = formatNum(p.fpts);

    const tdPTS = document.createElement("td");
    tdPTS.textContent = formatNum(p.pts);

    const tdREB = document.createElement("td");
    tdREB.textContent = formatNum(p.reb);

    const tdAST = document.createElement("td");
    tdAST.textContent = formatNum(p.ast);

    const tdSTL = document.createElement("td");
    tdSTL.textContent = formatNum(p.stl);

    const tdBLK = document.createElement("td");
    tdBLK.textContent = formatNum(p.blk);

    if (isMy && state.filters.highlightRoster) tr.classList.add("row-on-roster");
    tr.append(
      tdCheck,
      tdPlayer,
      tdTeam,
      tdPos,
      tdGP,
      tdMin,
      tdFPTS,
      tdPTS,
      tdREB,
      tdAST,
      tdSTL,
      tdBLK
    );
    frag.appendChild(tr);
  }

  tbody.appendChild(frag);
  renderCounters();
  renderTotals();
}

function wireControls() {
  const search = document.getElementById("search");
  const pos = document.getElementById("pos");
  const sort = document.getElementById("sort");
  const hideDrafted = document.getElementById("hideDrafted");
  const reset = document.getElementById("reset");
  const yHighlight = document.getElementById("y-highlight");
  const yFilter = document.getElementById("y-filter");

  // Init from persisted filters
  search.value = state.filters.query || "";
  pos.value = state.filters.pos || "";
  hideDrafted.checked = !!state.filters.hideDrafted;
  sort.value = `${state.filters.sortKey}:${state.filters.sortDir === -1 ? "desc" : "asc"}`;
  if (yHighlight) yHighlight.checked = !!state.filters.highlightRoster;
  if (yFilter) yFilter.checked = !!state.filters.onlyRoster;

  const syncAndRender = () => { persistFilters(); renderTable(); };

  search.addEventListener("input", () => {
    state.filters.query = search.value;
    syncAndRender();
  });
  pos.addEventListener("change", () => {
    state.filters.pos = pos.value;
    syncAndRender();
  });
  sort.addEventListener("change", () => {
    const [key, dir] = sort.value.split(":");
    state.filters.sortKey = key;
    state.filters.sortDir = dir === "desc" ? -1 : 1;
    syncAndRender();
  });
  hideDrafted.addEventListener("change", () => {
    state.filters.hideDrafted = hideDrafted.checked;
    syncAndRender();
  });
  if (yHighlight) yHighlight.addEventListener("change", () => {
    state.filters.highlightRoster = yHighlight.checked;
    syncAndRender();
  });
  if (yFilter) yFilter.addEventListener("change", () => {
    state.filters.onlyRoster = yFilter.checked;
    syncAndRender();
  });
  reset.addEventListener("click", () => {
    if (!confirm("Clear drafted selections?")) return;
    state.drafted.clear();
    persistDrafted();
    renderTable();
  });
}

// ---- Yahoo integration ----
async function yGET(path) {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

function normalizeName(n) {
  return String(n || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPlayerIndex(players) {
  const map = new Map();
  for (const p of players) {
    const key = normalizeName(p.player);
    if (key) map.set(key, p);
  }
  return map;
}

function extractYahooNames(obj, out = new Set()) {
  if (!obj) return out;
  if (Array.isArray(obj)) {
    for (const v of obj) extractYahooNames(v, out);
  } else if (typeof obj === "object") {
    if (obj.full && typeof obj.full === "string") {
      const nm = normalizeName(obj.full);
      if (nm.includes(" ")) out.add(obj.full);
    }
    if (obj.name && typeof obj.name === "object" && typeof obj.name.full === "string") {
      const nm = normalizeName(obj.name.full);
      if (nm.includes(" ")) out.add(obj.name.full);
    }
    for (const k of Object.keys(obj)) extractYahooNames(obj[k], out);
  }
  return out;
}

function computeTotals(ids) {
  const acc = { count: 0, fpts: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, min: 0 };
  for (const p of state.players) {
    if (!ids.has(p.player_id)) continue;
    acc.count++;
    acc.fpts += p.fpts || 0;
    acc.pts += p.pts || 0;
    acc.reb += p.reb || 0;
    acc.ast += p.ast || 0;
    acc.stl += p.stl || 0;
    acc.blk += p.blk || 0;
    acc.min += p.min || 0;
  }
  return acc;
}

function renderTotals() {
  const el = document.getElementById("y-totals");
  if (!el) return;
  const ids = state.myRoster;
  if (!ids || ids.size === 0) { el.hidden = true; return; }
  const t = computeTotals(ids);
  el.hidden = false;
  const set = (id, v) => { const x = document.getElementById(id); if (x) x.textContent = formatNum(v); };
  set("y-count", t.count);
  set("y-fpts", t.fpts);
  set("y-pts", t.pts);
  set("y-reb", t.reb);
  set("y-ast", t.ast);
  set("y-stl", t.stl);
  set("y-blk", t.blk);
  set("y-min", t.min);
}

async function initYahooPanel() {
  const status = document.getElementById("y-status");
  const btnConnect = document.getElementById("y-connect");
  const btnRefresh = document.getElementById("y-refresh");
  const gameSel = document.getElementById("y-game");
  const leagueSel = document.getElementById("y-league");
  const teamSel = document.getElementById("y-team");
  const btnLoad = document.getElementById("y-load-roster");
  const dateInput = document.getElementById("y-date");
  const btnToday = document.getElementById("y-today");

  if (!status) return; // panel not present

  const toLabel = (g) => `${g.game_key || g.game_id || "?"} — ${g.name || g.code || "game"} ${g.season || ""}`;

  function setStatus(txt, ok=false) {
    status.textContent = txt;
    status.style.color = ok ? "#9ae6b4" : "#94a3b8";
  }

  btnConnect.addEventListener("click", () => {
    window.location.href = "/api/auth/yahoo";
  });
  btnRefresh.addEventListener("click", async () => {
    // On refresh, fetch league settings and players and render into the main table
    try {
      await refreshLeagueData();
    } catch (e) {
      console.error("Refresh data failed", e);
      await loadGames();
    }
  });
  if (btnToday) btnToday.addEventListener("click", () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    if (dateInput) dateInput.value = `${yyyy}-${mm}-${dd}`;
    refreshLeagueData();
  });
  if (dateInput) dateInput.addEventListener("change", () => { refreshLeagueData(); });

  async function loadGames() {
    try {
      const data = await yGET("/api/yahoo/games");
      setStatus("Connected", true);
      // try to flatten games list from Yahoo JSON
      const games = [];
      // try a few common shapes
      const maybeGames = JSON.stringify(data).includes("game");
      if (maybeGames) {
        // heuristic: search for objects with game_key
        const seen = new Set();
        (function scan(o){
          if (!o) return;
          if (Array.isArray(o)) return o.forEach(scan);
          if (typeof o === 'object') {
            if ((o.game_key || o.game_id) && !seen.has(o.game_key || o.game_id)) {
              games.push({ game_key: o.game_key, name: o.name, code: o.code, season: o.season });
              seen.add(o.game_key || o.game_id);
            }
            for (const k in o) scan(o[k]);
          }
        })(data);
      }
      gameSel.innerHTML = games.map(g => {
        const nm = g.name || g.code || 'Game';
        const season = g.season ? ` ${g.season}` : '';
        return `<option value="${g.game_key}">${nm}${season}</option>`;
      }).join("");
      // Prefer NBA if present
      const nbaIdx = games.findIndex(g => String(g.code).toLowerCase().includes("nba") || String(g.name).toLowerCase().includes("basketball"));
      if (nbaIdx >= 0) gameSel.selectedIndex = nbaIdx;
      await loadLeagues();
    } catch (e) {
      setStatus("Not connected");
      gameSel.innerHTML = "";
      leagueSel.innerHTML = "";
      teamSel.innerHTML = "";
    }
  }

  async function loadLeagues() {
    const gk = gameSel.value;
    if (!gk) { leagueSel.innerHTML = ""; return; }
    try {
      const data = await yGET(`/api/yahoo/leagues?game_keys=${encodeURIComponent(gk)}`);
      const leagues = [];
      (function scan(o){
        if (!o) return;
        if (Array.isArray(o)) return o.forEach(scan);
        if (typeof o === 'object') {
          if (o.league_key) leagues.push({ league_key: o.league_key, name: o.name, season: o.season });
          for (const k in o) scan(o[k]);
        }
      })(data);
      leagueSel.innerHTML = leagues.map(l => {
        const nm = (l.name && (l.name.full || l.name)) || l.league_key;
        const season = l.season ? ` ${l.season}` : '';
        return `<option value="${l.league_key}">${nm}${season}</option>`;
      }).join("");
      // If exactly one league, select it
      if (leagues.length === 1) {
        leagueSel.selectedIndex = 0;
      }
      // If URL param league exists, try to select it
      const pLeague = getUrlParam('league');
      if (pLeague) {
        const idx = leagues.findIndex(l => l.league_key === pLeague);
        if (idx >= 0) leagueSel.selectedIndex = idx;
      }
      await loadTeams();
      // Auto refresh if league is selected
      if (leagueSel.value) {
        await refreshLeagueData();
      }
    } catch (e) {
      leagueSel.innerHTML = "";
    }
  }

  async function loadTeams() {
    const lk = leagueSel.value;
    if (!lk) { teamSel.innerHTML = ""; return; }
    try {
      const data = await yGET(`/api/yahoo/teams?league_key=${encodeURIComponent(lk)}`);
      const teams = [];
      (function scan(o){
        if (!o) return;
        if (Array.isArray(o)) return o.forEach(scan);
        if (typeof o === 'object') {
          if (o.team_key) {
            let nick = o.team_name || (o.name && (o.name.nickname || o.name.full)) || o.nickname;
            teams.push({ team_key: o.team_key, name: o.name, nickname: nick });
          }
          for (const k in o) scan(o[k]);
        }
      })(data);
      teamSel.innerHTML = teams.map(t => `<option value="${t.team_key}">${t.nickname || t.name || t.team_key}</option>`).join("");
    } catch (e) {
      teamSel.innerHTML = "";
    }
  }

  gameSel.addEventListener('change', loadLeagues);
  leagueSel.addEventListener('change', async () => { await loadTeams(); await refreshLeagueData(); });

  function extractYahooPlayerIds(obj, out = new Set()) {
    (function scan(o){
      if (!o) return;
      if (Array.isArray(o)) return o.forEach(scan);
      if (typeof o === 'object') {
        if (o.player_id) out.add(String(o.player_id));
        for (const k in o) scan(o[k]);
      }
    })(obj);
    return out;
  }

  btnLoad.addEventListener('click', async () => {
    const tk = teamSel.value;
    if (!tk) return;
    try {
      const data = await yGET(`/api/yahoo/roster?team_key=${encodeURIComponent(tk)}`);
      const ids = extractYahooPlayerIds(data);
      if (ids.size) {
        // Prefer direct Yahoo IDs if present (state.players now uses Yahoo ids)
        state.myRoster = ids;
      } else {
        // Fallback to name matching
        const names = Array.from(extractYahooNames(data));
        const idx = buildPlayerIndex(state.players);
        const matches = new Set();
        for (const nm of names) {
          const key = normalizeName(nm);
          const hit = idx.get(key);
          if (hit) matches.add(hit.player_id);
        }
        state.myRoster = matches;
      }
      renderTable();
      renderTotals();
      // Turn on highlight by default
      const yHighlight = document.getElementById('y-highlight');
      if (yHighlight) { yHighlight.checked = true; state.filters.highlightRoster = true; }
    } catch (e) {
      console.error('Load roster failed', e);
    }
  });

  // Initialize date from URL if present
  const pDate = getUrlParam('date');
  if (dateInput && pDate) dateInput.value = pDate;
  await loadGames();
}

async function init() {
  loadPersisted();
  wireControls();
  try {
    // Fetch from repo root; works locally and on static hosting
    const res = await fetch("./fantasy_averages_2024_25.json", { cache: "no-store" });
    const data = await res.json();
    state.players = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Failed to load data", e);
    state.players = [];
  }
  initYahooPanel();
  renderTable();
}

document.addEventListener("DOMContentLoaded", init);

// ---- Live league players rendering ----
function getUrlParam(name) {
  const sp = new URLSearchParams(location.search);
  return sp.get(name);
}

function buildStatMapFromSettings(settings) {
  const map = new Map(); // id -> {name, display_name, abbr}
  (function scan(o){
    if (!o) return;
    if (Array.isArray(o)) return o.forEach(scan);
    if (typeof o === 'object') {
      if (o.stat_id && (o.name || o.display_name)) {
        map.set(String(o.stat_id), { name: o.name, display_name: o.display_name, abbr: o.abbr });
      }
      for (const k in o) scan(o[k]);
    }
  })(settings);
  return map;
}

function findAllPlayers(obj) {
  const out = [];
  (function scan(o){
    if (!o) return;
    if (Array.isArray(o)) return o.forEach(scan);
    if (typeof o === 'object') {
      if (o.player && (o.player.player_id || (o.player.name && o.player.name.full))) {
        out.push(o.player);
      }
      for (const k in o) scan(o[k]);
    }
  })(obj);
  return out;
}

function statsArrayFromPlayer(player) {
  // Try common locations: player.stats.stats, player.player_stats.stats
  const bins = [];
  (function scan(o){
    if (!o) return;
    if (Array.isArray(o)) return o.forEach(scan);
    if (typeof o === 'object') {
      if (o.stats && Array.isArray(o.stats)) bins.push(o.stats);
      if (o.stats && o.stats.stats && Array.isArray(o.stats.stats)) bins.push(o.stats.stats);
      for (const k in o) scan(o[k]);
    }
  })(player);
  // Flatten to array of {stat_id,value}
  const arr = [];
  for (const bin of bins) {
    for (const item of bin) {
      const s = item.stat || item;
      if (s && s.stat_id != null) arr.push({ stat_id: String(s.stat_id), value: Number(s.value) });
    }
  }
  return arr;
}

function transformYahooPlayersToRows(players, statMap, statWeights) {
  // Build quick lookup of important stat ids by display name
  let idByLabel = {};
  for (const [id, meta] of statMap.entries()) {
    const label = String(meta.display_name || meta.name || "").toUpperCase();
    if (label.includes("PTS") && !idByLabel.PTS) idByLabel.PTS = id;
    if (label === "REB" || label.includes("REBOUNDS")) idByLabel.REB = idByLabel.REB || id;
    if (label === "AST" || label.includes("ASSISTS")) idByLabel.AST = idByLabel.AST || id;
    if (label === "STL" || label.includes("STEALS")) idByLabel.STL = idByLabel.STL || id;
    if (label === "BLK" || label.includes("BLOCKS")) idByLabel.BLK = idByLabel.BLK || id;
    if (label === "MIN" || label.includes("MINUTES")) idByLabel.MIN = idByLabel.MIN || id;
    if (label.includes("FANTASY POINT")) idByLabel.FPTS = idByLabel.FPTS || id;
    if (label === "GP" || label.includes("GAMES PLAYED")) idByLabel.GP = idByLabel.GP || id;
  }

  const rows = [];
  for (const p of players) {
    const pid = String(p.player_id || p.editorial_player_id || normalizeName(p.name && p.name.full));
    const name = p.name && p.name.full ? p.name.full : (p.name || "");
    const team = p.editorial_team_abbr || p.editorial_team_full_name || "";
    const pos = p.display_position || (p.eligible_positions && Array.isArray(p.eligible_positions) ? p.eligible_positions.join(',') : "");
    const statsArr = statsArrayFromPlayer(p);
    const byId = new Map(statsArr.map(s => [s.stat_id, s.value]));

    const row = {
      player_id: pid,
      player: name,
      team,
      pos,
      gp: byId.get(idByLabel.GP) || 0,
      min: byId.get(idByLabel.MIN) || 0,
      fpts: 0,
      pts: byId.get(idByLabel.PTS) || 0,
      reb: byId.get(idByLabel.REB) || 0,
      ast: byId.get(idByLabel.AST) || 0,
      stl: byId.get(idByLabel.STL) || 0,
      blk: byId.get(idByLabel.BLK) || 0,
    };
    if (idByLabel.FPTS && byId.has(idByLabel.FPTS)) {
      row.fpts = byId.get(idByLabel.FPTS) || 0;
    } else if (statWeights && statWeights.size) {
      let sum = 0;
      for (const [sid, val] of byId.entries()) {
        const w = statWeights.get(String(sid));
        if (typeof w === 'number') sum += val * w;
      }
      row.fpts = sum;
    }
    rows.push(row);
  }
  return rows;
}

async function refreshLeagueData() {
  const leagueSel = document.getElementById("y-league");
  let league = leagueSel && leagueSel.value;
  if (!league) {
    // Try URL param ?league=...
    league = getUrlParam('league');
  }
  if (!league) throw new Error("No league selected");
  const sort_type = getUrlParam('sort_type');
  const date = getUrlParam('date');
  const qs = new URLSearchParams({ league });
  const qsPlayers = new URLSearchParams({ league });
  if (sort_type) qsPlayers.set('sort_type', sort_type);
  if (date) qsPlayers.set('date', date);

  const [settings, playersRaw] = await Promise.all([
    yGET(`/api/yahoo/league-settings?${qs.toString()}`),
    yGET(`/api/yahoo/league-players?${qsPlayers.toString()}`),
  ]);
  const { statMap, statWeights } = parseSettings(settings);
  const players = findAllPlayers(playersRaw);
  const rows = transformYahooPlayersToRows(players, statMap, statWeights);
  state.players = rows;
  renderTable();
}

function parseSettings(settings) {
  const statMap = buildStatMapFromSettings(settings);
  const statWeights = buildStatWeightsFromSettings(settings);
  return { statMap, statWeights };
}

function buildStatWeightsFromSettings(settings) {
  const weights = new Map();
  (function scan(o){
    if (!o) return;
    if (Array.isArray(o)) return o.forEach(scan);
    if (typeof o === 'object') {
      if (o.stat_id != null && typeof o.value === 'number') {
        weights.set(String(o.stat_id), Number(o.value));
      }
      for (const k in o) scan(o[k]);
    }
  })(settings);
  return weights;
}
