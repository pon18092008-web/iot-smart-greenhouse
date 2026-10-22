// Программный симулятор датчиков. Показания зависят от состояния устройств:
// насос увлажняет почву и расходует воду, вентилятор охлаждает, фитолампа добавляет света и т.д.

function random(min, max, decimals = 1) {
  const value = Math.random() * (max - min) + min;
  return +value.toFixed(decimals);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function simulateZone(zone) {
  const a = zone.actuators;

  // Температура стремится к «погоде» зоны, устройства её меняют.
  let t = zone.temperature + (zone.ambient - zone.temperature) * 0.15 + random(-0.4, 0.4);
  if (a.heater) t += 1.2;
  if (a.fan) t -= 1.1;
  if (a.vent) t -= 0.5;
  zone.temperature = +clamp(t, 5, 45).toFixed(1);

  let h = zone.humidity + (65 - zone.humidity) * 0.05 + random(-1.5, 1.5);
  if (a.humidifier) h += 3;
  if (a.vent) h -= 2.5;
  if (a.fan) h -= 1;
  zone.humidity = Math.round(clamp(h, 20, 98));

  // Почва постепенно высыхает, насос её увлажняет.
  let s = zone.soil - random(0.4, 1.2);
  if (a.pump) s += 4.5;
  zone.soil = Math.round(clamp(s, 5, 95));

  zone.light = Math.round(clamp(zone.naturalLight + random(-1500, 1500, 0) + (a.growLight ? 9000 : 0), 0, 60000));

  let c = zone.co2 + random(-40, 40, 0) + 20;
  if (a.vent) c -= 130;
  if (a.fan) c -= 30;
  zone.co2 = Math.round(clamp(c, 400, 2000));

  // Уровень воды меняется медленнее: расход при поливе.
  zone.waterLevel = +Math.max(0, zone.waterLevel - (a.pump ? random(1.2, 2) : random(0, 0.1))).toFixed(1);

  return zone;
}

function timeLabel(d) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function stamp(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ` +
    `${timeLabel(d)}:${String(d.getSeconds()).padStart(2, "0")}`;
}

// Один замер: симуляция → датчики → автоматика → тревоги → история.
function tick(now = new Date()) {
  const zones = getZones();
  const sensors = getSensors();
  const settings = getSettings();
  const history = getHistory();
  const time = stamp(now);

  zones.forEach(zone => {
    simulateZone(zone);

    // Датчик «не в сети» не передаёт новое значение — остаётся последнее известное.
    sensors.filter(s => s.zoneId === zone.id).forEach(s => {
      if (s.status === "online") {
        s.value = zone[s.field];
        s.updatedAt = time;
      }
    });

    if (zone.mode === "auto") {
      runAutomation(zone, settings.zones[zone.id], sensors, time);
    }
  });

  checkAlerts(zones, sensors, settings, time);

  history.labels.push(timeLabel(now));
  zones.forEach(z => {
    const h = history.zones[z.id] || (history.zones[z.id] = { temperature: [], humidity: [], soil: [], light: [], co2: [], waterLevel: [] });
    Object.keys(h).forEach(k => h[k].push(z[k]));
  });
  if (history.labels.length > 30) {
    history.labels.shift();
    Object.values(history.zones).forEach(h => Object.values(h).forEach(arr => arr.shift()));
  }

  saveData(KEYS.zones, zones);
  saveData(KEYS.sensors, sensors);
  saveData(KEYS.history, history);
}
