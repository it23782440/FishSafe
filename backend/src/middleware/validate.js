const { SENSOR_KEYS } = require('../config/thresholds');

/*
 * Validate an incoming sensor-data payload (POST /api/sensors/data).
 * Keeps garbage out of the database without a heavy validation library.
 */
function validateSensorData(req, res, next) {
  const body = req.body || {};

  if (!body.deviceId || typeof body.deviceId !== 'string') {
    return res.status(400).json({ error: 'deviceId (string) is required' });
  }

  // Every sensor field, if present, must be a finite number or null.
  for (const key of SENSOR_KEYS) {
    if (body[key] === undefined || body[key] === null) continue;
    const n = Number(body[key]);
    if (!Number.isFinite(n)) {
      return res.status(400).json({ error: `${key} must be a number or null` });
    }
  }

  // Require at least one real sensor value so we don't store empty rows.
  const hasAnyValue = SENSOR_KEYS.some(
    (k) => body[k] !== undefined && body[k] !== null && Number.isFinite(Number(body[k]))
  );
  if (!hasAnyValue) {
    return res.status(400).json({ error: 'At least one sensor value is required' });
  }

  next();
}

module.exports = { validateSensorData };
