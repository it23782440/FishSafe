'use client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceArea,
} from 'recharts';
import { SENSORS } from '@/lib/sensorMeta';

/*
 * Reusable historical line chart for one sensor.
 * `data` = [{ timestamp, value }, ...] (chronological).
 * `band` = optional { low, high } to shade the safe range.
 */
export default function HistoryChart({ sensorKey, data = [], band }) {
  const meta = SENSORS[sensorKey] || {};
  const points = data.map((d) => ({
    t: new Date(d.timestamp).getTime(),
    value: d.value,
  }));

  const fmtTime = (t) =>
    new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          {band && Number.isFinite(band.low) && Number.isFinite(band.high) && (
            <ReferenceArea
              y1={band.low}
              y2={band.high}
              fill="#16a34a"
              fillOpacity={0.06}
            />
          )}
          <XAxis
            dataKey="t"
            tickFormatter={fmtTime}
            tick={{ fontSize: 11, fill: '#64748b' }}
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            width={44}
            domain={['auto', 'auto']}
            unit={meta.unit ? ` ${meta.unit}` : ''}
          />
          <Tooltip
            labelFormatter={(t) => new Date(t).toLocaleString()}
            formatter={(v) => [`${v} ${meta.unit || ''}`, meta.label]}
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={meta.color || '#0ea5e9'}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
