const SensorReading = require('../models/SensorReading');
const Device = require('../models/Device');
const { computeStatuses, SENSOR_KEYS } = require('../services/statusService');
const { processAlerts } = require('../services/alertService');

// Small helper to turn a query window (?range=24h etc.) into a Date.
function rangeToSince(range) {
  const now = Date.now();
  const map = {
    '1h': 1, '6h': 6, '24h': 24, '7d': 24 * 7, '30d': 24 * 30,
  };
  const hours = map[range] || 24;
  return new Date(now - hours * 3600 * 1000);
}

/**
 * POST /api/sensors/data   (device-only, requires x-api-key)
 * Ingest one reading, recompute statuses server-side, store it, update the
 * device, and generate de-duplicated alerts.
 */
async function ingest(req, res, next) {
  try {
    const body = req.body;
    const deviceId = body.deviceId;

    // Extract only known sensor fields (ignore anything extra).
    const readings = {};
    for (const key of SENSOR_KEYS) {
      readings[key] =
        body[key] === undefined || body[key] === null ? null : Number(body[key]);
    }

    // Authoritative status computation.
    const { statuses, overallStatus } = computeStatuses(readings);

    // Previous reading (for alert "previousValue" context).
    const previous = await SensorReading.findOne({ deviceId })
      .sort({ timestamp: -1 })
      .lean();

    const doc = await SensorReading.create({
      deviceId,
      ...readings,
      statuses,
      overallStatus,
      signal: body.signal === undefined ? null : Number(body.signal),
      timestamp: new Date(),
    });

    // Upsert device record.
    await Device.findOneAndUpdate(
      { deviceId },
      {
        $set: {
          lastSeen: doc.timestamp,
          lastSignal: doc.signal,
          lastStatus: overallStatus,
        },
        $inc: { totalReadings: 1 },
        $setOnInsert: { deviceId, name: `FishSafe ${deviceId}`, createdAt: new Date() },
      },
      { upsert: true, new: true }
    );

    // Alert generation (non-fatal if it fails).
    let alerts = [];
    try {
      alerts = await processAlerts(deviceId, readings, statuses, previous);
    } catch (e) {
      console.error('[ALERT] processing failed:', e.message);
    }

    res.status(201).json({
      ok: true,
      id: doc._id,
      overallStatus,
      statuses,
      alertsCreated: alerts.length,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/sensors/latest?deviceId=...  -> most recent reading. */
async function latest(req, res, next) {
  try {
    const { deviceId } = req.query;
    const filter = deviceId ? { deviceId } : {};
    const doc = await SensorReading.findOne(filter).sort({ timestamp: -1 }).lean();
    if (!doc) return res.status(404).json({ error: 'No readings yet' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

/** GET /api/sensors/history?deviceId=&range=24h&limit=  -> array (oldest->newest). */
async function history(req, res, next) {
  try {
    const { deviceId, range = '24h' } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 5000);
    const since = rangeToSince(range);

    const filter = { timestamp: { $gte: since } };
    if (deviceId) filter.deviceId = deviceId;

    const docs = await SensorReading.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json(docs.reverse()); // chronological for charts
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/sensors/:sensor?deviceId=&range=  -> time series for ONE sensor.
 * :sensor in {temperature, ph, turbidity, rain, conductivity}
 */
async function oneSensor(req, res, next) {
  try {
    const sensor = req.params.sensor;
    if (!SENSOR_KEYS.includes(sensor)) {
      return res.status(400).json({ error: `Unknown sensor: ${sensor}` });
    }
    const { deviceId, range = '24h' } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 5000);
    const since = rangeToSince(range);

    const filter = { timestamp: { $gte: since } };
    if (deviceId) filter.deviceId = deviceId;

    const docs = await SensorReading.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .select(`timestamp ${sensor} statuses.${sensor} deviceId`)
      .lean();

    const series = docs.reverse().map((d) => ({
      timestamp: d.timestamp,
      value: d[sensor],
      status: d.statuses ? d.statuses[sensor] : 'UNKNOWN',
    }));

    res.json({ sensor, count: series.length, series });
  } catch (err) {
    next(err);
  }
}

module.exports = { ingest, latest, history, oneSensor };
