import { STATUS_STYLE } from '@/lib/sensorMeta';

/* Big hero banner showing the overall system status + last update time. */
export default function OverallStatus({ status = 'UNKNOWN', timestamp, online }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.UNKNOWN;
  const when = timestamp ? new Date(timestamp) : null;

  const headline = {
    SAFE: 'All parameters within safe range',
    WARNING: 'Attention: one or more parameters in warning range',
    DANGER: 'Danger: immediate action required',
    UNKNOWN: 'Waiting for data…',
  }[status];

  return (
    <div className={`rounded-2xl p-6 border ${s.bg} border-slate-200`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className={`w-4 h-4 rounded-full ${s.dot} live-dot`} />
          <div>
            <div className={`text-2xl font-bold ${s.text}`}>{s.label}</div>
            <div className="text-sm text-slate-600">{headline}</div>
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="flex items-center gap-2 justify-end">
            <span
              className={`w-2 h-2 rounded-full ${
                online ? 'bg-green-500' : 'bg-slate-400'
              }`}
            />
            <span className={online ? 'text-green-700' : 'text-slate-500'}>
              {online ? 'Device online' : 'Device offline'}
            </span>
          </div>
          <div className="text-slate-500 mt-1">
            {when ? `Last update: ${when.toLocaleString()}` : 'No readings yet'}
          </div>
        </div>
      </div>
    </div>
  );
}
