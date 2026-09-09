const Device = require('../models/Device');
const { THRESHOLDS } = require('../config/thresholds');

/**
 * GET /api/device/status?deviceId=...
 * Online/offline is derived from lastSeen vs DEVICE_OFFLINE_SECONDS.
 * If no deviceId given, returns all devices.
 */
async function deviceStatus(req, res, next) {
  try {
    const offlineSecs = parseInt(process.env.DEVICE_OFFLINE_SECONDS, 10) || 180;
    const now = Date.now();

    const decorate = (d) => {
      const lastSeenMs = d.lastSeen ? new Date(d.lastSeen).getTime() : 0;
      const ageSec = lastSeenMs ? Math.round((now - lastSeenMs) / 1000) : null;
      const online = ageSec !== null && ageSec <= offlineSecs;
      return { ...d, online, secondsSinceLastSeen: ageSec };
    };

    if (req.query.deviceId) {
      const d = await Device.findOne({ deviceId: req.query.deviceId }).lean();
      if (!d) return res.status(404).json({ error: 'Device not found' });
      return res.json(decorate(d));
    }

    const devices = await Device.find().sort({ lastSeen: -1 }).lean();
    res.json({ count: devices.length, devices: devices.map(decorate) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/config/thresholds  -> lets the dashboard show safe ranges. */
async function getThresholds(req, res) {
  res.json(THRESHOLDS);
}

module.exports = { deviceStatus, getThresholds };
