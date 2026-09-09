const Alert = require('../models/Alert');

/**
 * GET /api/alerts?deviceId=&active=true&severity=DANGER&limit=100
 * Returns alert history (newest first). Use active=true for the live panel.
 */
async function listAlerts(req, res, next) {
  try {
    const { deviceId, active, severity } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);

    const filter = {};
    if (deviceId) filter.deviceId = deviceId;
    if (active === 'true') filter.active = true;
    if (active === 'false') filter.active = false;
    if (severity) filter.severity = severity.toUpperCase();

    const alerts = await Alert.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ count: alerts.length, alerts });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAlerts };
