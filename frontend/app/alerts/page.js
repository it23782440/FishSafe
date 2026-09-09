'use client';
import { useState } from 'react';
import { useLiveData } from '@/lib/useLiveData';
import { endpoints } from '@/lib/api';
import AlertsPanel from '@/components/AlertsPanel';
import { Skeleton, ErrorState } from '@/components/Loading';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'DANGER', label: 'Danger' },
  { key: 'WARNING', label: 'Warning' },
];

export default function AlertsPage() {
  const [filter, setFilter] = useState('all');

  const opts = { limit: '200' };
  if (filter === 'active') opts.active = 'true';
  if (filter === 'DANGER' || filter === 'WARNING') opts.severity = filter;

  const { data, error, isLoading } = useLiveData(endpoints.alerts(opts));

  if (error) return <ErrorState message={error.message} />;

  const alerts = data?.alerts || [];
  const dangerCount = alerts.filter((a) => a.severity === 'DANGER').length;
  const warnCount = alerts.filter((a) => a.severity === 'WARNING').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Alerts</h1>
        <p className="text-sm text-slate-500">
          Threshold breaches with previous/current value, threshold and time.
        </p>
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="card-title">Total shown</div>
          <div className="text-3xl font-bold text-ink">{alerts.length}</div>
        </div>
        <div className="card">
          <div className="card-title">Danger</div>
          <div className="text-3xl font-bold text-red-600">{dangerCount}</div>
        </div>
        <div className="card">
          <div className="card-title">Warning</div>
          <div className="text-3xl font-bold text-amber-600">{warnCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 text-sm rounded-md font-medium transition ${
              filter === f.key
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && !data ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : (
        <AlertsPanel alerts={alerts} emptyText="No alerts match this filter." />
      )}
    </div>
  );
}
