const { ensureSession, getTokens, setTokens } = require("../_tokenStore");
const { yahooApi, refreshAccessToken } = require("../_yahoo");

module.exports = async (req, res) => {
  try {
    const sid = ensureSession(req, res);
    let { access_token, refresh_token } = getTokens(sid);
    if (!access_token) {
      res.statusCode = 401;
      res.json({ error: "Not authenticated" });
      return;
    }
    try {
      const data = await yahooApi("/users;use_login=1/games", access_token);
      res.statusCode = 200;
      res.json(data);
    } catch (err) {
      if (err.status === 401 && refresh_token) {
        const fresh = await refreshAccessToken(refresh_token);
        setTokens(sid, fresh);
        const data = await yahooApi("/users;use_login=1/games", fresh.access_token);
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

