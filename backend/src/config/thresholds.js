/*
 * Centralized threshold configuration.
 * THIS FILE IS THE SINGLE SOURCE OF TRUTH for SAFE/WARNING/DANGER on the server.
 * Keep it numerically identical to the TH_* structs in firmware/FishSafe.ino.
 *
 * Band model per sensor:
 *   value < warnLow  OR value > warnHigh   -> DANGER
 *   value < safeLow  OR value > safeHigh   -> WARNING
 *   otherwise                              -> SAFE
 *
 * Sources:
 *   temperature, ph  -> taken directly from the FishSafe proposal (tilapia).
 *   turbidity, rain, conductivity -> ENGINEERING ASSUMPTIONS (proposal gives no
 *     numeric limits). They are configurable and MUST be validated for the
 *     target species/site before real deployment.
 */

const THRESHOLDS = {
  temperature: {
    label: 'Temperature',
    unit: '°C',
    warnLow: 23, safeLow: 25, safeHigh: 32, warnHigh: 34,
    source: 'proposal', // tilapia 25-32 C
  },
  ph: {
    label: 'pH',
    unit: '',
    warnLow: 6.0, safeLow: 6.5, safeHigh: 8.5, warnHigh: 9.0,
    source: 'proposal', // pH 6.5-8.5
  },
  turbidity: {
    label: 'Turbidity',
    unit: 'NTU',
    warnLow: -Infinity, safeLow: -Infinity, safeHigh: 25, warnHigh: 40,
    source: 'assumption',
  },
  rain: {
    label: 'Rain',
    unit: '%',
    warnLow: -Infinity, safeLow: -Infinity, safeHigh: 50, warnHigh: 80,
    source: 'assumption',
  },
  conductivity: {
    label: 'Conductivity / TDS',
    unit: 'ppm',
    warnLow: 50, safeLow: 100, safeHigh: 800, warnHigh: 1000,
    source: 'assumption',
  },
};

// The five sensor keys, in canonical order. Used across models, controllers,
// status logic and the frontend so field names never drift.
const SENSOR_KEYS = ['temperature', 'ph', 'turbidity', 'rain', 'conductivity'];

module.exports = { THRESHOLDS, SENSOR_KEYS };
