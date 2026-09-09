'use client';
import { SENSORS } from '@/lib/sensorMeta';
import StatusBadge from './StatusBadge';

/* Compact list of alerts. Used on the dashboard (active) and alerts page. */
export default function AlertsPanel({ alerts = [], emptyText = 'No alerts. All clear. 🟢' }) {
  if (!alerts.length) {
    return <div className="card text-slate-500 text-sm">{emptyText}</div>;
  }

  return (
    <div className="space-y-2">
      {alerts.map((a) => {
        const meta = SENSORS[a.sensor] || { label: a.sensor, unit: '', icon: '❓' };
        return (
          <div
            key={a._id}
            className={`card flex items-center justify-between gap-3 border-l-4 ${
              a.severity === 'DANGER' ? 'border-l-red-500' : 'border-l-amber-500'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span>{meta.icon}</span>
                <span className="font-semibold text-ink">{meta.label}</span>
                <StatusBadge status={a.severity} size="sm" />
                {a.active && (
                  <span className="text-xs text-red-500 font-medium">ACTIVE</span>
                )}
              </div>
              <div className="text-sm text-slate-600 mt-0.5">
                Value <b>{fmt(a.value)}{meta.unit && ` ${meta.unit}`}</b>
                {a.previousValue != null && (
                  <span className="text-slate-400">
                    {' '}(was {fmt(a.previousValue)})
                  </span>
                )}
                {a.threshold && (
                  <span className="text-slate-400"> · safe {a.threshold}</span>
                )}
              </div>
            </div>
            <div className="text-right text-xs text-slate-400 whitespace-nowrap">
              {new Date(a.createdAt).toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function fmt(v) {
  return v == null ? '—' : Number(v).toFixed(2);
}
