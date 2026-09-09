'use client';

/* Small key/value grid used on the System page. */
export default function DeviceStatus({ rows = [] }) {
  return (
    <div className="card">
      <dl className="divide-y divide-slate-100">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2.5">
            <dt className="text-sm text-slate-500">{r.label}</dt>
            <dd className="text-sm font-medium text-ink text-right flex items-center gap-2">
              {r.dot && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    r.ok ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
              )}
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
