// Зоны: карточки с фильтрами и сводная таблица показаний/порогов.
if (renderLayout("Зоны")) {
  const search = document.getElementById("zoneSearch");
  const statusF = document.getElementById("zoneStatus");
  const modeF = document.getElementById("zoneMode");

  function render() {
    const settings = getSettings();
    const sensors = getSensors();
    const q = search.value.trim().toLowerCase();
    const zones = getZones().filter(z =>
      (!q || `${z.name} ${z.crop} ${z.id}`.toLowerCase().includes(q)) &&
      (!statusF.value || riskLevel(calculateRisk(z, settings.zones[z.id], sensors)) === statusF.value) &&
      (!modeF.value || z.mode === modeF.value));

    document.getElementById("zoneCards").innerHTML = zones.map(z => zoneCard(z, settings, sensors)).join("") ||
      '<p class="muted">Зоны не найдены</p>';

    document.getElementById("zonesBody").innerHTML = zones.map(z => {
      const st = settings.zones[z.id];
      const risk = calculateRisk(z, st, sensors);
      const val = f => reading(z, f, sensors) === null ? '<span class="muted">нет связи</span>' : fmt(f, z[f]);
      return `<tr>
        <td><b>${escapeHtml(z.name)}</b><br><small class="muted">${z.id}</small></td>
        <td>${val("temperature")}<br><small class="muted">${st.temperature.min}–${st.temperature.max} °C</small></td>
        <td>${val("humidity")}<br><small class="muted">${st.humidity.min}–${st.humidity.max} %</small></td>
        <td>${val("soil")}<br><small class="muted">${st.soil.min}–${st.soil.max} %</small></td>
        <td>${val("light")}<br><small class="muted">мин. ${st.light.min.toLocaleString("ru-RU")} лк</small></td>
        <td>${val("co2")}<br><small class="muted">макс. ${st.co2.max} ppm</small></td>
        <td>${val("waterLevel")}<br><small class="muted">крит. ≤ ${st.waterLevel.critical} %</small></td>
        <td>${badge(z.mode)}</td>
        <td>${badge(riskLevel(risk), risk + " / 100")}</td>
      </tr>`;
    }).join("");
  }

  [search, statusF, modeF].forEach(el => el.addEventListener("input", render));
  document.addEventListener("gh:render", render);
  render();
}
