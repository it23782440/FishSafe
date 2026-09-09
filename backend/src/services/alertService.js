const Alert = require('../models/Alert');
const { SENSOR_KEYS, safeRangeText } = require('./statusService');

/*
 * De-duplicated alert generation.
 *
 * Rule: an alert row is created only when a sensor TRANSITIONS into a bad state
 * (SAFE/UNKNOWN -> WARNING/DANGER) or its severity worsens (WARNING -> DANGER).
 * While the condition persists we keep ONE active alert per (device, sensor).
 * When the sensor returns to SAFE we resolve (deactivate) that active alert.
 *
 * This prevents the "one alert per reading" spam the proposal warns about,
 * and matches the anti-spam SMS cooldown on the device side.
 */
async function processAlerts(deviceId, readings, statuses, previousReading) {
  const created = [];

  for (const sensor of SENSOR_KEYS) {
    const status = statuses[sensor];
    const value = readings[sensor];
    const prevValue = previousReading ? previousReading[sensor] : null;

    // Find an existing active alert for this device+sensor.
    const existing = await Alert.findOne({ deviceId, sensor, active: true });

    const isBad = status === 'WARNING' || status === 'DANGER';

    if (isBad) {
      if (!existing) {
        // New condition -> create one alert.
        const alert = await Alert.create({
          deviceId,
          sensor,
          severity: status,
          value,
          previousValue: prevValue,
          threshold: safeRangeText(sensor),
          message: `${sensor} = ${fmt(value)} is ${status} (safe ${safeRangeText(sensor)})`,
          active: true,
        });
        created.push(alert);
      } else if (existing.severity !== status && status === 'DANGER') {
        // Escalation WARNING -> DANGER: update the active alert in place.
        existing.severity = status;
        existing.value = value;
        existing.previousValue = prevValue;
        existing.message = `${sensor} = ${fmt(value)} escalated to DANGER (safe ${safeRangeText(sensor)})`;
        await existing.save();
      } else {
        // Same ongoing condition: just refresh the current value, no new row.
        existing.value = value;
        await existing.save();
      }
    } else if (existing) {
      // Recovered to SAFE/UNKNOWN -> resolve the active alert.
      existing.active = false;
      existing.resolvedAt = new Date();
      await existing.save();
    }
  }

  return created;
}

function fmt(v) {
  return v === null || v === undefined ? 'n/a' : Number(v).toFixed(2);
}

module.exports = { processAlerts };
