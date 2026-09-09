const mongoose = require('mongoose');

/*
 * One document = one measurement cycle uploaded by an ESP32.
 * Field names match the ESP32 JSON payload AND the frontend exactly.
 */
const statusEnum = ['SAFE', 'WARNING', 'DANGER', 'UNKNOWN'];

const sensorReadingSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true, trim: true },

    // Raw values (null allowed when a sensor failed on the device).
    temperature:  { type: Number, default: null },
    ph:           { type: Number, default: null },
    turbidity:    { type: Number, default: null },
    rain:         { type: Number, default: null },
    conductivity: { type: Number, default: null },

    // Per-sensor status, recomputed on the server from thresholds.js.
    statuses: {
      temperature:  { type: String, enum: statusEnum, default: 'UNKNOWN' },
      ph:           { type: String, enum: statusEnum, default: 'UNKNOWN' },
      turbidity:    { type: String, enum: statusEnum, default: 'UNKNOWN' },
      rain:         { type: String, enum: statusEnum, default: 'UNKNOWN' },
      conductivity: { type: String, enum: statusEnum, default: 'UNKNOWN' },
    },

    overallStatus: { type: String, enum: statusEnum, default: 'UNKNOWN', index: true },

    // Network/diagnostic info reported by the device (optional).
    signal: { type: Number, default: null }, // 0-100 %

    // Server receipt time. Named "timestamp" so the frontend has one time field.
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

// Compound index: fast "latest for this device" and time-range history queries.
sensorReadingSchema.index({ deviceId: 1, timestamp: -1 });

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
