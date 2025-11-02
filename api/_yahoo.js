const { URLSearchParams } = require("url");

const AUTH_BASE = "https://api.login.yahoo.com/oauth2";
const FANTASY_BASE = "https://fantasysports.yahooapis.com/fantasy/v2";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function buildAuthorizeUrl(state) {
  const clientId = requiredEnv("YAHOO_CLIENT_ID");
  const redirectUri = requiredEnv("YAHOO_REDIRECT_URI");
  const scope = "fspt-r"; // Fantasy Sports read
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    state,
  });
  return `${AUTH_BASE}/request_auth?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const clientId = requiredEnv("YAHOO_CLIENT_ID");
  const clientSecret = requiredEnv("YAHOO_CLIENT_SECRET");
  const redirectUri = requiredEnv("YAHOO_REDIRECT_URI");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${AUTH_BASE}/get_token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${txt}`);
  }
  return res.json();
}

async function refreshAccessToken(refreshToken) {
  const clientId = requiredEnv("YAHOO_CLIENT_ID");
  const clientSecret = requiredEnv("YAHOO_CLIENT_SECRET");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${AUTH_BASE}/get_token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Refresh failed: ${res.status} ${txt}`);
  }
  return res.json();
}

async function yahooApi(path, accessToken) {
  const url = `${FANTASY_BASE}${path}${path.includes("?") ? "&" : "?"}format=json`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401) {
    const text = await res.text();
    const err = new Error("Unauthorized");
    err.status = 401;
    err.body = text;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Yahoo API error: ${res.status}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return res.json();
}

module.exports = { buildAuthorizeUrl, exchangeCodeForToken, refreshAccessToken, yahooApi };

