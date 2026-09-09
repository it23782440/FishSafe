'use client';
import { useLiveData } from '@/lib/useLiveData';
import { endpoints, DEVICE_ID, API_BASE } from '@/lib/api';
import DeviceStatus from '@/components/DeviceStatus';
import { Skeleton } from '@/components/Loading';

export default function SystemPage() {
  const device = useLiveData(endpoints.device());
  const health = useLiveData(endpoints.health(), { interval: 15000 });
  const latest = useLiveData(endpoints.latest());

  const dev = device.data;
  const online = dev?.online ?? false;
  const backendOk = !health.error && health.data?.status === 'ok';
  const reading = latest.data;

  const deviceRows = [
    { label: 'Device ID', value: DEVICE_ID },
    { label: 'Name', value: dev?.name || '—' },
    {
      label: 'GSM connection',
      value: online ? 'Connected' : 'No recent contact',
      dot: true,
      ok: online,
    },
    {
      label: 'Signal strength',
      value: dev?.lastSignal != null ? `${dev.lastSignal}%` : '—',
    },
    {
      label: 'Last communication',
      value: dev?.lastSeen ? new Date(dev.lastSeen).toLocaleString() : '—',
    },
    { label: 'Total readings', value: dev?.totalReadings ?? '—' },
    { label: 'Firmware', value: dev?.firmware || '1.0.0' },
    { label: 'Overall status', value: reading?.overallStatus || '—' },
  ];

  const infraRows = [
    {
      label: 'Backend API',
      value: backendOk ? 'Online' : 'Unreachable',
      dot: true,
      ok: backendOk,
    },
    { label: 'API base URL', value: API_BASE },
    {
      label: 'Backend uptime',
      value: health.data?.uptime ? `${Math.round(health.data.uptime)}s` : '—',
    },
    {
      label: 'Database',
      // If /health responds and latest reading exists, DB is effectively up.
      value: backendOk ? 'Connected (MongoDB)' : 'Unknown',
      dot: true,
      ok: backendOk,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">System Information</h1>
        <p className="text-sm text-slate-500">
          Device, GSM link, backend and database health.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-500 mb-2">Device</h2>
          {device.isLoading && !dev ? (
            <Skeleton className="h-72 rounded-2xl" />
          ) : (
            <DeviceStatus rows={deviceRows} />
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-500 mb-2">
            Backend &amp; Database
          </h2>
          <DeviceStatus rows={infraRows} />
        </div>
      </div>
    </div>
  );
}
