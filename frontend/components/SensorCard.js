import Link from 'next/link';
import StatusBadge from './StatusBadge';
import { SENSORS, formatValue } from '@/lib/sensorMeta';

/*
 * A single sensor tile for the main dashboard grid.
 * value + status come from the latest reading document.
 */
export default function SensorCard({ sensorKey, value, status }) {
  const meta = SENSORS[sensorKey];
  if (!meta) return null;

  return (
    <Link
      href={`/sensors/${sensorKey}`}
      className="card hover:shadow-md hover:-translate-y-0.5 transition block"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            {meta.icon}
          </span>
          <span className="card-title">{meta.label}</span>
        </div>
        <StatusBadge status={status} size="sm" />
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-ink tabular-nums">
          {formatValue(sensorKey, value)}
        </span>
        <span className="text-slate-400 text-sm">{meta.unit}</span>
      </div>

      <div className="mt-2 text-xs text-slate-400">Safe: {meta.safe}</div>
    </Link>
  );
}
