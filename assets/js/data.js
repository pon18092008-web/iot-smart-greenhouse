// Учебные данные умной теплицы. Физических датчиков нет — значения генерирует simulator.js.

// Три зоны теплицы. ambient / naturalLight — «погода» зоны, к которой стремятся показания.
const DEFAULT_ZONES = [
  {
    id: "ZONE-01", name: "Томаты", crop: "Томаты, сорт «Бычье сердце»",
    temperature: 24.8, humidity: 67, soil: 42, light: 18400, co2: 820, waterLevel: 72,
    ambient: 25, naturalLight: 18400,
    mode: "auto",
    actuators: { pump: false, fan: false, growLight: false, humidifier: false, heater: false, vent: false }
  },
  {
    id: "ZONE-02", name: "Огурцы", crop: "Огурцы, гибрид «Кураж»",
    temperature: 23.6, humidity: 74, soil: 31, light: 15200, co2: 910, waterLevel: 13,
    ambient: 24, naturalLight: 15200,
    mode: "auto",
    actuators: { pump: false, fan: false, growLight: false, humidifier: false, heater: false, vent: false }
  },
  {
    id: "ZONE-03", name: "Зелень", crop: "Салат, укроп, базилик",
    temperature: 29.4, humidity: 58, soil: 55, light: 9600, co2: 1250, waterLevel: 64,
    ambient: 29, naturalLight: 9600,
    mode: "manual",
    actuators: { pump: false, fan: false, growLight: false, humidifier: false, heater: false, vent: false }
  }
];

// Учебные пороги зоны (не агрономические нормы — меняются в «Настройках»).
// hyst — гистерезис: устройство выключается не на той же границе, на которой включилось.
function defaultZoneSettings() {
  return {
    temperature: { min: 20, max: 28, hyst: 1 },
    humidity: { min: 50, max: 80, hyst: 5 },
    soil: { min: 35, max: 75 },
    light: { min: 12000, hyst: 9000 },
    co2: { max: 1200 },
    waterLevel: { critical: 15 }
  };
}

const DEFAULT_SETTINGS = {
  greenhouseName: "Теплица №1 · МУКР",
  speed: 5,          // секунд между замерами симулятора
  paused: false,
  zones: {
    "ZONE-01": defaultZoneSettings(),
    "ZONE-02": defaultZoneSettings(),
    "ZONE-03": Object.assign(defaultZoneSettings(), { temperature: { min: 16, max: 26, hyst: 1 } })
  }
};

// Шесть типов датчиков (по таблице из методических указаний).
const SENSOR_TYPES = [
  { field: "temperature", code: "TEMP", name: "Датчик температуры", unit: "°C" },
  { field: "humidity", code: "RH", name: "Датчик влажности воздуха", unit: "%" },
  { field: "soil", code: "SOIL", name: "Датчик влажности почвы", unit: "%" },
  { field: "light", code: "LUX", name: "Датчик освещённости", unit: "лк" },
  { field: "co2", code: "CO2", name: "Датчик CO2", unit: "ppm" },
  { field: "waterLevel", code: "WTR", name: "Датчик уровня воды", unit: "%" }
];

// Исполнительные устройства (actuators).
const ACTUATORS = [
  { key: "pump", name: "Насос полива", icon: "💧" },
  { key: "fan", name: "Вентилятор", icon: "🌀" },
  { key: "growLight", name: "Фитолампа", icon: "💡" },
  { key: "humidifier", name: "Увлажнитель", icon: "🌫" },
  { key: "heater", name: "Обогреватель", icon: "🔥" },
  { key: "vent", name: "Форточка", icon: "🪟" }
];

// По одному датчику каждого типа в каждой зоне: 3 × 6 = 18 датчиков.
function buildSensors(zones) {
  const list = [];
  zones.forEach((z, zi) => {
    SENSOR_TYPES.forEach(t => {
      list.push({
        id: `${t.code}-${String(zi + 1).padStart(2, "0")}`,
        zoneId: z.id, field: t.field, type: t.name, unit: t.unit,
        // один датчик заранее «не в сети» — для проверки статуса и тревог
        status: z.id === "ZONE-03" && t.field === "co2" ? "offline" : "online",
        value: z[t.field], updatedAt: ""
      });
    });
  });
  return list;
}
