'use client';
import { useLiveData } from '@/lib/useLiveData';
import { endpoints, DEVICE_ID } from '@/lib/api';
import { SENSOR_KEYS } from '@/lib/sensorMeta';
import OverallStatus from '@/components/OverallStatus';
import SensorCard from '@/components/SensorCard';
import AlertsPanel from '@/components/AlertsPanel';
import { Skeleton, ErrorState, EmptyState } from '@/components/Loading';

export default function DashboardPage() {
  // Three polled data sources: latest reading, device status, active alerts.
  const latest = useLiveData(endpoints.latest());
  const device = useLiveData(endpoints.device());
  const alerts = useLiveData(endpoints.alerts({ active: 'true', limit: '20' }));

  if (latest.error) return <ErrorState message={latest.error.message} />;

  const reading = latest.data;
  const dev = device.data;
  const online = dev?.online ?? false;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Device <span className="font-mono">{DEVICE_ID}</span> · live view
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-sky-500 live-dot" />
          Auto-refreshing
        </div>
      </div>

      {/* Overall status hero */}
      {latest.isLoading && !reading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : reading ? (
        <OverallStatus
          status={reading.overallStatus}
          timestamp={reading.timestamp}
          online={online}
        />
      ) : (
        <EmptyState message="No readings received yet. Power on the device or run the backend seed script." />
      )}

      {/* Sensor grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {SENSOR_KEYS.map((key) =>
          reading ? (
            <SensorCard
              key={key}
              sensorKey={key}
              value={reading[key]}
              status={reading.statuses?.[key] || 'UNKNOWN'}
            />
          ) : (
            <Skeleton key={key} className="h-32 rounded-2xl" />
          )
        )}
      </div>

      {/* Active alerts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-ink">Active Alerts</h2>
          <a href="/alerts" className="text-sm text-sky-600 hover:underline">
            View all →
          </a>
        </div>
        {alerts.isLoading && !alerts.data ? (
          <Skeleton className="h-16 rounded-2xl" />
        ) : (
          <AlertsPanel alerts={alerts.data?.alerts || []} />
        )}
      </div>
    </div>
  );
}
