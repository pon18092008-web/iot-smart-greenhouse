// Стартовая страница: живые показания зоны «Томаты» на схеме теплицы.
function renderHome() {
  const zones = getZones();
  const z = zones[0];
  document.getElementById("chipTemp").textContent = `ТЕМП ${z.temperature} °C`;
  document.getElementById("chipHum").textContent = `ВОЗДУХ ${z.humidity}%`;
  document.getElementById("chipSoil").textContent = `ПОЧВА ${z.soil}%`;
  document.getElementById("chipLight").textContent = `СВЕТ ${z.light.toLocaleString("ru-RU")} лк`;
  const active = getAlerts().filter(a => a.status !== "resolved").length;
  document.getElementById("homeStatus").textContent =
    `Сейчас: ${zones.length} зоны, в режиме АВТО — ${zones.filter(x => x.mode === "auto").length}, активных тревог — ${active}.`;
}

renderHome();
setInterval(() => {
  if (!getSettings().paused) tick();
  renderHome();
}, getSettings().speed * 1000);
