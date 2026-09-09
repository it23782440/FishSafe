import { STATUS_STYLE } from '@/lib/sensorMeta';

export default function StatusBadge({ status = 'UNKNOWN', size = 'md' }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.UNKNOWN;
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad} ${s.bg} ${s.text}`}
    >
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
