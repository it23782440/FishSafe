/*
 * Presentation metadata for the five sensors. Keys MUST match the backend
 * field names (temperature, ph, turbidity, rain, conductivity).
 * Safe ranges here are for display only; the backend thresholds are the truth.
 */
export const SENSORS = {
  temperature: {
    key: 'temperature',
    label: 'Temperature',
    short: 'Temp',
    unit: '°C',
    icon: '🌡️',
    color: '#ef4444',
    safe: '25 – 32 °C',
    decimals: 1,
    source: 'Proposal (tilapia)',
  },
  ph: {
    key: 'ph',
    label: 'pH Level',
    short: 'pH',
    unit: '',
    icon: '⚗️',
    color: '#8b5cf6',
    safe: '6.5 – 8.5',
    decimals: 2,
    source: 'Proposal',
  },
  turbidity: {
    key: 'turbidity',
    label: 'Turbidity',
    short: 'Turbidity',
    unit: 'NTU',
    icon: '💧',
    color: '#0ea5e9',
    safe: '≤ 25 NTU',
    decimals: 1,
    source: 'Assumption',
  },
  rain: {
    key: 'rain',
    label: 'Rain',
    short: 'Rain',
    unit: '%',
    icon: '🌧️',
    color: '#3b82f6',
    safe: '≤ 50 %',
    decimals: 0,
    source: 'Assumption',
  },
  conductivity: {
    key: 'conductivity',
    label: 'Conductivity / TDS',
    short: 'TDS',
    unit: 'ppm',
    icon: '⚡',
    color: '#f59e0b',
    safe: '100 – 800 ppm',
    decimals: 0,
    source: 'Assumption',
  },
};

export const SENSOR_KEYS = Object.keys(SENSORS);

export function formatValue(sensorKey, value) {
  const meta = SENSORS[sensorKey];
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number(value).toFixed(meta ? meta.decimals : 1);
}

// Tailwind-friendly status colors.
export const STATUS_STYLE = {
  SAFE: { text: 'text-green-700', bg: 'bg-green-100', dot: 'bg-green-500', label: 'Safe' },
  WARNING: { text: 'text-amber-700', bg: 'bg-amber-100', dot: 'bg-amber-500', label: 'Warning' },
  DANGER: { text: 'text-red-700', bg: 'bg-red-100', dot: 'bg-red-500', label: 'Danger' },
  UNKNOWN: { text: 'text-slate-500', bg: 'bg-slate-100', dot: 'bg-slate-400', label: 'Unknown' },
};
