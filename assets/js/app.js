// Общая часть всех страниц: меню, верхняя панель, тема и цикл симулятора.

const NAV = [
  { href: "dashboard.html", icon: "📊", title: "Панель управления" },
  { href: "zones.html", icon: "🌱", title: "Зоны" },
  { href: "sensors.html", icon: "📡", title: "Датчики" },
  { href: "control.html", icon: "🎛", title: "Управление" },
  { href: "alerts.html", icon: "🚨", title: "Тревоги и журнал" },
  { href: "analytics.html", icon: "🧠", title: "Аналитика" },
  { href: "settings.html", icon: "⚙️", title: "Настройки" }
];

const LABELS = {
  normal: "Норма", warning: "Внимание", critical: "Критично",
  online: "В сети", offline: "Не в сети",
  open: "Открыта", acknowledged: "Принята", resolved: "Решена",
  auto: "АВТО", manual: "РУЧНОЙ",
  automation: "Автоматика", manualSrc: "Оператор", system: "Система"
};

function badge(value, text) {
  return `<span class="badge badge-${value}">${text || LABELS[value] || value}</span>`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, ch =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function zoneName(id) {
  const z = getZones().find(x => x.id === id);
  return z ? z.name : id;
}

function fmt(field, value) {
  if (value === null || value === undefined || value === "") return "—";
  const unit = SENSOR_TYPES.find(t => t.field === field).unit;
  const v = field === "light" ? Number(value).toLocaleString("ru-RU") : value;
  return `${v} ${unit}`;
}

function toast(text) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.append(t);
  }
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(t.timer);
  t.timer = setTimeout(() => t.classList.remove("show"), 2000);
}

// ---------- Тема ----------
function applyTheme() {
  // по умолчанию светлая «дневная» тема
  document.body.classList.toggle("light", localStorage.getItem(KEYS.theme) !== "dark");
}

function toggleTheme() {
  document.body.classList.toggle("light");
  localStorage.setItem(KEYS.theme, document.body.classList.contains("light") ? "light" : "dark");
  document.dispatchEvent(new Event("gh:render"));
}

function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function chartDefaults() {
  if (!window.Chart) return;
  Chart.defaults.color = cssVar("--muted");
  Chart.defaults.borderColor = cssVar("--line");
  Chart.defaults.font.family = "Inter, Segoe UI, Arial, sans-serif";
  Chart.defaults.animation = false;
}

const ZONE_COLORS = ["--red", "--green", "--lime"];
function zoneColor(i) {
  return cssVar(ZONE_COLORS[i % ZONE_COLORS.length]);
}

// Карточка зоны (используется на «Панели управления» и странице «Зоны»).
function zoneCard(zone, settings, sensors) {
  const st = settings.zones[zone.id];
  const risk = calculateRisk(zone, st, sensors);
  const level = riskLevel(risk);
  const cls = (bad, warn) => bad ? "bad" : warn ? "warn" : "";
  const offline = f => sensors.some(s => s.zoneId === zone.id && s.field === f && s.status === "offline");
  const m = (field, label, c) => offline(field)
    ? `<div class="metric warn"><small>${label}</small><b>нет связи</b></div>`
    : `<div class="metric ${c}"><small>${label}</small><b>${fmt(field, zone[field])}</b></div>`;
  return `
    <div class="zone-card ${level}">
      <div class="zone-head">
        <div><h3>${escapeHtml(zone.name)}</h3><small>${zone.id} · ${escapeHtml(zone.crop)}</small></div>
        ${badge(zone.mode)}
      </div>
      <div class="metrics">
        ${m("temperature", "Температура", cls(zone.temperature > st.temperature.max + 4 || zone.temperature < st.temperature.min - 4, zone.temperature > st.temperature.max || zone.temperature < st.temperature.min))}
        ${m("humidity", "Влажность", cls(false, zone.humidity < st.humidity.min || zone.humidity > st.humidity.max))}
        ${m("soil", "Почва", cls(zone.soil < st.soil.min - 10, zone.soil < st.soil.min))}
        ${m("light", "Свет", cls(false, zone.light < st.light.min))}
        ${m("co2", "CO2", cls(zone.co2 > 1500, zone.co2 > st.co2.max))}
        ${m("waterLevel", "Вода", cls(zone.waterLevel <= st.waterLevel.critical, zone.waterLevel <= st.waterLevel.critical + 10))}
      </div>
      <div class="risk">
        <div class="risk-top"><span>Risk score</span><b>${risk} / 100 · ${LABELS[level]}</b></div>
        <div class="risk-track"><div class="risk-bar ${level}" style="width:${Math.max(risk, 3)}%"></div></div>
      </div>
      <div class="act-row">${ACTUATORS.map(a => `<span class="act-chip ${zone.actuators[a.key] ? "on" : ""}">${a.icon} ${a.name}</span>`).join("")}</div>
    </div>`;
}

// ---------- Макет ----------
function renderLayout(pageTitle) {
  const current = location.pathname.split("/").pop() || "dashboard.html";

  const sidebar = document.createElement("aside");
  sidebar.className = "sidebar";
  sidebar.innerHTML = `
    <a class="logo" href="index.html"><span class="logo-mark">🌿</span><div><b>Умная теплица IoT</b><small id="ghName"></small></div></a>
    <nav>${NAV.map(n => `<a href="${n.href}" class="${n.href === current ? "active" : ""}"><span>${n.icon}</span>${n.title}</a>`).join("")}</nav>
    <div class="sidebar-foot" id="simState"></div>`;

  const topbar = document.createElement("header");
  topbar.className = "topbar";
  topbar.innerHTML = `
    <button class="icon-btn menu-btn" id="menuBtn" aria-label="Меню">☰</button>
    <h1>${pageTitle}</h1>
    <span class="mode-indicator" id="modeIndicator"></span>
    <button class="icon-btn" id="pauseBtn" title="Пауза / запуск симулятора" aria-label="Пауза симулятора"></button>
    <button class="icon-btn" id="themeButton" title="Сменить тему" aria-label="Сменить тему">◐</button>
    <div class="notif">
      <button class="icon-btn" id="notifBtn" aria-label="Тревоги">🔔<span class="count" id="alertCount"></span></button>
      <div class="notif-panel" id="notifPanel"></div>
    </div>
    <div class="profile"><span class="avatar">Э</span><div><b>Эсенканов Н.А.</b><small>Оператор теплицы</small></div></div>`;

  document.body.prepend(sidebar);
  document.querySelector("main").prepend(topbar);
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  document.body.append(overlay);

  document.getElementById("menuBtn").addEventListener("click", () => document.body.classList.toggle("menu-open"));
  overlay.addEventListener("click", () => document.body.classList.remove("menu-open"));
  document.getElementById("themeButton").addEventListener("click", toggleTheme);
  document.getElementById("pauseBtn").addEventListener("click", () => {
    const s = getSettings();
    s.paused = !s.paused;
    saveData(KEYS.settings, s);
    logEvent("—", "manual", s.paused ? "SIM_PAUSE" : "SIM_RESUME", s.paused ? "Симулятор приостановлен" : "Симулятор запущен");
    updateTopbar();
    startLoop();
  });
  document.getElementById("notifBtn").addEventListener("click", e => {
    e.stopPropagation();
    document.getElementById("notifPanel").classList.toggle("open");
  });
  document.addEventListener("click", () => document.getElementById("notifPanel").classList.remove("open"));

  updateTopbar();
  startLoop();
  return true;
}

function updateTopbar() {
  const zones = getZones();
  const settings = getSettings();
  const open = getAlerts().filter(a => a.status !== "resolved");
  const autoCount = zones.filter(z => z.mode === "auto").length;

  document.getElementById("ghName").textContent = settings.greenhouseName;
  const mi = document.getElementById("modeIndicator");
  mi.className = "mode-indicator " + (autoCount === zones.length ? "auto" : autoCount === 0 ? "manual" : "mixed");
  mi.textContent = `АВТО ${autoCount} / ${zones.length}`;
  mi.title = zones.map(z => `${z.name}: ${LABELS[z.mode]}`).join(", ");

  document.getElementById("pauseBtn").textContent = settings.paused ? "▶" : "⏸";
  document.getElementById("simState").innerHTML = settings.paused
    ? '<span class="dot off"></span> Симулятор на паузе'
    : `<span class="dot"></span> Замер каждые ${settings.speed} с`;

  const count = document.getElementById("alertCount");
  count.textContent = open.length || "";
  count.hidden = !open.length;
  document.getElementById("notifPanel").innerHTML = `<b>Активные тревоги (${open.length})</b>` +
    (open.slice(0, 8).map(a => `<div class="notif-item ${a.severity}"><small>${zoneName(a.zoneId)} · ${a.createdAt.slice(11, 16)}</small>${escapeHtml(a.message)}</div>`).join("") ||
      "<p>Тревог нет</p>") + '<a href="alerts.html">Все тревоги →</a>';
}

// Цикл симулятора: каждые N секунд новый замер, затем страница перерисовывается.
let loopTimer = null;
function startLoop() {
  clearInterval(loopTimer);
  const s = getSettings();
  if (s.paused) return;
  loopTimer = setInterval(() => {
    tick();
    updateTopbar();
    document.dispatchEvent(new Event("gh:render"));
  }, s.speed * 1000);
}

applyTheme();
initData();
