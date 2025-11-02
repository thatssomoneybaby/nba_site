async function jsonGET(path) {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

function setOut(data) {
  const out = document.getElementById("out");
  out.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

async function checkAuth() {
  // Best-effort: call games and see if 401
  try {
    const data = await jsonGET("/api/yahoo/games");
    document.getElementById("auth-status").textContent = "Status: Connected";
    setOut(data);
  } catch (e) {
    document.getElementById("auth-status").textContent = "Status: Not connected";
  }
}

function init() {
  document.getElementById("btn-auth").addEventListener("click", () => {
    window.location.href = "/api/auth/yahoo";
  });
  document.getElementById("btn-games").addEventListener("click", async () => {
    try { setOut(await jsonGET("/api/yahoo/games")); } catch (e) { setOut(String(e)); }
  });
  document.getElementById("btn-leagues").addEventListener("click", async () => {
    const keys = document.getElementById("game-keys").value.trim();
    if (!keys) return setOut("Enter game_keys first");
    try { setOut(await jsonGET(`/api/yahoo/leagues?game_keys=${encodeURIComponent(keys)}`)); } catch (e) { setOut(String(e)); }
  });
  document.getElementById("btn-teams").addEventListener("click", async () => {
    const key = document.getElementById("league-key").value.trim();
    if (!key) return setOut("Enter league_key first");
    try { setOut(await jsonGET(`/api/yahoo/teams?league_key=${encodeURIComponent(key)}`)); } catch (e) { setOut(String(e)); }
  });
  document.getElementById("btn-roster").addEventListener("click", async () => {
    const key = document.getElementById("team-key").value.trim();
    if (!key) return setOut("Enter team_key first");
    try { setOut(await jsonGET(`/api/yahoo/roster?team_key=${encodeURIComponent(key)}`)); } catch (e) { setOut(String(e)); }
  });

  checkAuth();
}

document.addEventListener("DOMContentLoaded", init);
