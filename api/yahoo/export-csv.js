const { ensureSession, getTokens, setTokens } = require("../_tokenStore");
const { yahooApi, refreshAccessToken } = require("../_yahoo");

function getQuery(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  return Object.fromEntries(url.searchParams.entries());
}

function ci(s) { return String(s || "").toLowerCase().trim(); }
function normName(s) { return ci(String(s || '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ')); }

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

function collect(o, pred) {
  const out = [];
  (function scan(x){
    if (!x) return;
    if (Array.isArray(x)) return x.forEach(scan);
    if (typeof x === 'object') {
      if (pred(x)) out.push(x);
      for (const k in x) scan(x[k]);
    }
  })(o);
  return out;
}

async function listGames(token) {
  return yahooApi('/users;use_login=1/games', token);
}
async function listLeagues(token, gameKeysCsv) {
  return yahooApi(`/users;use_login=1/games;game_keys=${encodeURIComponent(gameKeysCsv)}/leagues`, token);
}
async function leagueSettings(token, leagueKey) {
  return yahooApi(`/league/${encodeURIComponent(leagueKey)}/settings`, token);
}
async function leaguePlayers(token, leagueKey) {
  return yahooApi(`/league/${encodeURIComponent(leagueKey)}/players;out=stats`, token);
}
async function listTeams(token, leagueKey) {
  return yahooApi(`/league/${encodeURIComponent(leagueKey)}/teams`, token);
}
async function roster(token, teamKey) {
  return yahooApi(`/team/${encodeURIComponent(teamKey)}/roster`, token);
}

function buildStatMetaMap(settings) {
  const map = new Map(); // id -> meta
  collect(settings, o => o.stat_id && (o.name || o.display_name || o.abbr)).forEach(o => {
    map.set(String(o.stat_id), { name: o.name, display_name: o.display_name, abbr: o.abbr });
  });
  return map;
}

function buildWeights(settings) {
  const w = new Map();
  collect(settings, o => o.stat_id != null && typeof o.value === 'number').forEach(o => {
    w.set(String(o.stat_id), Number(o.value));
  });
  return w;
}

function idByLabels(statMeta) {
  const ids = {};
  for (const [id, meta] of statMeta.entries()) {
    const label = String(meta.display_name || meta.name || '').toUpperCase();
    if (label.includes('FANTASY') && label.includes('POINT')) ids.FPTS = ids.FPTS || id;
    if (label === 'GP' || label.includes('GAMES PLAYED')) ids.GP = ids.GP || id;
  }
  return ids;
}

function extractPlayersWithStats(playersJson) {
  return collect(playersJson, o => o.player && (o.player.player_id || (o.player.name && o.player.name.full))).map(o => o.player);
}

function statsArrayFromPlayer(player) {
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
  const arr = [];
  for (const bin of bins) {
    for (const item of bin) {
      const s = item.stat || item;
      if (s && s.stat_id != null) arr.push({ stat_id: String(s.stat_id), value: Number(s.value) });
    }
  }
  return arr;
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

module.exports = async (req, res) => {
  try {
    const q = getQuery(req);
    const leagueUrl = q.league_url || '';
    const leagueName = q.league_name || '';
    const leagueKey = q.league || '';
    const teamFilter = (q.team_filter || '').split(',').map(s => s.trim()).filter(Boolean);
    const teamKeys = (q.team_keys || '').split(',').map(s => s.trim()).filter(Boolean);
    const limit = Math.max(1, Math.min(Number(q.limit || 3), 20));

    if (!leagueUrl && !leagueName && !leagueKey) {
      res.statusCode = 400;
      res.json({ error: 'Provide league (key), league_url or league_name' });
      return;
    }

    const data = await withAuth(req, res, async (token) => {
      // 1) Games
      const gamesResp = await listGames(token);
      const gameObjs = collect(gamesResp, o => o.game_key || o.game_id);
      const gameKeys = Array.from(new Set(gameObjs.map(g => g.game_key).filter(Boolean)));
      if (!gameKeys.length) throw new Error('No games found');

      // 2) Leagues across games (unless league key provided)
      let leagues = [];
      let target = null;
      if (leagueKey) {
        target = { league_key: leagueKey, name: leagueKey };
      } else {
        const leaguesResp = await listLeagues(token, gameKeys.join(','));
        const leagueObjs = collect(leaguesResp, o => o.league_key || (o.league && o.league.league_key));
        for (const o of leagueObjs) {
          const L = o.league || o;
          if (L.league_key && (L.name || L.league_id)) {
            leagues.push({ league_key: L.league_key, name: L.name, league_id: L.league_id });
          }
        }

        // Pick league by URL id or by name
      }
      if (leagueUrl) {
        const m = String(leagueUrl).match(/\/(\d+)(?:$|[\/?#])/);
        const lid = m ? m[1] : null;
        if (!lid) throw new Error('Could not parse league id from league_url');
        if (!target) target = leagues.find(l => (l.league_id && String(l.league_id) === lid) || (l.league_key && l.league_key.endsWith(`.l.${lid}`)));
      }
      if (!target && leagueName) target = leagues.find(l => ci(l.name) === ci(leagueName));
      if (!target) return { error: 'League not found', leagues };

      // 3) League settings and players (with stats)
      const settings = await leagueSettings(token, target.league_key);
      const meta = buildStatMetaMap(settings);
      const weights = buildWeights(settings);
      const labels = idByLabels(meta);
      const lp = await leaguePlayers(token, target.league_key);
      const players = extractPlayersWithStats(lp);

      // Build index by id and by normalized name
      const byId = new Map();
      const byName = new Map();
      for (const p of players) {
        const pid = String(p.player_id || p.editorial_player_id || '');
        const stats = statsArrayFromPlayer(p);
        const smap = new Map(stats.map(s => [s.stat_id, s.value]));
        let fpts = 0;
        if (labels.FPTS && smap.has(labels.FPTS)) {
          fpts = Number(smap.get(labels.FPTS) || 0);
        } else if (weights.size) {
          for (const [sid, val] of smap.entries()) {
            const w = weights.get(String(sid));
            if (typeof w === 'number') fpts += val * w;
          }
        }
        const gp = Number(smap.get(labels.GP) || 0);
        const avg = gp > 0 ? fpts / gp : fpts; // fallback: if no GP, treat fpts as per-game
        const row = {
          player_id: pid,
          name: p.name && p.name.full ? p.name.full : (p.name || ''),
          team: p.editorial_team_abbr || p.editorial_team_full_name || '',
          pos: p.display_position || '',
          gp, fpts_total: fpts, fpts_avg: avg,
        };
        if (pid) byId.set(pid, row);
        const nn = normName(row.name);
        if (nn) byName.set(nn, row);
      }

      // 4) Teams, filter to requested
      const teamsResp = await listTeams(token, target.league_key);
      const teamObjs = collect(teamsResp, o => o.team_key);
      let teams = teamObjs.map(o => {
        const nameStr = typeof o.name === 'string' ? o.name : (o.name && (o.name.full || o.name.nickname)) || o.team_name || '';
        const nickStr = o.team_name || (o.name && (o.name.nickname || o.name.full)) || o.nickname || nameStr;
        return { team_key: o.team_key, name: nameStr, nickname: nickStr };
      });
      if (teamFilter.length || teamKeys.length) {
        const wanted = teamFilter.map(ci);
        teams = teams.filter(t => {
          const n1 = ci(t.nickname || '');
          const n2 = ci(t.name || '');
          const hitEq = wanted.includes(n1) || wanted.includes(n2);
          const hitContains = wanted.some(w => (n1 && n1.includes(w)) || (n2 && n2.includes(w)));
          const byKey = teamKeys.includes(String(t.team_key));
          return hitEq || hitContains || byKey;
        });
      }
      teams = teams.slice(0, limit);
      if (!teams.length) return { error: 'No teams matched filter', teams_all: teamObjs };

      // 5) Fetch rosters and build CSV rows
      const rows = [];
      for (const t of teams) {
        const r = await roster(token, t.team_key);
        const playersOnTeam = collect(r, o => o.player && (o.player.player_id || (o.player.name && o.player.name.full))).map(o => o.player);
        for (const p of playersOnTeam) {
          const pid = String(p.player_id || p.editorial_player_id || '');
          const nm = p.name && p.name.full ? p.name.full : '';
          let info = (pid && byId.get(pid)) || (nm && byName.get(normName(nm))) || null;
          if (!info) {
            // As a last resort, compute from this roster object too
            const stats = statsArrayFromPlayer(p);
            const smap = new Map(stats.map(s => [s.stat_id, s.value]));
            let fpts = 0; if (labels.FPTS && smap.has(labels.FPTS)) fpts = Number(smap.get(labels.FPTS) || 0);
            const gp = Number(smap.get(labels.GP) || 0);
            const avg = gp > 0 ? fpts / gp : fpts;
            info = {
              player_id: pid || normName(nm), name: nm, team: p.editorial_team_abbr || '', pos: p.display_position || '', gp, fpts_total: fpts, fpts_avg: avg,
            };
          }
          rows.push({ team_label: t.nickname || t.name, team_key: t.team_key, player_team: info.team, ...info });
        }
      }

      // 6) Optional budget-based value
      const budget = q.budget ? Number(q.budget) : null;
      const metric = (q.metric || 'avg').toLowerCase(); // 'avg' or 'total'
      let csvRows = rows;
      let header = ['team','team_key','player_id','name','pos','team_abbr','gp','fpts_total','fpts_avg'];
      if (budget && isFinite(budget) && budget > 0) {
        const sum = rows.reduce((acc, r) => acc + (metric === 'total' ? r.fpts_total : r.fpts_avg), 0);
        if (sum > 0) {
          csvRows = rows.map(r => ({ ...r, value: budget * ((metric === 'total' ? r.fpts_total : r.fpts_avg) / sum) }));
          header = header.concat('value');
        }
      }
      const csv = [header.join(',')].concat(csvRows.map(r => {
        const base = [
          csvEscape(r.team_label), csvEscape(r.team_key), csvEscape(r.player_id), csvEscape(r.name), csvEscape(r.pos), csvEscape(r.player_team), r.gp, r.fpts_total.toFixed(2), r.fpts_avg.toFixed(2)
        ];
        if ('value' in r) base.push((r.value || 0).toFixed(2));
        return base.join(',');
      })).join('\n');

      return { league_key: target.league_key, league_name: target.name, csv };
    });

    if (!data || data.error) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data || { error: 'Unknown error' }));
      return;
    }

    const leaguePart = data.league_key ? data.league_key.replace(/[^a-z0-9_.-]/gi, '_') : 'league';
    const stamp = new Date().toISOString().slice(0,10);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${leaguePart}_rosters_${stamp}.csv"`);
    res.end(data.csv);
  } catch (e) {
    res.statusCode = e.status || 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message, details: e.body }));
  }
};
