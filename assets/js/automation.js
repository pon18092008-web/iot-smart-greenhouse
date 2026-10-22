// Автоматика (AUTO), тревоги, журнал событий и Smart Analytics.

const ACTION_NAMES = {
  pump: ["PUMP_ON", "PUMP_OFF"], fan: ["FAN_ON", "FAN_OFF"], growLight: ["LIGHT_ON", "LIGHT_OFF"],
  humidifier: ["HUMIDIFIER_ON", "HUMIDIFIER_OFF"], heater: ["HEATER_ON", "HEATER_OFF"], vent: ["VENT_OPEN", "VENT_CLOSE"]
};

// ---------- Журнал событий ----------
function logEvent(zoneId, source, action, message, time) {
  const events = getEvents();
  const id = events.length ? events[0].id + 1 : 101;
  events.unshift({ id, zoneId, source, action, message, timestamp: time || stamp(new Date()) });
  saveData(KEYS.events, events.slice(0, 300));
}

// «Насос включён», «Фитолампа выключена», «Форточка открыта».
function actuatorStateText(key, on, withName) {
  const name = ACTUATORS.find(a => a.key === key).name;
  let state;
  if (key === "vent") state = on ? "открыта" : "закрыта";
  else if (key === "growLight") state = on ? "включена" : "выключена";
  else state = on ? "включён" : "выключен";
  return withName ? `${name} ${state}` : state;
}

// Включение/выключение устройства с записью в журнал (только если состояние изменилось).
function setActuator(zone, key, on, source, reason, time) {
  if (zone.actuators[key] === on) return false;
  zone.actuators[key] = on;
  logEvent(zone.id, source, ACTION_NAMES[key][on ? 0 : 1], `${actuatorStateText(key, on, true)}${reason ? ": " + reason : ""}`, time);
  return true;
}

// Значение параметра с датчика; null, если датчик не в сети.
function reading(zone, field, sensors) {
  const s = sensors.find(x => x.zoneId === zone.id && x.field === field);
  return s && s.status === "online" ? zone[field] : null;
}

// ---------- AUTO-режим (с гистерезисом) ----------
function runAutomation(zone, st, sensors, time) {
  const actions = [];
  const soil = reading(zone, "soil", sensors);
  const water = reading(zone, "waterLevel", sensors);
  const temp = reading(zone, "temperature", sensors);
  const hum = reading(zone, "humidity", sensors);
  const light = reading(zone, "light", sensors);
  const co2 = reading(zone, "co2", sensors);
  const auto = (key, on, reason) => { if (setActuator(zone, key, on, "automation", reason, time)) actions.push(key); };

  // Полив + защита насоса по уровню воды
  if (water === null || water <= st.waterLevel.critical) {
    if (zone.actuators.pump || (soil !== null && soil < st.soil.min && !zone.pumpBlocked)) {
      auto("pump", false, water === null ? "нет данных об уровне воды" : `уровень воды ${water}% ≤ ${st.waterLevel.critical}%`);
      logEvent(zone.id, "automation", "PUMP_BLOCKED", `Насос заблокирован: ${water === null ? "датчик уровня воды не в сети" : "низкий уровень воды " + water + "%"}`, time);
    }
    zone.pumpBlocked = true;
  } else {
    zone.pumpBlocked = false;
    if (soil !== null && soil < st.soil.min) auto("pump", true, `влажность почвы ${soil}% < ${st.soil.min}%`);
    if (soil !== null && soil >= st.soil.max) auto("pump", false, `влажность почвы ${soil}% ≥ ${st.soil.max}%`);
  }

  // Вентиляция и обогрев
  if (temp !== null) {
    if (temp > st.temperature.max) auto("fan", true, `температура ${temp} °C > ${st.temperature.max} °C`);
    else if (temp < st.temperature.max - st.temperature.hyst) auto("fan", false, `температура ${temp} °C в норме`);

    if (temp < st.temperature.min) auto("heater", true, `температура ${temp} °C < ${st.temperature.min} °C`);
    else if (temp > st.temperature.min + st.temperature.hyst) auto("heater", false, `температура ${temp} °C в норме`);
  }

  // Досветка
  if (light !== null) {
    if (light < st.light.min) auto("growLight", true, `освещённость ${light.toLocaleString("ru-RU")} лк < ${st.light.min.toLocaleString("ru-RU")} лк`);
    else if (light > st.light.min + st.light.hyst) auto("growLight", false, `освещённость ${light.toLocaleString("ru-RU")} лк достаточная`);
  }

  // Влажность воздуха и CO2
  if (hum !== null) {
    if (hum < st.humidity.min) auto("humidifier", true, `влажность воздуха ${hum}% < ${st.humidity.min}%`);
    else if (hum > st.humidity.min + st.humidity.hyst) auto("humidifier", false, `влажность воздуха ${hum}% в норме`);
  }
  const ventNeed = (hum !== null && hum > st.humidity.max) || (co2 !== null && co2 > st.co2.max);
  const ventDone = (hum === null || hum < st.humidity.max - st.humidity.hyst) && (co2 === null || co2 < st.co2.max - 200);
  if (ventNeed) auto("vent", true, hum !== null && hum > st.humidity.max ? `влажность воздуха ${hum}% > ${st.humidity.max}%` : `CO2 ${co2} ppm > ${st.co2.max} ppm`);
  else if (ventDone) auto("vent", false, "влажность и CO2 в норме");

  return actions;
}

// ---------- Тревоги ----------
// Одна открытая тревога на пару «зона + тип». Когда условие исчезает — тревога получает статус «Решена».
function checkAlerts(zones, sensors, settings, time) {
  const alerts = getAlerts();
  const active = new Set();

  const raise = (zone, type, severity, sensorField, message) => {
    const key = zone.id + ":" + type;
    active.add(key);
    let a = alerts.find(x => x.key === key && x.status !== "resolved");
    if (a) {
      a.message = message;
      if (severity === "critical") a.severity = "critical";
      return;
    }
    const n = alerts.reduce((m, x) => Math.max(m, x.num), 0) + 1;
    alerts.unshift({ key, num: n, id: `ALERT-${String(n).padStart(3, "0")}`, zoneId: zone.id, type, sensor: sensorField,
      severity, message, status: "open", createdAt: time });
  };

  zones.forEach(z => {
    const st = settings.zones[z.id];
    const soil = reading(z, "soil", sensors), water = reading(z, "waterLevel", sensors);
    const temp = reading(z, "temperature", sensors), hum = reading(z, "humidity", sensors);
    const light = reading(z, "light", sensors), co2 = reading(z, "co2", sensors);

    if (water !== null && water <= st.waterLevel.critical)
      raise(z, "water", "critical", "waterLevel", `Низкий уровень воды: ${water}% (критично ≤ ${st.waterLevel.critical}%). Насос заблокирован`);
    if (soil !== null && soil < st.soil.min)
      raise(z, "soil", soil < st.soil.min - 10 ? "critical" : "warning", "soil", `Влажность почвы ниже порога: ${soil}% < ${st.soil.min}%`);
    if (temp !== null && temp > st.temperature.max)
      raise(z, "temp_high", temp > st.temperature.max + 4 ? "critical" : "warning", "temperature", `Перегрев: ${temp} °C > ${st.temperature.max} °C`);
    if (temp !== null && temp < st.temperature.min)
      raise(z, "temp_low", temp < st.temperature.min - 4 ? "critical" : "warning", "temperature", `Температура ниже нормы: ${temp} °C < ${st.temperature.min} °C`);
    if (hum !== null && (hum < st.humidity.min || hum > st.humidity.max))
      raise(z, "humidity", "warning", "humidity", `Влажность воздуха вне диапазона: ${hum}% (${st.humidity.min}–${st.humidity.max}%)`);
    if (co2 !== null && co2 > st.co2.max)
      raise(z, "co2", co2 > 1500 ? "critical" : "warning", "co2", `Высокий CO2: ${co2} ppm > ${st.co2.max} ppm`);
    if (light !== null && light < st.light.min && !z.actuators.growLight)
      raise(z, "light", "warning", "light", `Низкая освещённость: ${light.toLocaleString("ru-RU")} лк < ${st.light.min.toLocaleString("ru-RU")} лк, досветка выключена`);
    sensors.filter(s => s.zoneId === z.id && s.status === "offline").forEach(s =>
      raise(z, "offline_" + s.field, "warning", s.field, `Датчик ${s.id} не в сети: нет новых данных`));
  });

  alerts.forEach(a => {
    if (a.status !== "resolved" && !active.has(a.key)) {
      a.status = "resolved";
      a.resolvedAt = time;
    }
  });

  saveData(KEYS.alerts, alerts.slice(0, 200));
}

// ---------- Smart Analytics ----------
function calculateRisk(zone, settings, sensors) {
  // Учитываем только датчики в сети: по отключённому датчику данных нет.
  const v = f => sensors ? reading(zone, f, sensors) : zone[f];
  const temp = v("temperature"), soil = v("soil"), water = v("waterLevel"), co2 = v("co2"), hum = v("humidity");
  let score = 0;

  if (temp !== null && temp > settings.temperature.max) score += 25;
  if (temp !== null && temp < settings.temperature.min) score += 20;

  if (soil !== null && soil < settings.soil.min) score += 25;

  if (water !== null && water <= settings.waterLevel.critical) score += 30;

  if (co2 !== null && co2 > 1500) score += 15;

  // Дополнительно: влажность воздуха вне диапазона и датчики не в сети
  if (hum !== null && (hum < settings.humidity.min || hum > settings.humidity.max)) score += 10;
  if (sensors && sensors.some(s => s.zoneId === zone.id && s.status === "offline")) score += 10;

  return Math.min(score, 100);
}

function riskLevel(score) {
  if (score >= 60) return "critical";
  if (score >= 30) return "warning";
  return "normal";
}

function percentChange(previous, current) {
  if (previous === 0) return 0;

  return Math.abs(
    ((current - previous) / previous) * 100
  );
}

function detectSuddenChange(previous, current) {
  return percentChange(previous, current) >= 30;
}

// Резкие изменения между двумя последними замерами.
function findSuddenChanges(zones, history) {
  const out = [];
  zones.forEach(z => {
    const h = history.zones[z.id];
    if (!h) return;
    SENSOR_TYPES.forEach(t => {
      const arr = h[t.field];
      if (arr.length < 2) return;
      const prev = arr[arr.length - 2], cur = arr[arr.length - 1];
      if (detectSuddenChange(prev, cur)) {
        out.push({ zone: z, field: t.field, name: t.name, unit: t.unit, prev, cur, change: Math.round(percentChange(prev, cur)) });
      }
    });
  });
  return out;
}

// Рекомендация = что произошло → почему это важно → что сделать.
function getRecommendations(zone, settings, sensors) {
  const list = [];
  // По отключённым датчикам рекомендации не строим — для них отдельный пункт ниже.
  const off = f => sensors && reading(zone, f, sensors) === null;
  const add = (level, what, why, action) => list.push({ level, what, why, action });

  if (!off("waterLevel") && zone.waterLevel <= settings.waterLevel.critical) {
    add("critical", `Уровень воды в баке ${zone.waterLevel}%`, "Насос заблокирован защитой, растения перестанут получать полив.", "Заполнить резервуар (кнопка «Долить воду» на странице «Управление»).");
  }
  if (!off("soil") && zone.soil < settings.soil.min) {
    add("warning", `Почва сухая: ${zone.soil}% при минимуме ${settings.soil.min}%`, "Недостаток влаги замедляет рост и вызывает увядание.", "Проверить необходимость полива и работу насоса.");
  }
  if (!off("temperature") && zone.temperature > settings.temperature.max) {
    add("warning", `Температура ${zone.temperature} °C выше диапазона (до ${settings.temperature.max} °C)`, "Перегрев вызывает стресс растений и опадание завязей.", "Проверить вентиляцию: включить вентилятор или открыть форточку.");
  }
  if (!off("temperature") && zone.temperature < settings.temperature.min) {
    add("warning", `Температура ${zone.temperature} °C ниже диапазона (от ${settings.temperature.min} °C)`, "Холод замедляет рост и повышает риск болезней.", "Включить обогреватель, закрыть форточку.");
  }
  if (!off("light") && zone.light < settings.light.min) {
    add("warning", `Освещённость ${zone.light.toLocaleString("ru-RU")} лк ниже ${settings.light.min.toLocaleString("ru-RU")} лк`, "Недостаток света снижает фотосинтез.", "Рассмотреть включение досветки (фитолампы).");
  }
  if (!off("co2") && zone.co2 > settings.co2.max) {
    add(zone.co2 > 1500 ? "critical" : "warning", `CO2 ${zone.co2} ppm выше ${settings.co2.max} ppm`, "Застой воздуха ухудшает условия для растений и людей.", "Открыть форточку для проветривания.");
  }
  if (!off("humidity") && zone.humidity > settings.humidity.max) {
    add("warning", `Влажность воздуха ${zone.humidity}% выше ${settings.humidity.max}%`, "Повышенная влажность способствует грибковым болезням.", "Проветрить зону, выключить увлажнитель.");
  }
  if (!off("humidity") && zone.humidity < settings.humidity.min) {
    add("warning", `Влажность воздуха ${zone.humidity}% ниже ${settings.humidity.min}%`, "Сухой воздух усиливает испарение и стресс растений.", "Включить увлажнитель.");
  }
  if (sensors) {
    sensors.filter(s => s.zoneId === zone.id && s.status === "offline").forEach(s =>
      add("warning", `Датчик ${s.id} не в сети`, `${s.type} не передаёт данные, автоматика не управляет связанным устройством.`, "Проверить питание и подключение датчика."));
  }

  if (list.length === 0) {
    add("normal", "Состояние зоны стабильно", "Все показания в заданных диапазонах.", "Действий не требуется.");
  }

  return list;
}
