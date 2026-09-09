/*
 * API-key auth for device writes.
 * The ESP32 must send header:  x-api-key: <DEVICE_API_KEY>
 * Read-only GET endpoints used by the dashboard are left public (academic
 * project); protect them the same way if you need to.
 */
function deviceAuth(req, res, next) {
  const provided = req.get('x-api-key');
  const expected = process.env.DEVICE_API_KEY;

  if (!expected) {
    return res.status(500).json({ error: 'Server missing DEVICE_API_KEY' });
  }
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
}

module.exports = { deviceAuth };
