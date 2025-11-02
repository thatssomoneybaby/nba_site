const { ensureSession, getTokens, setTokens } = require("../_tokenStore");
const { yahooApi, refreshAccessToken } = require("../_yahoo");

function getQuery(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  return Object.fromEntries(url.searchParams.entries());
}

module.exports = async (req, res) => {
  try {
    const sid = ensureSession(req, res);
    const q = getQuery(req);
    const teamKey = q.team_key || "";
    if (!teamKey) {
      res.statusCode = 400;
      res.json({ error: "Missing team_key param" });
      return;
    }
    let { access_token, refresh_token } = getTokens(sid, req);
    if (!access_token) {
      res.statusCode = 401;
      res.json({ error: "Not authenticated" });
      return;
    }
    const path = `/team/${encodeURIComponent(teamKey)}/roster`;
    try {
      const data = await yahooApi(path, access_token);
      res.statusCode = 200;
      res.json(data);
    } catch (err) {
      if (err.status === 401 && refresh_token) {
        const fresh = await refreshAccessToken(refresh_token);
        setTokens(sid, fresh, res);
        const data = await yahooApi(path, fresh.access_token);
        res.statusCode = 200;
        res.json(data);
      } else {
        throw err;
      }
    }
  } catch (e) {
    res.statusCode = e.status || 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: e.message, details: e.body }));
  }
};
