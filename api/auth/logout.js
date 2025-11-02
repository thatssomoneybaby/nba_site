const { clearTokens } = require("../_tokenStore");

module.exports = async (req, res) => {
  clearTokens(res);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true }));
};

