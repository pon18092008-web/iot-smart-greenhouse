// Аналитика: risk score, графики, резкие изменения и рекомендации.
if (renderLayout("Аналитика")) {
  const charts = {};

  function lineChart(id, field) {
    const history = getHistory();
    return new Chart(document.getElementById(id), {
      type: "line",
      data: {
        labels: history.labels,
        datasets: getZones().map((z, i) => ({
          label: z.name, data: history.zones[z.id][field],
          borderColor: zoneColor(i), backgroundColor: zoneColor(i), tension: 0.35, pointRadius: 0, borderWidth: 2
        }))
      },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false } }
    });
  }

  function render() {
    const zones = getZones();
    const settings = getSettings();
    const sensors = getSensors();
    const risks = zones.map(z => calculateRisk(z, settings.zones[z.id], sensors));

    document.getElementById("riskKpis").innerHTML = zones.map((z, i) => {
      const lvl = riskLevel(risks[i]);
      return `<div class="kpi ${lvl === "critical" ? "bad" : lvl === "warning" ? "warn" : "good"}"><small>Risk score · ${escapeHtml(z.name)}</small><b>${risks[i]} <span class="unit">/ 100</span></b><span>${LABELS[lvl]}</span></div>`;
    }).join("");

    const sudden = findSuddenChanges(zones, getHistory());
    document.getElementById("suddenBody").innerHTML = sudden.map(s => `
      <tr><td>${escapeHtml(s.zone.name)}</td><td>${s.name}</td><td>${fmt(s.field, s.prev)}</td><td>${fmt(s.field, s.cur)}</td><td>${badge("warning", s.change + "%")}</td></tr>`).join("") ||
      '<tr><td colspan="5" class="muted">За последний замер резких изменений нет</td></tr>';

    document.getElementById("recs").innerHTML = zones.map(z => `
      <div>
        <h3 style="margin-bottom:10px">${escapeHtml(z.name)} ${badge(riskLevel(risks[zones.indexOf(z)]), risks[zones.indexOf(z)] + " / 100")}</h3>
        ${getRecommendations(z, settings.zones[z.id], sensors).map(r => `
          <div class="rec-item ${r.level}">
            <b>${escapeHtml(r.what)}</b>
            <p><span>Почему важно:</span> ${escapeHtml(r.why)}</p>
            <p><span>Что сделать:</span> ${escapeHtml(r.action)}</p>
          </div>`).join("")}
      </div>`).join("");

    chartDefaults();
    Object.values(charts).forEach(c => c.destroy());
    charts.risk = new Chart(document.getElementById("riskChart"), {
      type: "bar",
      data: {
        labels: zones.map(z => z.name),
        datasets: [{
          label: "Risk score", data: risks, borderRadius: 6,
          backgroundColor: risks.map(r => cssVar(riskLevel(r) === "critical" ? "--red" : riskLevel(r) === "warning" ? "--yellow" : "--green"))
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false } } }
    });
    charts.hum = lineChart("humChart", "humidity");
    charts.co2 = lineChart("co2Chart", "co2");
  }

  document.addEventListener("gh:render", render);
  render();
}
