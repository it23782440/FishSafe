const express = require('express');
const router = express.Router();

const sensorRoutes = require('./sensorRoutes');
const alertRoutes = require('./alertRoutes');
const deviceRoutes = require('./deviceRoutes');
const { getThresholds } = require('../controllers/deviceController');

// Health check (used by Render + dashboard "backend status").
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'fishsafe-backend',
    time: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.use('/sensors', sensorRoutes);
router.use('/alerts', alertRoutes);
router.use('/device', deviceRoutes);
router.get('/config/thresholds', getThresholds);

module.exports = router;
