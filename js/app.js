// Robison Dashboard

function updateDateDisplay() {
  const el = document.getElementById("date-display");
  if (!el) return;

  const now = new Date();
  el.textContent = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function loadTeam() {
  const grid = document.getElementById("team-grid");
  const count = document.getElementById("team-count");

  try {
    const res = await fetch("data/team.json");
    const team = await res.json();

    if (count) count.textContent = `${team.length} specialists active`;

    grid.innerHTML = team.map((agent) => `
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
  } catch (error) {
    if (count) count.textContent = "Roster unavailable";
    grid.innerHTML = `<div class="error-msg">Failed to load team roster.</div>`;
  }
}

let todos = [];

async function loadTodos() {
  const container = document.getElementById("todo-list");

  try {
    const res = await fetch("data/todos.json");
    todos = await res.json();
    renderTodos();
  } catch (error) {
    container.innerHTML = `<div class="error-msg">Failed to load to-dos.</div>`;
  }
}

function renderTodos() {
  const container = document.getElementById("todo-list");
  const counter = document.getElementById("todo-count");
  const grouped = {};

  todos.forEach((todo) => {
    if (!grouped[todo.category]) grouped[todo.category] = [];
    grouped[todo.category].push(todo);
  });

  let html = "";
  for (const [category, items] of Object.entries(grouped)) {
    html += `<div class="todo-category">${category}</div>`;
    items.forEach((todo) => {
      html += `
        <div class="todo-item${todo.done ? " done" : ""}" data-id="${todo.id}">
          <div class="todo-checkbox" onclick="toggleTodo(${todo.id})"></div>
          <div class="todo-text">${todo.text}</div>
          <div class="priority-dot priority-${todo.priority}"></div>
        </div>
      `;
    });
  }

  container.innerHTML = html;

  const done = todos.filter((todo) => todo.done).length;
  counter.textContent = `${done} of ${todos.length} complete`;
}

function toggleTodo(id) {
  const todo = todos.find((item) => item.id === id);
  if (!todo) return;

  todo.done = !todo.done;
  renderTodos();
}

async function fetchHsaTotal() {
  const loadingEl = document.getElementById("hsa-loading");
  const dataEl = document.getElementById("hsa-data");
  const errorEl = document.getElementById("hsa-error");

  loadingEl.style.display = "flex";
  dataEl.style.display = "none";
  errorEl.style.display = "none";

  try {
    const res = await fetch("/api/hsa-total", {
      headers: {
        Accept: "application/json",
      },
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "HSA endpoint error");
    if (typeof data.total !== "number") throw new Error("HSA endpoint did not return a numeric total.");

    document.getElementById("hsa-total").textContent = formatCurrency(data.total);
    document.getElementById("hsa-updated").textContent = `Updated ${new Date().toLocaleTimeString()}`;
    document.getElementById("hsa-sheet-link").href = data.spreadsheetUrl || "#";
    document.getElementById("hsa-sheet-link").style.display = "inline";

    loadingEl.style.display = "none";
    dataEl.style.display = "block";
  } catch (error) {
    loadingEl.style.display = "none";
    showHsaError(error.message);
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function humanizeHsaError(message) {
  const text = String(message || "");
  if (text.includes("Missing HSA service account configuration")) {
    return "HSA service account is not configured for this deployment. Add the private Google service-account settings in Vercel before expecting the HSA card to load.";
  }
  if (text.includes("does not have permission") || text.includes("The caller does not have permission")) {
    return "HSA sheet access is blocked. Share the HSA tracker sheet with the configured Google service account before treating this as a Dashboard code bug.";
  }
  return text;
}

function showHsaError(message) {
  const el = document.getElementById("hsa-error");
  el.textContent = humanizeHsaError(message);
  el.style.display = "block";
}

function renderServiceVisitMeta(label, value) {
  if (!value) return "";

  return `
    <div class="service-visit-meta-item">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderServiceVisitFollowUps(followUps) {
  const items = Array.isArray(followUps) ? followUps : [];
  if (items.length === 0) {
    return `<div class="service-detail">No follow-ups recorded.</div>`;
  }

  return items.map((followUp) => `
    <div class="service-follow-up ${followUp.status === "done" ? "done" : ""}">
      <div class="service-follow-up-dot"></div>
      <div>
        <div class="service-follow-up-text">${followUp.item}</div>
        <div class="service-follow-up-meta">
          ${followUp.owner || "Unassigned"}${followUp.due ? ` | Due ${HomeServiceVisits.formatServiceVisitDate(followUp.due)}` : ""}
        </div>
      </div>
    </div>
  `).join("");
}

function renderServiceVisitDocuments(documents) {
  const items = Array.isArray(documents) ? documents : [];
  if (items.length === 0) return "";

  return `
    <div class="service-documents">
      <div class="service-label">Documents</div>
      ${items.map((doc) => `
        <div class="service-document">
          <span>${doc.type ? doc.type.replace("_", " ") : "document"}</span>
          <strong>${doc.attachment || doc.subject || "Recorded email"}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderServiceVisits(visits) {
  const serviceVisits = Array.isArray(visits) ? visits : [];
  const countEl = document.getElementById("service-visits-count");
  const listEl = document.getElementById("home-service-visits");
  const openFollowUps = HomeServiceVisits.countOpenFollowUps(serviceVisits);

  if (countEl) {
    countEl.textContent = `${serviceVisits.length} visits | ${openFollowUps} follow-ups`;
  }

  if (serviceVisits.length === 0) {
    listEl.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:16px 0">No service visits captured yet.</div>`;
    return;
  }

  listEl.innerHTML = serviceVisits.map((visit) => {
    const statusClass = HomeServiceVisits.getServiceVisitStatus(visit);
    const statusLabel = visit.status ? visit.status.replace("-", " ") : "review";
    const source = visit.source || {};
    const contact = visit.contact || {};
    const acceptedDate = visit.estimate?.accepted_date
      ? HomeServiceVisits.formatServiceVisitDate(visit.estimate.accepted_date)
      : null;

    return `
      <div class="service-visit-card">
        <div class="service-visit-header">
          <div>
            <div class="service-visit-date">${HomeServiceVisits.formatServiceVisitDate(visit.visit_date)}</div>
            <div class="service-visit-title">${visit.vendor}</div>
            <div class="service-visit-subtitle">${visit.category || "Service"}${visit.service_area ? ` &middot; ${visit.service_area}` : ""}</div>
          </div>
          <span class="status-badge status-${statusClass}">${statusLabel}</span>
        </div>
        <div class="service-visit-summary">${visit.summary || "No summary captured yet."}</div>
        <div class="service-visit-meta">
          ${renderServiceVisitMeta("Window", visit.appointment_window)}
          ${renderServiceVisitMeta("Cost", visit.cost ? formatCurrency(visit.cost) : null)}
          ${renderServiceVisitMeta("Warranty", visit.warranty)}
          ${renderServiceVisitMeta("Accepted", acceptedDate)}
          ${renderServiceVisitMeta("Contact", contact.phone || contact.email || contact.name)}
          ${renderServiceVisitMeta("Source", source.type ? `${source.type}${source.mailbox ? ` | ${source.mailbox}` : ""}` : null)}
        </div>
        ${visit.outcome ? `<div class="service-visit-outcome">${visit.outcome}</div>` : ""}
        ${renderServiceVisitDocuments(visit.documents)}
        <div class="service-follow-ups">
          <div class="service-label">Follow-ups</div>
          ${renderServiceVisitFollowUps(visit.follow_ups)}
        </div>
      </div>
    `;
  }).join("");
}

async function loadSpendingChart() {
  try {
    const [actualsRes, retirementRes] = await Promise.all([
      fetch("data/monthly_actuals.json"),
      fetch("data/retirement.json"),
    ]);
    const data = await actualsRes.json();
    const retirement = await retirementRes.json();
    const months = Object.values(data.months);

    const labels = months.map((month) => month.label);
    const income = months.map((month) => month.income);
    const spending = months.map((month) => month.spending_total);
    const retirementSavings = retirement.savings_goal.months.map((month) => month.net_savings);

    const ctx = document.getElementById("spending-chart").getContext("2d");
    new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Income",
            data: income,
            backgroundColor: "rgba(59, 185, 80, 0.8)",
            borderColor: "#3fb950",
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: "Spending",
            data: spending,
            backgroundColor: "rgba(248, 81, 73, 0.75)",
            borderColor: "#f85149",
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: "Net retirement savings",
            data: retirementSavings,
            backgroundColor: "rgba(88, 166, 255, 0.75)",
            borderColor: "#58a6ff",
            borderWidth: 1,
            borderRadius: 4,
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
              label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(48,54,61,0.6)" },
            ticks: { color: "#7d8590" },
          },
          y: {
            grid: { color: "rgba(48,54,61,0.6)" },
            ticks: {
              color: "#7d8590",
              callback: (value) => `$${(value / 1000).toFixed(0)}k`,
            },
          },
        },
      },
    });

    const legendData = [
      { label: "Income", color: "#3fb950" },
      { label: "Spending", color: "#f85149" },
      { label: "Net retirement savings", color: "#58a6ff" },
    ];

    document.getElementById("chart-legend").innerHTML = legendData.map((item) => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${item.color}"></div>
        ${item.label}
      </div>
    `).join("");
  } catch (error) {
    console.error("Chart failed to load:", error);
  }
}

let expenseCategoryChart = null;

const expenseCategoryColors = [
  "#58a6ff", "#bc8cff", "#3fb950", "#f2cc60", "#f85149", "#39c5cf",
  "#db6d9f", "#d29922", "#7ee787", "#79c0ff", "#ff9b73", "#a5d6ff",
  "#d2a8ff", "#56d4dd", "#ffa657", "#8b949e", "#c9d1d9",
];

const expenseCategoryColorMap = {
  Housing: "#58a6ff",
  Medical: "#bc8cff",
  Kids: "#ff9b73",
  "Kids/Activities": "#ff9b73",
  Utilities: "#79c0ff",
  Groceries: "#3fb950",
  "Tithe/Church": "#d29922",
  Auto: "#39c5cf",
  Transportation: "#39c5cf",
  Debt: "#a5d6ff",
  Shopping: "#f2cc60",
  Entertainment: "#56d4dd",
  Gas: "#f85149",
  Dining: "#ffa657",
  "Dining Out": "#ffa657",
  Subscriptions: "#8b949e",
  Home: "#7ee787",
  Misc: "#d2a8ff",
  Insurance: "#db6d9f",
  Uncategorized: "#c9d1d9",
};

function expenseColorFor(category) {
  if (expenseCategoryColorMap[category]) return expenseCategoryColorMap[category];
  let hash = 0;
  for (let index = 0; index < category.length; index += 1) {
    hash = ((hash << 5) - hash + category.charCodeAt(index)) | 0;
  }
  return expenseCategoryColors[Math.abs(hash) % expenseCategoryColors.length];
}

function renderExpenseCategoryMonth(months, monthKey) {
  const month = months[monthKey];
  const totalEl = document.getElementById("expense-total");
  const periodEl = document.getElementById("expense-period-note");
  const legendEl = document.getElementById("expense-category-legend");
  const canvas = document.getElementById("expense-category-chart");
  if (!month || !totalEl || !periodEl || !legendEl || !canvas) return;

  const categories = Object.entries(month.categories || {})
    .filter(([, amount]) => Number(amount) > 0)
    .sort((left, right) => right[1] - left[1]);
  const total = Number(month.spending_total) || categories.reduce((sum, [, amount]) => sum + Number(amount), 0);

  totalEl.textContent = formatCurrency(total);
  periodEl.textContent = `${month.label} category mix`;
  legendEl.innerHTML = categories.map(([category, amount]) => {
    const share = total > 0 ? (Number(amount) / total) * 100 : 0;
    const color = expenseColorFor(category);
    return `
      <div class="expense-category-row">
        <span class="expense-category-swatch" style="background:${color}"></span>
        <span class="expense-category-name">${category}</span>
        <strong>${formatCurrency(amount)}</strong>
        <span class="expense-category-share">${share.toFixed(1)}%</span>
      </div>
    `;
  }).join("");

  if (expenseCategoryChart) expenseCategoryChart.destroy();
  expenseCategoryChart = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: categories.map(([category]) => category),
      datasets: [{
        data: categories.map(([, amount]) => amount),
        backgroundColor: categories.map(([category]) => expenseColorFor(category)),
        borderColor: "#161b22",
        borderWidth: 3,
        hoverBorderColor: "#e6edf3",
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "64%",
      animation: { duration: 420 },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: true,
          callbacks: {
            label: (context) => {
              const share = total > 0 ? (Number(context.raw) / total) * 100 : 0;
              return ` ${context.label}: ${formatCurrency(context.raw)} (${share.toFixed(1)}%)`;
            },
          },
        },
      },
    },
  });
}

async function loadExpenseCategoryChart() {
  const selectEl = document.getElementById("expense-month");
  if (!selectEl) return;

  try {
    const res = await fetch("data/monthly_actuals.json");
    if (!res.ok) throw new Error(`Monthly actuals request failed with ${res.status}.`);
    const data = await res.json();
    const monthEntries = Object.entries(data.months || {}).filter(([, month]) => month.categories);
    if (!monthEntries.length) throw new Error("No categorized monthly actuals are available.");

    selectEl.innerHTML = monthEntries.map(([key, month]) => `<option value="${key}">${month.label}</option>`).join("");
    selectEl.value = monthEntries[monthEntries.length - 1][0];
    renderExpenseCategoryMonth(data.months, selectEl.value);
    selectEl.addEventListener("change", () => renderExpenseCategoryMonth(data.months, selectEl.value));
  } catch (error) {
    console.error("Expense category chart failed to load:", error);
    const periodEl = document.getElementById("expense-period-note");
    if (periodEl) periodEl.textContent = "Category detail is unavailable. Refresh after Finley data is republished.";
  }
}

async function loadHome() {
  try {
    const res = await fetch("data/home.json");
    const data = await res.json();
    const property = data.property;

    document.getElementById("home-property").innerHTML = `
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">${property.address}</div>
      <div class="auto-info-row">
        <span class="auto-info-label">Est. Value</span>
        <span class="auto-info-value highlight">${formatCurrency(property.estimated_value)}</span>
      </div>
      <div class="auto-info-row">
        <span class="auto-info-label">Sq Ft</span>
        <span class="auto-info-value">${property.sqft ? property.sqft.toLocaleString() : "&mdash;"}</span>
      </div>
      <div class="auto-info-row">
        <span class="auto-info-label">Mortgage</span>
        <span class="auto-info-value">${formatCurrency(property.mortgage_payment)} / mo</span>
      </div>
      <div class="auto-info-row">
        <span class="auto-info-label">Servicer</span>
        <span class="auto-info-value">${property.mortgage_payee}</span>
      </div>
      <div class="auto-info-row">
        <span class="auto-info-label">Payoff</span>
        <span class="auto-info-value">${property.mortgage_payoff || "&mdash;"}</span>
      </div>
    `;

    const openProjects = data.projects.filter((item) => item.status === "open");
    const projCount = document.getElementById("projects-count");
    if (projCount) projCount.textContent = `${openProjects.length} open`;

    document.getElementById("home-projects").innerHTML = data.projects.map((project) => `
      <div class="home-project-item">
        <div class="home-project-header">
          <span class="home-project-name">${project.item}</span>
          <span class="status-badge status-${project.priority === "high" ? "urgent" : project.priority === "medium" ? "soon" : "ok"}">${project.priority}</span>
        </div>
        <div class="service-detail">${project.notes}</div>
      </div>
    `).join("");

    document.getElementById("home-services").innerHTML = data.services.map((service) => `
      <div class="home-service-item">
        <div class="home-service-header">
          <span class="home-service-name">${service.name}</span>
          <span style="font-size:11px;color:var(--text-muted)">${service.type}</span>
        </div>
        ${service.monthly ? `<div class="auto-info-row" style="padding:4px 0"><span class="auto-info-label">Monthly</span><span class="auto-info-value">${formatCurrency(service.monthly)}</span></div>` : ""}
        ${service.phone ? `<div class="auto-info-row" style="padding:4px 0"><span class="auto-info-label">Phone</span><span class="auto-info-value">${service.phone}</span></div>` : ""}
        <div class="service-detail" style="margin-top:4px">${service.notes}</div>
      </div>
    `).join("");

    renderServiceVisits(data.service_visits);

    const applianceCount = document.getElementById("appliances-count");
    if (applianceCount) applianceCount.textContent = `${data.appliances.length} items`;

    document.getElementById("home-appliances").innerHTML = data.appliances.map((appliance) => `
      <div class="home-appliance-item">
        <div class="home-appliance-header">
          <span class="home-appliance-name">${appliance.name}</span>
          <span class="status-badge status-${appliance.status === "ok" ? "ok" : "soon"}">${appliance.status === "watch" ? "Watch" : "OK"}</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${appliance.brand} &middot; ${appliance.model}</div>
        ${appliance.serial ? `<div style="font-size:11px;color:var(--text-muted);margin-top:1px">S/N: ${appliance.serial}</div>` : ""}
        <div class="service-detail" style="margin-top:3px">${appliance.notes}</div>
      </div>
    `).join("");
  } catch (error) {
    console.error("Home load failed:", error);
  }
}

async function loadAutomotive() {
  try {
    const res = await fetch("data/automotive.json");
    const data = await res.json();
    const grid = document.getElementById("vehicle-grid");
    const count = document.getElementById("vehicle-count");

    if (count) count.textContent = `${data.vehicles.length} vehicles`;

    grid.innerHTML = data.vehicles.map((vehicle) => {
      const mileageStr = vehicle.mileage
        ? `${vehicle.mileage.toLocaleString()} mi${vehicle.mileage_date ? ` | ${formatShortDate(vehicle.mileage_date)}` : ""}`
        : "Mileage unknown";
      const oilChangeLabel = formatAutomotiveServiceLabel(vehicle.oil_change.label);

      const photoHtml = vehicle.image
        ? `<img src="${vehicle.image}" alt="${vehicle.year} ${vehicle.make} ${vehicle.model}" class="vehicle-photo"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
           <div class="vehicle-photo-fallback" style="display:none">&#128664;</div>`
        : `<div class="vehicle-photo-fallback">&#128664;</div>`;

      return `
        <div class="vehicle-card">
          <div class="vehicle-photo-wrap">${photoHtml}</div>
          <div>
            <div class="vehicle-year-make">${vehicle.year} &middot; ${vehicle.make}</div>
            <div class="vehicle-model">${vehicle.model}</div>
            <div class="vehicle-driver">${vehicle.driver}</div>
          </div>
          <div class="vehicle-mileage">&#128205; ${mileageStr}</div>
          <div class="vehicle-divider"></div>
          <div class="vehicle-service">
            <div class="service-label">Oil Change</div>
            <span class="status-badge status-${vehicle.oil_change.status}">${oilChangeLabel}</span>
            <div class="service-detail">${vehicle.oil_change.detail}</div>
          </div>
        </div>
      `;
    }).join("");

    const insurance = data.insurance;
    const renewalDate = new Date(insurance.next_renewal);
    const daysToRenewal = Math.ceil((renewalDate - new Date()) / (1000 * 60 * 60 * 24));
    const renewalWarning = daysToRenewal <= 60
      ? `<div class="renewal-alert">&#9888; Renewal in ${daysToRenewal} days &mdash; ${insurance.next_renewal}</div>`
      : "";

    document.getElementById("insurance-data").innerHTML = `
      <div class="auto-info-row">
        <span class="auto-info-label">Carrier</span>
        <span class="auto-info-value highlight">${insurance.carrier}</span>
      </div>
      <div class="auto-info-row">
        <span class="auto-info-label">Premium</span>
        <span class="auto-info-value">${formatCurrency(insurance.premium)} / ${insurance.frequency.toLowerCase()}</span>
      </div>
      <div class="auto-info-row">
        <span class="auto-info-label">Annualized</span>
        <span class="auto-info-value">${formatCurrency(insurance.premium * 2)} / year</span>
      </div>
      <div class="auto-info-row">
        <span class="auto-info-label">Next Renewal</span>
        <span class="auto-info-value ${daysToRenewal <= 60 ? "warning" : ""}">${insurance.next_renewal}</span>
      </div>
      ${renewalWarning}
    `;

    const loans = data.vehicles.filter((vehicle) => vehicle.loan);
    const loanEl = document.getElementById("loan-data");

    if (loans.length === 0) {
      loanEl.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:16px 0">No active vehicle loans.</div>`;
    } else {
      loanEl.innerHTML = loans.map((vehicle) => `
        <div style="margin-bottom:16px">
          <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px">${vehicle.year} ${vehicle.make} ${vehicle.model}</div>
          <div class="auto-info-row">
            <span class="auto-info-label">Lender</span>
            <span class="auto-info-value">${vehicle.loan.lender}</span>
          </div>
          <div class="auto-info-row">
            <span class="auto-info-label">Balance</span>
            <span class="auto-info-value danger">${formatCurrency(vehicle.loan.balance)}</span>
          </div>
          <div class="auto-info-row">
            <span class="auto-info-label">Monthly</span>
            <span class="auto-info-value">${formatCurrency(vehicle.loan.monthly)}</span>
          </div>
          <div class="auto-info-row">
            <span class="auto-info-label">Rate</span>
            <span class="auto-info-value">${vehicle.loan.rate}</span>
          </div>
        </div>
      `).join("");
    }
  } catch (error) {
    console.error("Automotive load failed:", error);
  }
}

function formatShortDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function loadInvestments() {
  const totalEl = document.getElementById("investment-total");
  const changeEl = document.getElementById("investment-change");
  const updatedEl = document.getElementById("investment-updated");
  const accountsEl = document.getElementById("investment-accounts");
  const spyiValueEl = document.getElementById("spyi-value");
  const spyiShareEl = document.getElementById("spyi-share");
  const spyiRailEl = document.getElementById("spyi-rail-fill");
  const noteEl = document.getElementById("investment-note");

  try {
    const res = await fetch("data/investments.json");
    if (!res.ok && typeof res.ok !== "undefined") throw new Error("Investment data unavailable");
    const data = await res.json();
    const changePrefix = data.change_since_prior < 0 ? "-" : "+";
    const changeClass = data.change_since_prior < 0 ? "negative" : "positive";

    if (totalEl) totalEl.textContent = formatCurrency(data.portfolio_value);
    if (changeEl) {
      changeEl.textContent = `${changePrefix}${formatCurrency(Math.abs(data.change_since_prior))} (${data.change_since_prior_pct.toFixed(2)}%) since Jun 20`;
      changeEl.className = `investment-change ${changeClass}`;
    }
    if (updatedEl) updatedEl.textContent = `Verified ${formatShortDate(data.as_of)}`;
    if (accountsEl) {
      accountsEl.innerHTML = data.accounts.map((account) => `
        <div class="investment-account">
          <span>${account.label}</span>
          <strong>${formatCurrency(account.value)}</strong>
        </div>
      `).join("");
    }
    if (spyiValueEl) spyiValueEl.textContent = formatCurrency(data.spyi.value);
    if (spyiShareEl) spyiShareEl.textContent = `${data.spyi.portfolio_share_pct.toFixed(2)}% of portfolio`;
    if (spyiRailEl) spyiRailEl.style.width = `${Math.min(data.spyi.portfolio_share_pct, 100)}%`;
    if (noteEl) noteEl.textContent = data.note;
  } catch (error) {
    console.error("Investment data load failed:", error);
    if (updatedEl) updatedEl.textContent = "Portfolio unavailable";
    if (noteEl) noteEl.textContent = "The verified investment snapshot could not be loaded. Refresh after the dashboard data is republished.";
  }
}

function cumulativeValues(values) {
  let total = 0;
  return values.map((value) => {
    total += Number(value);
    return Number(total.toFixed(2));
  });
}

function retirementChartScales() {
  return {
    x: {
      grid: { display: false },
      ticks: { color: "#7d8590", maxRotation: 0 },
    },
    y: {
      border: { display: false },
      grid: { color: "rgba(48,54,61,0.55)" },
      ticks: {
        color: "#7d8590",
        callback: (value) => `$${(value / 1000).toFixed(0)}k`,
      },
    },
  };
}

async function loadRetirementCharts() {
  try {
    const res = await fetch("data/retirement.json");
    if (!res.ok && typeof res.ok !== "undefined") throw new Error("Retirement data unavailable");
    const data = await res.json();
    const goal = data.savings_goal;
    const progress = (goal.net_savings / goal.annual_target) * 100;
    const remaining = Math.max(goal.annual_target - goal.net_savings, 0);
    const monthlyNet = goal.months.map((month) => month.net_savings);
    const cumulativeNet = cumulativeValues(monthlyNet);
    const yearStart = Date.UTC(goal.year, 0, 1);
    const nextYearStart = Date.UTC(goal.year + 1, 0, 1);
    const daysInYear = (nextYearStart - yearStart) / 86400000;
    const goalPace = goal.months.map((month) => {
      const [year, monthNumber, day] = month.period_end.split("-").map(Number);
      const daysElapsed = ((Date.UTC(year, monthNumber - 1, day) - yearStart) / 86400000) + 1;
      return goal.annual_target * (daysElapsed / daysInYear);
    });

    document.getElementById("retirement-savings-as-of").textContent = `Through ${formatShortDate(data.as_of)}`;
    document.getElementById("retirement-savings-total").textContent = formatCurrency(goal.net_savings);
    document.getElementById("retirement-savings-progress").textContent = `${progress.toFixed(1)}%`;
    document.getElementById("retirement-savings-remaining").textContent = `${formatCurrency(remaining)} remaining`;

    new Chart(document.getElementById("retirement-savings-chart").getContext("2d"), {
      type: "line",
      data: {
        labels: goal.months.map((month) => month.label),
        datasets: [
          {
            label: "Net retirement savings",
            data: cumulativeNet,
            borderColor: "#7ee787",
            backgroundColor: "rgba(63, 185, 80, 0.14)",
            borderWidth: 3,
            pointBackgroundColor: monthlyNet.map((value) => value < 0 ? "#f85149" : "#7ee787"),
            pointBorderColor: "#161b22",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.28,
          },
          {
            label: "Goal pace",
            data: goalPace,
            borderColor: "rgba(242, 204, 96, 0.8)",
            borderDash: [6, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            tension: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
              afterBody: (items) => {
                const index = items[0].dataIndex;
                return `Monthly net: ${formatCurrency(monthlyNet[index])}`;
              },
            },
          },
        },
        scales: retirementChartScales(),
      },
    });

    const points = data.portfolio_history.points;
    const latest = points[points.length - 1];
    const first = points[0];
    const change = latest.value - first.value;
    const changePct = (change / first.value) * 100;
    const changePrefix = change < 0 ? "-" : "+";

    document.getElementById("retirement-history-as-of").textContent = `Through ${formatShortDate(latest.date)}`;
    document.getElementById("retirement-history-value").textContent = formatCurrency(latest.value);
    document.getElementById("retirement-history-change").textContent = `${changePrefix}${formatCurrency(Math.abs(change))} (${changePct.toFixed(1)}%) over 12 months`;
    document.getElementById("retirement-history-change").classList.add(change < 0 ? "negative" : "positive");
    document.getElementById("retirement-history-note").textContent = data.portfolio_history.note;

    const historyCanvas = document.getElementById("retirement-history-chart");
    const gradient = historyCanvas.getContext("2d").createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, "rgba(88, 166, 255, 0.28)");
    gradient.addColorStop(1, "rgba(88, 166, 255, 0.01)");

    new Chart(historyCanvas.getContext("2d"), {
      type: "line",
      data: {
        labels: points.map((point) => new Date(`${point.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "2-digit" })),
        datasets: [{
          label: "Retirement portfolio",
          data: points.map((point) => point.value),
          borderColor: "#58a6ff",
          backgroundColor: gradient,
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: "#a5d6ff",
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` ${formatCurrency(ctx.raw)}` } },
        },
        scales: retirementChartScales(),
      },
    });
  } catch (error) {
    console.error("Retirement charts failed to load:", error);
    const savingsAsOf = document.getElementById("retirement-savings-as-of");
    const historyAsOf = document.getElementById("retirement-history-as-of");
    if (savingsAsOf) savingsAsOf.textContent = "Savings data unavailable";
    if (historyAsOf) historyAsOf.textContent = "History unavailable";
  }
}

function formatAutomotiveServiceLabel(label) {
  const match = /^(.+? )(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(label);
  if (!match) return label;

  const [, prefix, month, day, year] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return `${prefix}${formatShortDate(iso)}`;
}

function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".tab-btn").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${tab}`).classList.add("active");
    });
  });

  if (typeof window !== "undefined" && typeof document.querySelector === "function") {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    const requestedButton = requestedTab
      ? document.querySelector(`.tab-btn[data-tab="${requestedTab}"]`)
      : null;
    if (requestedButton) requestedButton.click();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateDateDisplay();
  initTabs();
  loadTeam();
  loadTodos();
  loadSpendingChart();
  loadExpenseCategoryChart();
  loadInvestments();
  loadRetirementCharts();
  fetchHsaTotal();
  loadAutomotive();
  loadHome();
});
