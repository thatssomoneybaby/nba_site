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
    const league = q.league;
    if (!league) {
      res.statusCode = 400;
      res.json({ error: "Missing league param" });
      return;
    }
    const extras = [];
    if (q.sort_type) extras.push(`sort_type=${q.sort_type}`);
    if (q.date) extras.push(`date=${q.date}`);
    // out=stats is required
    const tail = ["out=stats", ...extras].length ? ";" + ["out=stats", ...extras].join(";") : "";
    const path = `/league/${encodeURIComponent(league)}/players${tail}`;

    let { access_token, refresh_token } = getTokens(sid, req);
    if (!access_token) {
      res.statusCode = 401;
      res.json({ error: "Not authenticated" });
      return;
    }
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

