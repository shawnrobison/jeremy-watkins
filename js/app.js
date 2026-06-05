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
    const url   = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.hsaSpreadsheetId}/values/${encodeURIComponent(range)}?key=${CONFIG.googleApiKey}`;

    const res  = await fetch(url);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error?.message || "Sheets API error");

    const raw = data.values?.[0]?.[0];
    if (raw === undefined || raw === null) throw new Error("Cell is empty — check hsaTotalCell in config.js");

    const num = parseFloat(String(raw).replace(/[$,]/g, ""));
    if (isNaN(num)) throw new Error(`Unexpected value in cell: "${raw}"`);

    document.getElementById("hsa-total").textContent = formatCurrency(num);
    document.getElementById("hsa-updated").textContent = "Updated " + new Date().toLocaleTimeString();
    document.getElementById("hsa-sheet-link").href =
      `https://docs.google.com/spreadsheets/d/${CONFIG.hsaSpreadsheetId}`;
    document.getElementById("hsa-sheet-link").style.display = "inline";

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

// ── Spending Chart ────────────────────────────────────────────────────────────
async function loadSpendingChart() {
  try {
    const res  = await fetch("data/monthly_actuals.json");
    const data = await res.json();
    const months = Object.values(data.months);

    const labels   = months.map(m => m.label);
    const income   = months.map(m => m.income);
    const spending = months.map(m => m.spending_total);
    const savings  = months.map(m => m.savings);

    const ctx = document.getElementById("spending-chart").getContext("2d");
    new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label:           "Income",
            data:            income,
            backgroundColor: "rgba(59, 185, 80, 0.8)",
            borderColor:     "#3fb950",
            borderWidth:     1,
            borderRadius:    4,
          },
          {
            label:           "Spending",
            data:            spending,
            backgroundColor: "rgba(248, 81, 73, 0.75)",
            borderColor:     "#f85149",
            borderWidth:     1,
            borderRadius:    4,
          },
          {
            label:           "Savings",
            data:            savings,
            backgroundColor: "rgba(88, 166, 255, 0.75)",
            borderColor:     "#58a6ff",
            borderWidth:     1,
            borderRadius:    4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
            },
          },
        },
        scales: {
          x: {
            grid:  { color: "rgba(48,54,61,0.6)" },
            ticks: { color: "#7d8590" },
          },
          y: {
            grid:  { color: "rgba(48,54,61,0.6)" },
            ticks: {
              color: "#7d8590",
              callback: v => "$" + (v / 1000).toFixed(0) + "k",
            },
          },
        },
      },
    });

    // Custom legend
    const legendData = [
      { label: "Income",   color: "#3fb950" },
      { label: "Spending", color: "#f85149" },
      { label: "Savings",  color: "#58a6ff" },
    ];
    document.getElementById("chart-legend").innerHTML = legendData.map(l =>
      `<div class="legend-item">
         <div class="legend-dot" style="background:${l.color}"></div>
         ${l.label}
       </div>`
    ).join("");

  } catch (e) {
    console.error("Chart failed to load:", e);
  }
}

// ── Home ──────────────────────────────────────────────────────────────────────
async function loadHome() {
  try {
    const res  = await fetch("data/home.json");
    const data = await res.json();

    // Property
    const p = data.property;
    const payoffYear = p.mortgage_payoff ? p.mortgage_payoff.split("-")[0] : "—";
    document.getElementById("home-property").innerHTML = `
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">${p.address}</div>
      <div class="auto-info-row">
        <span class="auto-info-label">Est. Value</span>
        <span class="auto-info-value highlight">${formatCurrency(p.estimated_value)}</span>
      </div>
      <div class="auto-info-row">
        <span class="auto-info-label">Sq Ft</span>
        <span class="auto-info-value">${p.sqft ? p.sqft.toLocaleString() : "—"}</span>
      </div>
      <div class="auto-info-row">
        <span class="auto-info-label">Mortgage</span>
        <span class="auto-info-value">${formatCurrency(p.mortgage_payment)} / mo</span>
      </div>
      <div class="auto-info-row">
        <span class="auto-info-label">Servicer</span>
        <span class="auto-info-value">${p.mortgage_payee}</span>
      </div>
      <div class="auto-info-row">
        <span class="auto-info-label">Payoff</span>
        <span class="auto-info-value">${p.mortgage_payoff || "—"}</span>
      </div>
    `;

    // Projects
    const openProjects = data.projects.filter(x => x.status === "open");
    const projCount = document.getElementById("projects-count");
    if (projCount) projCount.textContent = `${openProjects.length} open`;
    document.getElementById("home-projects").innerHTML = data.projects.map(proj => `
      <div class="home-project-item">
        <div class="home-project-header">
          <span class="home-project-name">${proj.item}</span>
          <span class="status-badge status-${proj.priority === "high" ? "urgent" : proj.priority === "medium" ? "soon" : "ok"}">${proj.priority}</span>
        </div>
        <div class="service-detail">${proj.notes}</div>
      </div>
    `).join("");

    // Services
    document.getElementById("home-services").innerHTML = data.services.map(s => `
      <div class="home-service-item">
        <div class="home-service-header">
          <span class="home-service-name">${s.name}</span>
          <span style="font-size:11px;color:var(--text-muted)">${s.type}</span>
        </div>
        ${s.monthly ? `<div class="auto-info-row" style="padding:4px 0"><span class="auto-info-label">Monthly</span><span class="auto-info-value">${formatCurrency(s.monthly)}</span></div>` : ""}
        ${s.phone ? `<div class="auto-info-row" style="padding:4px 0"><span class="auto-info-label">Phone</span><span class="auto-info-value">${s.phone}</span></div>` : ""}
        <div class="service-detail" style="margin-top:4px">${s.notes}</div>
      </div>
    `).join("");

    // Appliances
    const appCount = document.getElementById("appliances-count");
    if (appCount) appCount.textContent = `${data.appliances.length} items`;
    document.getElementById("home-appliances").innerHTML = data.appliances.map(a => `
      <div class="home-appliance-item">
        <div class="home-appliance-header">
          <span class="home-appliance-name">${a.name}</span>
          <span class="status-badge status-${a.status === "ok" ? "ok" : "soon"}">${a.status === "watch" ? "Watch" : "OK"}</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${a.brand} &middot; ${a.model}</div>
        ${a.serial ? `<div style="font-size:11px;color:var(--text-muted);margin-top:1px">S/N: ${a.serial}</div>` : ""}
        <div class="service-detail" style="margin-top:3px">${a.notes}</div>
      </div>
    `).join("");

  } catch (e) {
    console.error("Home load failed:", e);
  }
}

// ── Automotive ────────────────────────────────────────────────────────────────
async function loadAutomotive() {
  try {
    const res  = await fetch("data/automotive.json");
    const data = await res.json();

    // Vehicles
    const grid  = document.getElementById("vehicle-grid");
    const count = document.getElementById("vehicle-count");
    if (count) count.textContent = `${data.vehicles.length} vehicles`;

    grid.innerHTML = data.vehicles.map(v => {
      const mileageStr = v.mileage
        ? `${v.mileage.toLocaleString()} mi${v.mileage_date ? " · " + formatShortDate(v.mileage_date) : ""}`
        : "Mileage unknown";

      const photoHtml = v.image
        ? `<img src="${v.image}" alt="${v.year} ${v.make} ${v.model}" class="vehicle-photo"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
           <div class="vehicle-photo-fallback" style="display:none">&#128664;</div>`
        : `<div class="vehicle-photo-fallback">&#128664;</div>`;

      return `
        <div class="vehicle-card">
          <div class="vehicle-photo-wrap">${photoHtml}</div>
          <div>
            <div class="vehicle-year-make">${v.year} &middot; ${v.make}</div>
            <div class="vehicle-model">${v.model}</div>
            <div class="vehicle-driver">${v.driver}</div>
          </div>
          <div class="vehicle-mileage">&#128205; ${mileageStr}</div>
          <div class="vehicle-divider"></div>
          <div class="vehicle-service">
            <div class="service-label">Oil Change</div>
            <span class="status-badge status-${v.oil_change.status}">${v.oil_change.label}</span>
            <div class="service-detail">${v.oil_change.detail}</div>
          </div>
        </div>
      `;
    }).join("");

    // Insurance
    const ins = data.insurance;
    const renewalDate    = new Date(ins.next_renewal);
    const daysToRenewal  = Math.ceil((renewalDate - new Date()) / (1000 * 60 * 60 * 24));
    const renewalWarning = daysToRenewal <= 60
      ? `<div class="renewal-alert">&#9888; Renewal in ${daysToRenewal} days &mdash; ${ins.next_renewal}</div>` : "";

    document.getElementById("insurance-data").innerHTML = `
      <div class="auto-info-row">
        <span class="auto-info-label">Carrier</span>
        <span class="auto-info-value highlight">${ins.carrier}</span>
      </div>
      <div class="auto-info-row">
        <span class="auto-info-label">Premium</span>
        <span class="auto-info-value">${formatCurrency(ins.premium)} / ${ins.frequency.toLowerCase()}</span>
      </div>
      <div class="auto-info-row">
        <span class="auto-info-label">Annualized</span>
        <span class="auto-info-value">${formatCurrency(ins.premium * 2)} / year</span>
      </div>
      <div class="auto-info-row">
        <span class="auto-info-label">Next Renewal</span>
        <span class="auto-info-value ${daysToRenewal <= 60 ? "warning" : ""}">${ins.next_renewal}</span>
      </div>
      ${renewalWarning}
    `;

    // Loans
    const loans = data.vehicles.filter(v => v.loan);
    const loanEl = document.getElementById("loan-data");
    if (loans.length === 0) {
      loanEl.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:16px 0">No active vehicle loans.</div>`;
    } else {
      loanEl.innerHTML = loans.map(v => `
        <div style="margin-bottom:16px">
          <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px">${v.year} ${v.make} ${v.model}</div>
          <div class="auto-info-row">
            <span class="auto-info-label">Lender</span>
            <span class="auto-info-value">${v.loan.lender}</span>
          </div>
          <div class="auto-info-row">
            <span class="auto-info-label">Balance</span>
            <span class="auto-info-value danger">${formatCurrency(v.loan.balance)}</span>
          </div>
          <div class="auto-info-row">
            <span class="auto-info-label">Monthly</span>
            <span class="auto-info-value">${formatCurrency(v.loan.monthly)}</span>
          </div>
          <div class="auto-info-row">
            <span class="auto-info-label">Rate</span>
            <span class="auto-info-value">${v.loan.rate}</span>
          </div>
        </div>
      `).join("");
    }

  } catch (e) {
    console.error("Automotive load failed:", e);
  }
}

function formatShortDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + tab).classList.add("active");
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  updateDateDisplay();
  initTabs();
  loadTeam();
  loadTodos();
  loadSpendingChart();
  fetchHsaTotal();
  loadAutomotive();
  loadHome();
});
