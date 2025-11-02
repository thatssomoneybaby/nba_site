const { buildAuthorizeUrl } = require("../_yahoo");
const { ensureSession } = require("../_tokenStore");

module.exports = async (req, res) => {
  try {
    const sid = ensureSession(req, res);
    const state = sid; // keep it simple: tie state to session id
    const url = buildAuthorizeUrl(state);
    res.statusCode = 302;
    res.setHeader("Location", url);
    res.end();
  } catch (e) {
    res.statusCode = 500;
    res.json({ error: e.message });
  }
};

