module.exports = async (req, res) => {
  const keys = [
    "YAHOO_CLIENT_ID",
    "YAHOO_CLIENT_SECRET",
    "YAHOO_REDIRECT_URI",
  ];
  const out = {};
  for (const k of keys) {
    out[k] = process.env[k] ? (k === "YAHOO_CLIENT_SECRET" ? "set" : process.env[k]) : "missing";
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(out, null, 2));
};

