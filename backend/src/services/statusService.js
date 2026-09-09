const { THRESHOLDS, SENSOR_KEYS } = require('../config/thresholds');

/**
 * Classify a single numeric value against a sensor's threshold band.
 * Mirrors the classify() function in the ESP32 firmware.
 * @returns {'SAFE'|'WARNING'|'DANGER'|'UNKNOWN'}
 */
function classify(sensorKey, value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'UNKNOWN';
  const t = THRESHOLDS[sensorKey];
  if (!t) return 'UNKNOWN';
  if (value < t.warnLow || value > t.warnHigh) return 'DANGER';
  if (value < t.safeLow || value > t.safeHigh) return 'WARNING';
  return 'SAFE';
}

/**
 * Given a raw readings object, compute per-sensor statuses + overall status.
 * The server is authoritative: it always recomputes, even if the device sent
 * its own statuses, so the dashboard can never disagree with the thresholds.
 */
function computeStatuses(readings) {
  const statuses = {};
  for (const key of SENSOR_KEYS) {
    statuses[key] = classify(key, readings[key]);
  }
  const values = Object.values(statuses);
  let overall = 'SAFE';
  if (values.includes('DANGER')) overall = 'DANGER';
  else if (values.includes('WARNING')) overall = 'WARNING';
  else if (values.every((s) => s === 'UNKNOWN')) overall = 'UNKNOWN';
  return { statuses, overallStatus: overall };
}

/** Human-readable safe range string for alert messages, e.g. "25 - 32 °C". */
function safeRangeText(sensorKey) {
  const t = THRESHOLDS[sensorKey];
  if (!t) return '';
  const lo = t.safeLow === -Infinity ? '' : t.safeLow;
  const hi = t.safeHigh;
  const unit = t.unit ? ` ${t.unit}` : '';
  return lo === '' ? `<= ${hi}${unit}` : `${lo} - ${hi}${unit}`;
}

module.exports = { classify, computeStatuses, safeRangeText, THRESHOLDS, SENSOR_KEYS };
