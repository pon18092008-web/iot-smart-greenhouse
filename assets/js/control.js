// Управление: режим АВТО/РУЧНОЙ, переключатели устройств, долив воды, тестовые сценарии.
if (renderLayout("Управление")) {
  const scenarioZone = document.getElementById("scenarioZone");
  getZones().forEach(z => scenarioZone.insertAdjacentHTML("beforeend", `<option value="${z.id}">${escapeHtml(z.name)}</option>`));

  function render() {
    const zones = getZones();
    const settings = getSettings();
    document.getElementById("controlCards").innerHTML = zones.map(z => {
      const st = settings.zones[z.id];
      const isAuto = z.mode === "auto";
      const lowWater = z.waterLevel <= st.waterLevel.critical;
      return `
      <div class="card">
        <div class="zone-head">
          <div><h3>${escapeHtml(z.name)}</h3><small>${z.id}</small></div>
          <div class="mode-switch" role="group" aria-label="Режим зоны ${escapeHtml(z.name)}">
            <button class="${isAuto ? "active" : ""}" data-mode="auto" data-zone="${z.id}">АВТО</button>
            <button class="${!isAuto ? "active" : ""}" data-mode="manual" data-zone="${z.id}">РУЧНОЙ</button>
          </div>
        </div>
        <div class="metrics">
          <div class="metric"><small>Температура</small><b>${fmt("temperature", z.temperature)}</b></div>
          <div class="metric"><small>Почва</small><b>${fmt("soil", z.soil)}</b></div>
          <div class="metric"><small>Свет</small><b>${fmt("light", z.light)}</b></div>
        </div>
        <div class="act-list">
          ${ACTUATORS.map(a => {
            const blocked = a.key === "pump" && lowWater && !z.actuators.pump;
            return `<div class="act-item">
              <span>${a.icon}</span>
              <div class="name">${a.name}<small>${actuatorStateText(a.key, z.actuators[a.key])}${blocked ? " · заблокирован: мало воды" : ""}</small></div>
              ${isAuto ? '<span class="auto-tag">АВТО</span>' : ""}
              <label class="switch" title="${isAuto ? "Управляет автоматика" : "Ручное управление"}">
                <input type="checkbox" data-zone="${z.id}" data-act="${a.key}" ${z.actuators[a.key] ? "checked" : ""} ${isAuto || blocked ? "disabled" : ""}>
                <span></span>
              </label>
            </div>`;
          }).join("")}
        </div>
        <div class="water">
          <div class="risk-top"><span>Вода в баке</span><b>${z.waterLevel}%${lowWater ? " · критично" : ""}</b></div>
          <div class="risk-track"><div class="risk-bar ${lowWater ? "critical" : z.waterLevel <= st.waterLevel.critical + 10 ? "warning" : ""}" style="width:${Math.max(z.waterLevel, 2)}%"></div></div>
          <button class="btn small secondary" data-refill="${z.id}" style="margin-top:10px">💧 Долить воду</button>
        </div>
      </div>`;
    }).join("");
  }

  function update(zoneId, fn) {
    const zones = getZones();
    const zone = zones.find(z => z.id === zoneId);
    fn(zone);
    saveData(KEYS.zones, zones);
    return zone;
  }

  const cards = document.getElementById("controlCards");

  cards.addEventListener("click", e => {
    const t = e.target;
    if (t.dataset.mode) {
      update(t.dataset.zone, z => {
        if (z.mode === t.dataset.mode) return;
        z.mode = t.dataset.mode;
        logEvent(z.id, "manual", t.dataset.mode === "auto" ? "MODE_AUTO" : "MODE_MANUAL",
          `Режим зоны «${z.name}» переключён на ${LABELS[z.mode]}`);
        toast(`${z.name}: режим ${LABELS[z.mode]}`);
      });
      updateTopbar();
      render();
    }
    if (t.dataset.refill) {
      update(t.dataset.refill, z => {
        z.waterLevel = 100;
        logEvent(z.id, "manual", "WATER_REFILL", `Бак зоны «${z.name}» заполнен до 100%`);
        toast(`${z.name}: бак заполнен`);
      });
      const zones = getZones();
      checkAlerts(zones, getSensors(), getSettings(), stamp(new Date()));
      updateTopbar();
      render();
    }
  });

  // Ручное включение/выключение (только в режиме РУЧНОЙ).
  cards.addEventListener("change", e => {
    const t = e.target;
    if (!t.dataset.act) return;
    const settings = getSettings();
    update(t.dataset.zone, z => {
      if (z.mode !== "manual") return;
      if (t.dataset.act === "pump" && t.checked && z.waterLevel <= settings.zones[z.id].waterLevel.critical) {
        toast("Насос заблокирован: мало воды в баке");
        return;
      }
      setActuator(z, t.dataset.act, t.checked, "manual", "вручную оператором");
      toast(actuatorStateText(t.dataset.act, t.checked, true));
    });
    render();
  });

  // Тестовые сценарии 1–5: задаём показания зоны и сразу выполняем шаг автоматики.
  // values — показания, off — устройство, которое перед тестом выключено (исходное состояние),
  // sensors — датчики, тревоги по которым показываем в результате.
  const SCENARIOS = {
    dry: { values: { soil: 25, waterLevel: 70 }, off: "pump", sensors: ["soil", "waterLevel"], text: "Почва 25%, вода 70%" },
    dryNoWater: { values: { soil: 25, waterLevel: 10 }, off: null, sensors: ["soil", "waterLevel"], text: "Почва 25%, вода 10%" },
    hot: { values: { temperature: 33 }, off: "fan", sensors: ["temperature"], text: "Температура 33 °C" },
    cold: { values: { temperature: 15 }, off: "heater", sensors: ["temperature"], text: "Температура 15 °C" },
    dark: { values: { light: 6000 }, off: "growLight", sensors: ["light"], text: "Освещённость 6 000 лк" }
  };

  document.querySelectorAll("[data-scenario]").forEach(btn => btn.addEventListener("click", () => {
    const sc = SCENARIOS[btn.dataset.scenario];
    const time = stamp(new Date());
    const settings = getSettings();
    const sensors = getSensors();
    const zones = getZones();
    const zone = zones.find(z => z.id === scenarioZone.value);
    Object.assign(zone, sc.values);
    if (sc.off) zone.actuators[sc.off] = false;
    sensors.filter(s => s.zoneId === zone.id && s.status === "online").forEach(s => { s.value = zone[s.field]; s.updatedAt = time; });
    logEvent(zone.id, "system", "TEST_SCENARIO", `Тестовый сценарий «${btn.textContent.trim()}»: ${sc.text}`, time);

    if (zone.mode === "auto") runAutomation(zone, settings.zones[zone.id], sensors, time);
    saveData(KEYS.zones, zones);
    saveData(KEYS.sensors, sensors);
    checkAlerts(zones, sensors, settings, time);
    updateTopbar();
    render();

    const evts = getEvents().filter(ev => ev.zoneId === zone.id && ev.timestamp === time && ev.source === "automation");
    const alerts = getAlerts().filter(a => a.zoneId === zone.id && a.status !== "resolved" && sc.sensors.includes(a.sensor));
    document.getElementById("scenarioResult").innerHTML =
      `<div class="list-item"><b>${escapeHtml(zone.name)}: ${btn.textContent.trim()}</b> (${sc.text}, режим ${LABELS[zone.mode]})</div>` +
      (zone.mode !== "auto" ? '<div class="list-item critical">Зона в режиме РУЧНОЙ — автоматика не вмешивается. Переключите зону на АВТО.</div>' : "") +
      (evts.map(ev => `<div class="list-item" style="border-left-color:var(--green)">Журнал: ${escapeHtml(ev.message)}</div>`).join("") ||
        (zone.mode === "auto" ? '<div class="list-item">Состояние устройств не изменилось</div>' : "")) +
      alerts.map(a => `<div class="list-item ${a.severity}">Тревога (${LABELS[a.severity]}): ${escapeHtml(a.message)}</div>`).join("");
  }));

  document.addEventListener("gh:render", render);
  render();
}
