// Панель управления: KPI, карточки зон, графики, последние тревоги и события.
if (renderLayout("Панель управления")) {
  const charts = {};

  function lineChart(id, field) {
    const history = getHistory();
    const zones = getZones();
    return new Chart(document.getElementById(id), {
      type: "line",
      data: {
        labels: history.labels,
        datasets: zones.map((z, i) => ({
          label: z.name, data: history.zones[z.id][field],
          borderColor: zoneColor(i), backgroundColor: zoneColor(i), tension: 0.35, pointRadius: 0, borderWidth: 2
        }))
      },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false } }
    });
  }

  function render() {
    const zones = getZones();
    const sensors = getSensors();
    const settings = getSettings();
    const alerts = getAlerts();
    const active = alerts.filter(a => a.status !== "resolved");
    const online = sensors.filter(s => s.status === "online").length;
    const avg = f => (zones.reduce((s, z) => s + z[f], 0) / zones.length);
    const minWater = Math.min(...zones.map(z => z.waterLevel));
    const critical = active.filter(a => a.severity === "critical").length;

    document.getElementById("kpis").innerHTML = `
      <div class="kpi"><small>Температура (средняя)</small><b>${avg("temperature").toFixed(1)} <span class="unit">°C</span></b><span>по 3 зонам</span></div>
      <div class="kpi"><small>Влажность воздуха</small><b>${Math.round(avg("humidity"))} <span class="unit">%</span></b><span>средняя</span></div>
      <div class="kpi"><small>Влажность почвы</small><b>${Math.round(avg("soil"))} <span class="unit">%</span></b><span>средняя</span></div>
      <div class="kpi ${minWater <= 15 ? "bad" : minWater <= 25 ? "warn" : "good"}"><small>Вода (минимум)</small><b>${minWater} <span class="unit">%</span></b><span>${zones.find(z => z.waterLevel === minWater).name}</span></div>
      <div class="kpi ${critical ? "bad" : active.length ? "warn" : "good"}"><small>Активные тревоги</small><b>${active.length}</b><span>критичных: ${critical}</span></div>
      <div class="kpi ${online === sensors.length ? "good" : "warn"}"><small>Датчики в сети</small><b>${online}/${sensors.length}</b><span>${sensors.length - online} не в сети</span></div>`;

    document.getElementById("zoneCards").innerHTML = zones.map(z => zoneCard(z, settings, sensors)).join("");

    document.getElementById("lastAlerts").innerHTML = active.slice(0, 5).map(a =>
      `<div class="list-item ${a.severity}"><small class="muted">${zoneName(a.zoneId)} · ${a.createdAt.slice(11, 16)}</small><br>${escapeHtml(a.message)}</div>`).join("") ||
      '<p class="muted">Активных тревог нет</p>';

    document.getElementById("lastEvents").innerHTML = getEvents().slice(0, 6).map(e =>
      `<div class="list-item ${e.source === "automation" ? "" : "critical"}" style="border-left-color:var(${e.source === "automation" ? "--green" : "--accent"})"><small class="muted">${e.timestamp.slice(11, 16)} · ${e.zoneId === "—" ? "Система" : zoneName(e.zoneId)}</small><br>${escapeHtml(e.message)}</div>`).join("") ||
      '<p class="muted">Событий пока нет</p>';

    drawCharts(zones, settings);
  }

  function drawCharts(zones, settings) {
    chartDefaults();
    Object.values(charts).forEach(c => c.destroy());
    charts.temp = lineChart("tempChart", "temperature");
    charts.soil = lineChart("soilChart", "soil");
    charts.water = new Chart(document.getElementById("waterChart"), {
      type: "bar",
      data: {
        labels: zones.map(z => z.name),
        datasets: [{
          label: "Уровень воды, %", data: zones.map(z => z.waterLevel), borderRadius: 6,
          backgroundColor: zones.map(z => z.waterLevel <= settings.zones[z.id].waterLevel.critical ? cssVar("--red") : cssVar("--water"))
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false } } }
    });
  }

  document.addEventListener("gh:render", render);
  render();
}
