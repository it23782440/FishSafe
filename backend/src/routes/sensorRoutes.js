const express = require('express');
const router = express.Router();

const { ingest, latest, history, oneSensor } = require('../controllers/sensorController');
const { deviceAuth } = require('../middleware/auth');
const { validateSensorData } = require('../middleware/validate');

// Device write (protected by API key + validation).
router.post('/data', deviceAuth, validateSensorData, ingest);

// Dashboard reads.
router.get('/latest', latest);
router.get('/history', history);
router.get('/:sensor', oneSensor); // temperature | ph | turbidity | rain | conductivity

module.exports = router;
