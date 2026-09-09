const mongoose = require('mongoose');

/*
 * One document = one alert event (a sensor entered WARNING or DANGER).
 * Alerts are generated server-side with de-duplication so the same ongoing
 * condition is not logged on every single reading (see alertService.js).
 */
const alertSchema = new mongoose.Schema(
  {
    deviceId:  { type: String, required: true, index: true, trim: true },
    sensor:    { type: String, required: true }, // e.g. "ph"
    severity:  { type: String, enum: ['WARNING', 'DANGER'], required: true, index: true },

    value:     { type: Number, default: null },   // reading that triggered it
    previousValue: { type: Number, default: null },// prior reading (context)
    threshold: { type: String, default: '' },      // human-readable safe range

    message:   { type: String, default: '' },
    active:    { type: Boolean, default: true, index: true }, // cleared when SAFE again
    resolvedAt:{ type: Date, default: null },

    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

alertSchema.index({ deviceId: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
