// Тревоги (Warning/Critical) и журнал событий с фильтрами и экспортом в CSV.
if (renderLayout("Тревоги и журнал")) {
  const SOURCES = { automation: "Автоматика", manual: "Оператор", system: "Система" };
  const FIELD_NAMES = { temperature: "Температура", humidity: "Влажность воздуха", soil: "Влажность почвы", light: "Освещённость", co2: "CO2", waterLevel: "Уровень воды" };
  const el = id => document.getElementById(id);
  const aSearch = el("alertSearch"), aZone = el("alertZone"), aSev = el("alertSeverity"), aStatus = el("alertStatus");
  const eSearch = el("eventSearch"), eZone = el("eventZone"), eSource = el("eventSource");

  getZones().forEach(z => {
    const opt = `<option value="${z.id}">${escapeHtml(z.name)}</option>`;
    aZone.insertAdjacentHTML("beforeend", opt);
    eZone.insertAdjacentHTML("beforeend", opt);
  });

  function filteredEvents() {
    const q = eSearch.value.trim().toLowerCase();
    return getEvents().filter(e =>
      (!q || `${e.message} ${e.action}`.toLowerCase().includes(q)) &&
      (!eZone.value || e.zoneId === eZone.value) &&
      (!eSource.value || e.source === eSource.value));
  }

  function render() {
    const all = getAlerts();
    const count = f => all.filter(f).length;
    el("alertKpis").innerHTML = `
      <div class="kpi bad"><small>Критичные (активные)</small><b>${count(a => a.status !== "resolved" && a.severity === "critical")}</b></div>
      <div class="kpi warn"><small>Внимание (активные)</small><b>${count(a => a.status !== "resolved" && a.severity === "warning")}</b></div>
      <div class="kpi"><small>Принято оператором</small><b>${count(a => a.status === "acknowledged")}</b></div>
      <div class="kpi good"><small>Решено</small><b>${count(a => a.status === "resolved")}</b></div>`;

    const q = aSearch.value.trim().toLowerCase();
    const list = all.filter(a =>
      (!q || a.message.toLowerCase().includes(q)) &&
      (!aZone.value || a.zoneId === aZone.value) &&
      (!aSev.value || a.severity === aSev.value) &&
      (aStatus.value === "" || (aStatus.value === "active" ? a.status !== "resolved" : a.status === aStatus.value)));

    el("alertsBody").innerHTML = list.map(a => `
      <tr>
        <td><b>${a.id}</b></td><td>${a.createdAt.slice(0, 16)}</td><td>${zoneName(a.zoneId)}</td><td>${FIELD_NAMES[a.sensor] || a.sensor}</td>
        <td>${badge(a.severity)}</td><td class="wrap">${escapeHtml(a.message)}${a.resolvedAt ? `<br><small class="muted">решена ${a.resolvedAt.slice(11, 16)}</small>` : ""}</td>
        <td>${badge(a.status)}</td>
        <td class="actions">${a.status === "open" ? `<button class="btn small secondary" data-ack="${a.id}">Принять</button>` : ""}
          ${a.status === "resolved" ? `<button class="btn small danger" data-del="${a.id}">Удалить</button>` : ""}</td>
      </tr>`).join("") || '<tr><td colspan="8" class="muted">Тревог нет</td></tr>';

    const events = filteredEvents();
    el("eventCount").textContent = `Показано событий: ${Math.min(events.length, 100)} из ${events.length}`;
    el("eventsBody").innerHTML = events.slice(0, 100).map(e => `
      <tr>
        <td>${e.id}</td><td>${e.timestamp}</td><td>${e.zoneId === "—" ? "—" : zoneName(e.zoneId)}</td>
        <td>${badge(e.source === "automation" ? "auto" : e.source === "manual" ? "acknowledged" : "open", SOURCES[e.source])}</td>
        <td><code>${e.action}</code></td><td class="wrap">${escapeHtml(e.message)}</td>
      </tr>`).join("") || '<tr><td colspan="6" class="muted">Событий нет</td></tr>';
  }

  el("alertsBody").addEventListener("click", e => {
    const ack = e.target.dataset.ack, del = e.target.dataset.del;
    if (!ack && !del) return;
    let alerts = getAlerts();
    if (ack) {
      const a = alerts.find(x => x.id === ack);
      a.status = "acknowledged";
      logEvent(a.zoneId, "manual", "ALERT_ACK", `Тревога ${a.id} принята оператором`);
    }
    if (del && confirm(`Удалить решённую тревогу ${del}?`)) {
      alerts = alerts.filter(x => x.id !== del);
    }
    saveData(KEYS.alerts, alerts);
    updateTopbar();
    render();
  });

  // Экспорт журнала в CSV (разделитель «;» — так файл правильно открывается в Excel).
  el("exportBtn").addEventListener("click", () => {
    const rows = [["№", "Время", "Зона", "Источник", "Действие", "Описание"]].concat(
      filteredEvents().map(e => [e.id, e.timestamp, e.zoneId === "—" ? "—" : zoneName(e.zoneId), SOURCES[e.source], e.action, e.message]));
    const csv = "﻿" + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "журнал-событий-теплицы.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  });

  [aSearch, aZone, aSev, aStatus, eSearch, eZone, eSource].forEach(x => x.addEventListener("input", render));
  document.addEventListener("gh:render", render);
  render();
}
