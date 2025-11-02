const { exchangeCodeForToken } = require("../../_yahoo");
const { ensureSession, setTokens } = require("../../_tokenStore");

function getQuery(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  return Object.fromEntries(url.searchParams.entries());
}

module.exports = async (req, res) => {
  try {
    const sid = ensureSession(req, res);
    const q = getQuery(req);
    if (!q.code) {
      res.statusCode = 400;
      res.json({ error: "Missing code" });
      return;
    }
    // Optional: validate state === sid for CSRF mitigation if we persist state
    const tokens = await exchangeCodeForToken(q.code);
    setTokens(sid, tokens, res);
    // Redirect back to simple dashboard page
    res.statusCode = 302;
    res.setHeader("Location", "/");
    res.end();
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: e.message }));
  }
};
