'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { endpoints } from '@/lib/api';
import { SENSORS, SENSOR_KEYS, formatValue } from '@/lib/sensorMeta';
import HistoryChart from '@/components/HistoryChart';
import StatusBadge from '@/components/StatusBadge';
import TimeRangeSelector from '@/components/TimeRangeSelector';
import { Skeleton, ErrorState, EmptyState } from '@/components/Loading';

// Display-only safe bands for the chart shading, per sensor.
const BANDS = {
  temperature: { low: 25, high: 32 },
  ph: { low: 6.5, high: 8.5 },
  turbidity: { low: 0, high: 25 },
  rain: { low: 0, high: 50 },
  conductivity: { low: 100, high: 800 },
};

export default function SensorDetailPage({ params }) {
  // In Next 14 (client component) params is a plain object.
  const sensor = params.sensor;
  const known = SENSOR_KEYS.includes(sensor);
  const [range, setRange] = useState('24h');

  // Hooks must run unconditionally. When the sensor is unknown we still call
  // them (pointing at a valid key) and simply render a "not found" message.
  const safeKey = known ? sensor : SENSOR_KEYS[0];
  const series = useLiveData(endpoints.sensor(safeKey, range));
  const latest = useLiveData(endpoints.latest());

  if (!known) {
    return (
      <div className="card">
        <p className="font-semibold text-ink">Unknown sensor: {sensor}</p>
        <Link href="/" className="text-sky-600 hover:underline text-sm">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const meta = SENSORS[sensor];
  const reading = latest.data;
  const current = reading ? reading[sensor] : null;
  const status = reading?.statuses?.[sensor] || 'UNKNOWN';
  const points = series.data?.series || [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-sky-600 hover:underline">
          ← Back to dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta.icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-ink">{meta.label}</h1>
            <p className="text-sm text-slate-500">Threshold source: {meta.source}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Current value">
          <span className="tabular-nums">{formatValue(sensor, current)}</span>{' '}
          <span className="text-slate-400 text-base">{meta.unit}</span>
        </Stat>
        <Stat label="Safe range">{meta.safe}</Stat>
        <Stat label="Unit">{meta.unit || '—'}</Stat>
        <Stat label="Last update">
          {reading?.timestamp
            ? new Date(reading.timestamp).toLocaleTimeString()
            : '—'}
        </Stat>
      </div>

      {/* History chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink">History</h2>
          <TimeRangeSelector value={range} onChange={setRange} />
        </div>
        {series.error ? (
          <ErrorState message={series.error.message} />
        ) : series.isLoading && !points.length ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : points.length === 0 ? (
          <EmptyState message="No data in this time range." />
        ) : (
          <HistoryChart sensorKey={sensor} data={points} band={BANDS[sensor]} />
        )}
      </div>

      {/* Calibration info */}
      <div className="card">
        <h2 className="font-semibold text-ink mb-2">Calibration</h2>
        <p className="text-sm text-slate-600">{CALIBRATION[sensor]}</p>
      </div>
    </div>
  );
}

function Stat({ label, children }) {
  return (
    <div className="card">
      <div className="card-title">{label}</div>
      <div className="text-2xl font-bold text-ink mt-1">{children}</div>
    </div>
  );
}

const CALIBRATION = {
  temperature:
    'DS18B20 is factory-calibrated. Cross-verify against a reference thermometer; apply an offset in firmware if the deviation is consistent.',
  ph: 'Two-point calibration using pH 4.0 and pH 7.0 buffer solutions. Record the pin voltage in each buffer and set PH_V4 / PH_V7 in the firmware.',
  turbidity:
    'Calibrate against clear water (0 NTU) and known NTU reference samples. Set TURB_V_CLEAR to the clear-water sensor voltage.',
  rain: 'Map raw ADC millivolts: RAIN_MV_DRY (dry board) → 0%, RAIN_MV_WET (soaked board) → 100%.',
  conductivity:
    'Calibrate with a known TDS/EC standard solution at 25 °C. The DFRobot formula includes temperature compensation from the live DS18B20 reading.',
};
