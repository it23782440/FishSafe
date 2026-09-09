const express = require('express');
const router = express.Router();
const { deviceStatus, getThresholds } = require('../controllers/deviceController');

router.get('/status', deviceStatus);
router.get('/thresholds', getThresholds); // alias also mounted under /config

module.exports = router;
