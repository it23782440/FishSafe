/*
 * Seed script: inserts ~24h of realistic demo readings for one device so you
 * can develop the dashboard WITHOUT the hardware. Run:  npm run seed
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const SensorReading = require('../models/SensorReading');
const Device = require('../models/Device');
const Alert = require('../models/Alert');
const { computeStatuses } = require('../services/statusService');
const { processAlerts } = require('../services/alertService');

const DEVICE_ID = 'FISHSAFE-001';

function noisy(base, amp) {
  return base + (Math.random() - 0.5) * amp;
}

async function run() {
  await connectDB();
  console.log('[SEED] Clearing existing demo data...');
  await Promise.all([
    SensorReading.deleteMany({ deviceId: DEVICE_ID }),
    Alert.deleteMany({ deviceId: DEVICE_ID }),
    Device.deleteMany({ deviceId: DEVICE_ID }),
  ]);

  const now = Date.now();
  const points = 24 * 6; // one every 10 min for 24h
  let previous = null;

  for (let i = points; i >= 0; i--) {
    const t = new Date(now - i * 10 * 60 * 1000);

    // Occasionally push pH out of range to generate an alert.
    const spike = i % 40 === 0;

    const readings = {
      temperature: +noisy(28.5, 2).toFixed(2),
      ph: +(spike ? noisy(9.4, 0.2) : noisy(7.3, 0.6)).toFixed(2),
      turbidity: +Math.abs(noisy(12, 10)).toFixed(1),
      rain: +Math.abs(noisy(10, 20)).toFixed(0),
      conductivity: +noisy(430, 120).toFixed(0),
    };

    const { statuses, overallStatus } = computeStatuses(readings);

    const doc = await SensorReading.create({
      deviceId: DEVICE_ID,
      ...readings,
      statuses,
      overallStatus,
      signal: 60 + Math.round(Math.random() * 30),
      timestamp: t,
    });

    await processAlerts(DEVICE_ID, readings, statuses, previous);
    previous = readings;

    await Device.findOneAndUpdate(
      { deviceId: DEVICE_ID },
      {
        $set: { lastSeen: doc.timestamp, lastSignal: doc.signal, lastStatus: overallStatus },
        $inc: { totalReadings: 1 },
        $setOnInsert: { deviceId: DEVICE_ID, name: 'FishSafe FISHSAFE-001', createdAt: new Date() },
      },
      { upsert: true }
    );
  }

  const count = await SensorReading.countDocuments({ deviceId: DEVICE_ID });
  const alerts = await Alert.countDocuments({ deviceId: DEVICE_ID });
  console.log(`[SEED] Done. ${count} readings, ${alerts} alerts for ${DEVICE_ID}.`);
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((e) => {
  console.error('[SEED] Failed:', e);
  process.exit(1);
});
