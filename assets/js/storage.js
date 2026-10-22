// Хранение состояния теплицы в localStorage.
const KEYS = {
  zones: "gh_zones",
  sensors: "gh_sensors",
  settings: "gh_settings",
  alerts: "gh_alerts",
  events: "gh_events",
  history: "gh_history",
  theme: "gh_theme"
};
const DATA_VERSION = "1";

function saveData(key, value) {
  localStorage.setItem(
    key,
    JSON.stringify(value)
  );
}

function loadData(key, fallback) {
  const raw = localStorage.getItem(key);

  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const getZones = () => loadData(KEYS.zones, []);
const getSensors = () => loadData(KEYS.sensors, []);
const getSettings = () => loadData(KEYS.settings, clone(DEFAULT_SETTINGS));
const getAlerts = () => loadData(KEYS.alerts, []);
const getEvents = () => loadData(KEYS.events, []);
const getHistory = () => loadData(KEYS.history, { labels: [], zones: {} });

// Сброс: записываем исходные данные и «прокручиваем» симулятор на 24 замера назад,
// чтобы у графиков сразу была история (с шагом 5 минут).
function resetData() {
  const theme = localStorage.getItem(KEYS.theme);
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  if (theme) localStorage.setItem(KEYS.theme, theme);

  saveData(KEYS.zones, clone(DEFAULT_ZONES));
  saveData(KEYS.sensors, buildSensors(DEFAULT_ZONES));
  saveData(KEYS.settings, clone(DEFAULT_SETTINGS));
  saveData(KEYS.alerts, []);
  saveData(KEYS.events, []);
  saveData(KEYS.history, { labels: [], zones: {} });
  localStorage.setItem("gh_version", DATA_VERSION);

  const start = Date.now() - 24 * 5 * 60 * 1000;
  for (let i = 0; i < 24; i++) tick(new Date(start + i * 5 * 60 * 1000));
}

function initData() {
  if (localStorage.getItem("gh_version") !== DATA_VERSION || !localStorage.getItem(KEYS.zones)) {
    resetData();
  }
}
