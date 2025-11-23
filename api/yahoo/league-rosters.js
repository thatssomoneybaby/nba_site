const { ensureSession, getTokens, setTokens } = require("../_tokenStore");
const { yahooApi, refreshAccessToken } = require("../_yahoo");

function getQuery(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  return Object.fromEntries(url.searchParams.entries());
}

function ci(s) { return String(s || "").toLowerCase().trim(); }

async function withAuth(req, res, handler) {
  const sid = ensureSession(req, res);
  let { access_token, refresh_token } = getTokens(sid, req);
  if (!access_token) {
    res.statusCode = 401;
    res.json({ error: "Not authenticated" });
    return;
  }
  try {
    return await handler(access_token);
  } catch (err) {
    if (err.status === 401 && refresh_token) {
      const fresh = await refreshAccessToken(refresh_token);
      setTokens(sid, fresh, res);
      return await handler(fresh.access_token);
    }
    throw err;
  }
}

function collectByKey(obj, predicate) {
  const out = [];
  (function scan(o){
    if (!o) return;
    if (Array.isArray(o)) return o.forEach(scan);
    if (typeof o === 'object') {
      if (predicate(o)) out.push(o);
      for (const k in o) scan(o[k]);
    }
  })(obj);
  return out;
}

async function listGames(accessToken) {
  return yahooApi("/users;use_login=1/games", accessToken);
}

async function listLeaguesForGames(accessToken, gameKeysCsv) {
  const path = `/users;use_login=1/games;game_keys=${encodeURIComponent(gameKeysCsv)}/leagues`;
  return yahooApi(path, accessToken);
}

async function listTeams(accessToken, leagueKey) {
  return yahooApi(`/league/${encodeURIComponent(leagueKey)}/teams`, accessToken);
}

async function getRoster(accessToken, teamKey) {
  return yahooApi(`/team/${encodeURIComponent(teamKey)}/roster`, accessToken);
}

module.exports = async (req, res) => {
  try {
    const q = getQuery(req);
    const leagueName = q.league_name || q.name;
    if (!leagueName) {
      res.statusCode = 400;
      res.json({ error: "Missing league_name param" });
      return;
    }
    const teamFilter = (q.team_filter || "").split(",").map(s => s.trim()).filter(Boolean);
    const limit = Math.max(1, Math.min(Number(q.limit || 3), 20));

    const data = await withAuth(req, res, async (token) => {
      // 1) Get all games for the user and collect game_keys
      const gamesResp = await listGames(token);
      const gameObjs = collectByKey(gamesResp, o => o.game_key || o.game_id);
      const gameKeys = Array.from(new Set(gameObjs.map(g => g.game_key).filter(Boolean)));
      if (gameKeys.length === 0) throw new Error("No games found for user");

      // 2) Get all leagues across those game keys
      const leaguesResp = await listLeaguesForGames(token, gameKeys.join(","));
      const leagueObjs = collectByKey(leaguesResp, o => o.league_key || (o.league && o.league.league_key));
      // Normalize to {league_key, name}
      const leagues = [];
      for (const o of leagueObjs) {
        const lk = o.league_key || (o.league && o.league.league_key);
        const nm = o.name || (o.league && o.league.name);
        if (lk && nm) leagues.push({ league_key: lk, name: nm });
      }
      const target = leagues.find(l => ci(l.name) === ci(leagueName));
      if (!target) {
        return { error: `League not found: ${leagueName}`, leagues };
      }

      // 3) Get teams for this league
      const teamsResp = await listTeams(token, target.league_key);
      const teamObjs = collectByKey(teamsResp, o => o.team_key && (o.name || o.nickname));
      const teams = teamObjs.map(o => ({ team_key: o.team_key, name: o.name, nickname: o.managers && o.managers[0] && o.managers[0].nickname ? o.managers[0].nickname : o.name }));

      // 4) Choose teams: filter by team_filter (match on nickname or name), else take first N
      const selected = [];
      if (teamFilter.length) {
        const wanted = teamFilter.map(ci);
        for (const t of teams) {
          const n1 = ci(t.nickname || "");
          const n2 = ci(t.name || "");
          const hitEq = wanted.includes(n1) || wanted.includes(n2);
          const hitContains = wanted.some(w => (n1 && n1.includes(w)) || (n2 && n2.includes(w)));
          if (hitEq || hitContains) selected.push(t);
        }
      } else {
        selected.push(...teams.slice(0, limit));
      }
      if (!selected.length) {
        return { error: "No teams matched filter", teams };
      }

      // 5) Fetch rosters for selected teams
      const results = [];
      for (const t of selected.slice(0, limit)) {
        const rosterResp = await getRoster(token, t.team_key);
        // Extract a simple list of player names for convenience
        const players = collectByKey(rosterResp, o => o.player && (o.player.name && o.player.name.full))
          .map(o => o.player.name.full);
        results.push({ team_key: t.team_key, name: t.name, nickname: t.nickname, players, raw: rosterResp });
      }

      return { league_key: target.league_key, league_name: target.name, teams: results };
    });

    // Success
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
  } catch (e) {
    res.statusCode = e.status || 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: e.message, details: e.body }));
  }
};
