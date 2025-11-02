// Simple in-memory token store keyed by a session id cookie.
// For production, replace with a durable store.

const store = new Map();

function randomId(len = 24) {
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Buffer.from(bytes).toString("base64url");
}

function getCookie(req, name) {
  const header = req.headers.cookie || "";
  const parts = header.split(/;\s*/);
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k === name) return decodeURIComponent(v || "");
  }
  return null;
}

function setCookie(res, name, value, opts = {}) {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${opts.path || "/"}`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];
  if (opts.maxAge) attrs.push(`Max-Age=${opts.maxAge}`);
  if (opts.secure) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}

function ensureSession(req, res) {
  let sid = getCookie(req, "sid");
  if (!sid) {
    sid = randomId();
    setCookie(res, "sid", sid, { path: "/", secure: true, maxAge: 60 * 60 * 24 * 7 });
  }
  if (!store.has(sid)) store.set(sid, {});
  return sid;
}

function getTokens(sid) {
  return store.get(sid) || {};
}

function setTokens(sid, tokens) {
  const curr = store.get(sid) || {};
  store.set(sid, { ...curr, ...tokens });
}

module.exports = { ensureSession, getTokens, setTokens };

