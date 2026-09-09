/*
 * Central API helper. All dashboard data goes through here so the backend URL
 * and field names are defined in exactly one place.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export const DEVICE_ID =
  process.env.NEXT_PUBLIC_DEVICE_ID || 'FISHSAFE-001';

export const POLL_MS = Number(process.env.NEXT_PUBLIC_POLL_MS || 10000);

/** Generic JSON fetcher used by SWR. Throws on non-2xx. */
export async function fetcher(path) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`API ${res.status}: ${body || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Convenience path builders (single source of truth for endpoints).
export const endpoints = {
  health: () => `/api/health`,
  latest: (deviceId = DEVICE_ID) => `/api/sensors/latest?deviceId=${deviceId}`,
  history: (range = '24h', deviceId = DEVICE_ID) =>
    `/api/sensors/history?deviceId=${deviceId}&range=${range}`,
  sensor: (sensor, range = '24h', deviceId = DEVICE_ID) =>
    `/api/sensors/${sensor}?deviceId=${deviceId}&range=${range}`,
  alerts: (opts = {}, deviceId = DEVICE_ID) => {
    const q = new URLSearchParams({ deviceId, ...opts }).toString();
    return `/api/alerts?${q}`;
  },
  device: (deviceId = DEVICE_ID) => `/api/device/status?deviceId=${deviceId}`,
  thresholds: () => `/api/config/thresholds`,
};
