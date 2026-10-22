// Датчики: таблица, поиск, фильтры, имитация отключения датчика.
if (renderLayout("Датчики")) {
  const search = document.getElementById("sensorSearch");
  const zoneF = document.getElementById("sensorZone");
  const typeF = document.getElementById("sensorType");
  const statusF = document.getElementById("sensorStatus");

  getZones().forEach(z => zoneF.insertAdjacentHTML("beforeend", `<option value="${z.id}">${escapeHtml(z.name)}</option>`));
  SENSOR_TYPES.forEach(t => typeF.insertAdjacentHTML("beforeend", `<option value="${t.field}">${t.name}</option>`));

  function render() {
    const all = getSensors();
    const online = all.filter(s => s.status === "online").length;
    document.getElementById("sensorKpis").innerHTML = `
      <div class="kpi"><small>Всего датчиков</small><b>${all.length}</b><span>6 типов × 3 зоны</span></div>
      <div class="kpi good"><small>В сети</small><b>${online}</b></div>
      <div class="kpi ${all.length - online ? "bad" : "good"}"><small>Не в сети</small><b>${all.length - online}</b></div>`;

    const q = search.value.trim().toLowerCase();
    const list = all.filter(s =>
      (!q || s.id.toLowerCase().includes(q)) &&
      (!zoneF.value || s.zoneId === zoneF.value) &&
      (!typeF.value || s.field === typeF.value) &&
      (!statusF.value || s.status === statusF.value));

    document.getElementById("sensorCount").textContent = `Найдено датчиков: ${list.length}`;
    document.getElementById("sensorsBody").innerHTML = list.map(s => `
      <tr>
        <td><b>${s.id}</b></td><td>${zoneName(s.zoneId)}</td><td>${s.type}</td><td><code>${s.field}</code></td>
        <td>${fmt(s.field, s.value)}${s.status === "offline" ? ' <small class="muted">(последнее)</small>' : ""}</td>
        <td>${badge(s.status)}</td><td>${s.updatedAt || "—"}</td>
        <td><button class="btn small secondary" data-id="${s.id}">${s.status === "online" ? "Отключить" : "Подключить"}</button></td>
      </tr>`).join("") || '<tr><td colspan="8" class="muted">Ничего не найдено</td></tr>';
  }

  document.getElementById("sensorsBody").addEventListener("click", e => {
    const id = e.target.dataset.id;
    if (!id) return;
    const sensors = getSensors();
    const s = sensors.find(x => x.id === id);
    s.status = s.status === "online" ? "offline" : "online";
    saveData(KEYS.sensors, sensors);
    logEvent(s.zoneId, "manual", s.status === "online" ? "SENSOR_ONLINE" : "SENSOR_OFFLINE",
      `Датчик ${s.id} ${s.status === "online" ? "подключён" : "отключён"} оператором (имитация)`);
    checkAlerts(getZones(), sensors, getSettings(), stamp(new Date()));
    updateTopbar();
    render();
  });

  [search, zoneF, typeF, statusF].forEach(el => el.addEventListener("input", render));
  document.addEventListener("gh:render", render);
  render();
}
