// ── Robison Dashboard — app.js ────────────────────────────────────────────────

let accessToken = null;
let tokenExpiresAt = null;

// ── Date display ──────────────────────────────────────────────────────────────
function updateDateDisplay() {
  const el = document.getElementById("date-display");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// ── Team roster ───────────────────────────────────────────────────────────────
async function loadTeam() {
  const grid = document.getElementById("team-grid");
  try {
    const res = await fetch("data/team.json");
    const team = await res.json();
    grid.innerHTML = team.map(agent => `
      <div class="agent-card">
        <div class="agent-avatar" style="border-color: ${agent.color}40">
          <img
            src="${agent.portrait}"
            alt="${agent.name}"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <div class="agent-avatar-fallback" style="background: ${agent.color}; display: none">
            ${agent.initials}
          </div>
        </div>
        <div class="agent-info">
          <div class="agent-name">${agent.name}</div>
          <div class="agent-role" style="color: ${agent.color}">${agent.role}</div>
          <div class="agent-desc">${agent.description}</div>
          <div class="agent-status"><span class="status-dot"></span>Active</div>
        </div>
      </div>
    `).join("");
  } catch (e) {
    grid.innerHTML = `<div class="error-msg">Failed to load team roster.</div>`;
  }
}

// ── To-Do list ────────────────────────────────────────────────────────────────
let todos = [];

async function loadTodos() {
  const container = document.getElementById("todo-list");
  const counter   = document.getElementById("todo-count");
  try {
    const res = await fetch("data/todos.json");
    todos = await res.json();
    renderTodos();
  } catch (e) {
    container.innerHTML = `<div class="error-msg">Failed to load to-dos.</div>`;
  }
}

function renderTodos() {
  const container = document.getElementById("todo-list");
  const counter   = document.getElementById("todo-count");

  // Group by category
  const grouped = {};
  todos.forEach(t => {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push(t);
  });

  let html = "";
  for (const [cat, items] of Object.entries(grouped)) {
    html += `<div class="todo-category">${cat}</div>`;
    items.forEach(t => {
      html += `
        <div class="todo-item${t.done ? " done" : ""}" data-id="${t.id}">
          <div class="todo-checkbox" onclick="toggleTodo(${t.id})"></div>
          <div class="todo-text">${t.text}</div>
          <div class="priority-dot priority-${t.priority}"></div>
        </div>
      `;
    });
  }
  container.innerHTML = html;

  const done  = todos.filter(t => t.done).length;
  const total = todos.length;
  counter.textContent = `${done} of ${total} complete`;
}

function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.done = !todo.done;
    renderTodos();
  }
}

// ── Google OAuth (GIS) ────────────────────────────────────────────────────────
function initGoogleAuth() {
  if (!window.google || !CONFIG.googleClientId || CONFIG.googleClientId === "YOUR_GOOGLE_CLIENT_ID_HERE") {
    showHsaNotConfigured();
    return;
  }

  google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.googleClientId,
    scope: CONFIG.scopes,
    callback: handleTokenResponse,
  });

  // Show sign-in button
  document.getElementById("hsa-connect").style.display = "flex";
}

function handleTokenResponse(response) {
  if (response.error) {
    showHsaError("Google sign-in failed: " + response.error);
    return;
  }
  accessToken = response.access_token;
  tokenExpiresAt = Date.now() + (response.expires_in * 1000);
  document.getElementById("hsa-connect").style.display = "none";
  fetchHsaTotal();
}

function signInGoogle() {
  if (!window.google) return;
  const client = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.googleClientId,
    scope: CONFIG.scopes,
    callback: handleTokenResponse,
  });
  client.requestAccessToken();
}

// ── HSA Tracker ───────────────────────────────────────────────────────────────
async function fetchHsaTotal() {
  const loadingEl = document.getElementById("hsa-loading");
  const dataEl    = document.getElementById("hsa-data");
  const errorEl   = document.getElementById("hsa-error");

  loadingEl.style.display = "flex";
  dataEl.style.display    = "none";
  errorEl.style.display   = "none";

  try {
    const range = `${CONFIG.hsaSheetName}!${CONFIG.hsaTotalCell}`;
    const url   = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.hsaSpreadsheetId}/values/${encodeURIComponent(range)}`;

    const res  = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error?.message || "Sheets API error");

    const raw = data.values?.[0]?.[0];
    if (raw === undefined || raw === null) throw new Error("Cell is empty — check hsaTotalCell in config.js");

    // Parse value — strip $ and commas if present
    const num = parseFloat(String(raw).replace(/[$,]/g, ""));
    if (isNaN(num)) throw new Error(`Unexpected value in cell: "${raw}"`);

    document.getElementById("hsa-total").textContent = formatCurrency(num);
    document.getElementById("hsa-updated").textContent = "Updated " + new Date().toLocaleTimeString();
    document.getElementById("hsa-sheet-link").href =
      `https://docs.google.com/spreadsheets/d/${CONFIG.hsaSpreadsheetId}`;

    loadingEl.style.display = "none";
    dataEl.style.display    = "block";
  } catch (e) {
    loadingEl.style.display = "none";
    errorEl.style.display   = "block";
    errorEl.textContent     = e.message;
  }
}

function formatCurrency(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function showHsaNotConfigured() {
  document.getElementById("hsa-connect").style.display = "none";
  const notConfigured = document.getElementById("hsa-not-configured");
  if (notConfigured) notConfigured.style.display = "block";
}

function showHsaError(msg) {
  const el = document.getElementById("hsa-error");
  el.textContent = msg;
  el.style.display = "block";
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  updateDateDisplay();
  loadTeam();
  loadTodos();
  initGoogleAuth();
});
