const LS_DRAFT_KEY = "draftHelper:v1:2024-25:default:drafted";
const LS_FILTERS_KEY = "draftHelper:v1:filters";

const state = {
  players: [],
  drafted: new Set(),
  filters: {
    query: "",
    pos: "",
    hideDrafted: false,
    sortKey: "fpts",
    sortDir: -1, // desc
  },
};

function loadPersisted() {
  try {
    const raw = localStorage.getItem(LS_DRAFT_KEY);
    if (raw) state.drafted = new Set(JSON.parse(raw));
  } catch {}
  try {
    const f = JSON.parse(localStorage.getItem(LS_FILTERS_KEY) || "{}");
    Object.assign(state.filters, f);
  } catch {}
}

function persistDrafted() {
  localStorage.setItem(LS_DRAFT_KEY, JSON.stringify([...state.drafted]));
}

function persistFilters() {
  localStorage.setItem(LS_FILTERS_KEY, JSON.stringify(state.filters));
}

function formatNum(n) {
  return typeof n === "number" ? n.toFixed(2).replace(/\.00$/, "") : n;
}

function visibleRows() {
  const q = state.filters.query.trim().toLowerCase();
  const pos = state.filters.pos;
  const hide = state.filters.hideDrafted;
  let rows = state.players;
  if (q) {
    rows = rows.filter((p) =>
      (p.player || "").toLowerCase().includes(q) ||
      (p.team || "").toLowerCase().includes(q)
    );
  }
  if (pos) {
    rows = rows.filter((p) => (p.pos || "").toUpperCase().includes(pos));
  }
  if (hide) {
    rows = rows.filter((p) => !state.drafted.has(p.player_id));
  }

  const [key, dir] = [state.filters.sortKey, state.filters.sortDir];
  rows = rows.slice().sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * dir;
  });

  return rows;
}

function renderCounters() {
  const total = state.players.length;
  const drafted = state.drafted.size;
  const remaining = total - drafted;
  document.getElementById("count-drafted").textContent = `Drafted: ${drafted}`;
  document.getElementById("count-remaining").textContent = `Remaining: ${remaining}`;
  document.getElementById("count-total").textContent = `Total: ${total}`;
}

function renderTable() {
  const tbody = document.getElementById("tbody");
  const empty = document.getElementById("empty");
  const rows = visibleRows();
  tbody.innerHTML = "";

  if (!rows.length) {
    empty.hidden = false;
    renderCounters();
    return;
  }
  empty.hidden = true;

  const frag = document.createDocumentFragment();
  for (const p of rows) {
    const tr = document.createElement("tr");
    const isDrafted = state.drafted.has(p.player_id);

    const tdCheck = document.createElement("td");
    tdCheck.className = "col-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isDrafted;
    checkbox.ariaLabel = `Draft ${p.player}`;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.drafted.add(p.player_id);
      else state.drafted.delete(p.player_id);
      persistDrafted();
      if (state.filters.hideDrafted) {
        renderTable();
      } else {
        // toggle visual state only
        nameCell.classList.toggle("drafted", checkbox.checked);
      }
      renderCounters();
    });
    tdCheck.appendChild(checkbox);

    const tdPlayer = document.createElement("td");
    tdPlayer.className = "player";
    const nameCell = document.createElement("span");
    nameCell.textContent = p.player;
    nameCell.className = isDrafted ? "drafted" : "";
    tdPlayer.appendChild(nameCell);

    const tdTeam = document.createElement("td");
    tdTeam.className = "team";
    tdTeam.textContent = p.team;

    const tdPos = document.createElement("td");
    tdPos.className = "pos";
    tdPos.textContent = p.pos;

    const tdGP = document.createElement("td");
    tdGP.textContent = p.gp;

    const tdMin = document.createElement("td");
    tdMin.textContent = formatNum(p.min);

    const tdFPTS = document.createElement("td");
    tdFPTS.textContent = formatNum(p.fpts);

    const tdPTS = document.createElement("td");
    tdPTS.textContent = formatNum(p.pts);

    const tdREB = document.createElement("td");
    tdREB.textContent = formatNum(p.reb);

    const tdAST = document.createElement("td");
    tdAST.textContent = formatNum(p.ast);

    const tdSTL = document.createElement("td");
    tdSTL.textContent = formatNum(p.stl);

    const tdBLK = document.createElement("td");
    tdBLK.textContent = formatNum(p.blk);

    tr.append(
      tdCheck,
      tdPlayer,
      tdTeam,
      tdPos,
      tdGP,
      tdMin,
      tdFPTS,
      tdPTS,
      tdREB,
      tdAST,
      tdSTL,
      tdBLK
    );
    frag.appendChild(tr);
  }

  tbody.appendChild(frag);
  renderCounters();
}

function wireControls() {
  const search = document.getElementById("search");
  const pos = document.getElementById("pos");
  const sort = document.getElementById("sort");
  const hideDrafted = document.getElementById("hideDrafted");
  const reset = document.getElementById("reset");

  // Init from persisted filters
  search.value = state.filters.query || "";
  pos.value = state.filters.pos || "";
  hideDrafted.checked = !!state.filters.hideDrafted;
  sort.value = `${state.filters.sortKey}:${state.filters.sortDir === -1 ? "desc" : "asc"}`;

  const syncAndRender = () => { persistFilters(); renderTable(); };

  search.addEventListener("input", () => {
    state.filters.query = search.value;
    syncAndRender();
  });
  pos.addEventListener("change", () => {
    state.filters.pos = pos.value;
    syncAndRender();
  });
  sort.addEventListener("change", () => {
    const [key, dir] = sort.value.split(":");
    state.filters.sortKey = key;
    state.filters.sortDir = dir === "desc" ? -1 : 1;
    syncAndRender();
  });
  hideDrafted.addEventListener("change", () => {
    state.filters.hideDrafted = hideDrafted.checked;
    syncAndRender();
  });
  reset.addEventListener("click", () => {
    if (!confirm("Clear drafted selections?")) return;
    state.drafted.clear();
    persistDrafted();
    renderTable();
  });
}

async function init() {
  loadPersisted();
  wireControls();
  try {
    // Fetch from repo root; works locally and on static hosting
    const res = await fetch("./fantasy_averages_2024_25.json", { cache: "no-store" });
    const data = await res.json();
    state.players = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Failed to load data", e);
    state.players = [];
  }
  renderTable();
}

document.addEventListener("DOMContentLoaded", init);

