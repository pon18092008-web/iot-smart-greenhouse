// Настройки: название, скорость симуляции, тема, пороги зон, сброс данных.
if (renderLayout("Настройки")) {
  const el = id => document.getElementById(id);
  const thZone = el("thZone");

  // Поля порогов: [группа, ключ, подпись]
  const FIELDS = [
    ["temperature", "min", "Мин., °C"], ["temperature", "max", "Макс., °C"], ["temperature", "hyst", "Гистерезис, °C"],
    ["humidity", "min", "Мин., %"], ["humidity", "max", "Макс., %"], ["humidity", "hyst", "Гистерезис, %"],
    ["soil", "min", "Полив с, %"], ["soil", "max", "Полив до, %"],
    ["light", "min", "Мин., лк"], ["light", "hyst", "Гистерезис, лк"],
    ["co2", "max", "Макс., ppm"],
    ["waterLevel", "critical", "Критично ≤, %"]
  ];
  const GROUPS = { temperature: "🌡 Температура", humidity: "💨 Влажность воздуха", soil: "💧 Влажность почвы", light: "☀️ Освещённость", co2: "🫧 CO2", waterLevel: "🚰 Уровень воды" };

  getZones().forEach(z => thZone.insertAdjacentHTML("beforeend", `<option value="${z.id}">${escapeHtml(z.name)}</option>`));

  function showInfo() {
    el("dataInfo").textContent = `В localStorage: зон — ${getZones().length}, датчиков — ${getSensors().length}, тревог — ${getAlerts().length}, событий — ${getEvents().length}, замеров в истории — ${getHistory().labels.length}.`;
  }

  function fillGeneral() {
    const s = getSettings();
    el("ghNameInput").value = s.greenhouseName;
    el("speedInput").value = String(s.speed);
    el("themeInput").value = document.body.classList.contains("light") ? "light" : "dark";
    showInfo();
  }

  function fillThresholds(values) {
    const st = values || getSettings().zones[thZone.value];
    el("thFields").innerHTML = Object.keys(GROUPS).map(g => `
      <fieldset><legend>${GROUPS[g]}</legend>
        ${FIELDS.filter(f => f[0] === g).map(f => `<label>${f[2]}<input type="number" step="any" name="${g}.${f[1]}" value="${st[g][f[1]]}" required></label>`).join("")}
      </fieldset>`).join("");
  }

  el("generalForm").addEventListener("submit", e => {
    e.preventDefault();
    const s = getSettings();
    s.greenhouseName = el("ghNameInput").value.trim();
    s.speed = Number(el("speedInput").value);
    saveData(KEYS.settings, s);
    if ((el("themeInput").value === "light") !== document.body.classList.contains("light")) toggleTheme();
    logEvent("—", "manual", "SETTINGS", `Общие настройки сохранены: замер каждые ${s.speed} с`);
    updateTopbar();
    startLoop();
    toast("Настройки сохранены");
  });

  el("thForm").addEventListener("submit", e => {
    e.preventDefault();
    const s = getSettings();
    const st = s.zones[thZone.value];
    el("thFields").querySelectorAll("input").forEach(inp => {
      const [g, k] = inp.name.split(".");
      st[g][k] = Number(inp.value);
    });
    if (st.temperature.min >= st.temperature.max || st.humidity.min >= st.humidity.max || st.soil.min >= st.soil.max) {
      toast("Ошибка: минимум должен быть меньше максимума");
      return;
    }
    saveData(KEYS.settings, s);
    logEvent(thZone.value, "manual", "THRESHOLDS", `Пороги зоны «${zoneName(thZone.value)}» изменены`);
    toast(`Пороги зоны «${zoneName(thZone.value)}» сохранены`);
  });

  el("thDefault").addEventListener("click", () => fillThresholds(defaultZoneSettings()));
  thZone.addEventListener("input", () => fillThresholds());

  el("resetBtn").addEventListener("click", () => {
    if (confirm("Вернуть зоны, датчики, пороги, тревоги и журнал к исходному состоянию?")) {
      resetData();
      location.reload();
    }
  });

  fillGeneral();
  fillThresholds();
  document.addEventListener("gh:render", showInfo);
}
