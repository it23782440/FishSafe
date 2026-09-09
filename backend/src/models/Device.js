const mongoose = require('mongoose');

/*
 * One document per physical FishSafe device. Auto-created/updated on first
 * data upload (upsert), so you don't have to register devices manually.
 */
const deviceSchema = new mongoose.Schema(
  {
    deviceId:   { type: String, required: true, unique: true, index: true, trim: true },
    name:       { type: String, default: 'FishSafe Device' },
    location:   { type: String, default: '' },

    lastSeen:   { type: Date, default: null },      // last successful upload
    lastSignal: { type: Number, default: null },    // last GSM signal %
    lastStatus: { type: String, default: 'UNKNOWN' },
    totalReadings: { type: Number, default: 0 },

    firmware:   { type: String, default: '1.0.0' },
    createdAt:  { type: Date, default: Date.now },
  },
  { versionKey: false }
);

module.exports = mongoose.model('Device', deviceSchema);
