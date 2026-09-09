# FishSafe Frontend (Next.js Dashboard)

Responsive real-time dashboard for the FishSafe system. Built with the Next.js
App Router, Tailwind CSS, Recharts, and SWR polling.

## Run locally

```bash
cd frontend
cp .env.example .env.local     # set NEXT_PUBLIC_API_BASE_URL to your backend
npm install
npm run dev                    # http://localhost:3000
```

> Start the backend first (and `npm run seed` it) so there's data to show.

## Environment variables

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend base URL (no trailing slash) |
| `NEXT_PUBLIC_DEVICE_ID` | Default device to display |
| `NEXT_PUBLIC_POLL_MS` | Auto-refresh interval (ms) |

All are `NEXT_PUBLIC_*` because the dashboard fetches the API from the browser.
No secret keys live in the frontend.

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Main dashboard: overall status, 5 sensor cards, active alerts |
| `/sensors/[sensor]` | Per-sensor detail: current value, history chart, calibration |
| `/alerts` | Alert history with filters + counters |
| `/system` | Device, GSM, backend and database health |

## Real-time strategy: polling

The dashboard **polls** the backend every `NEXT_PUBLIC_POLL_MS` (default 10 s)
via SWR. See the root README "Real-time data" section for why polling was
chosen over WebSockets/SSE for a Render + Vercel deployment.

## Structure

```
app/            routes (App Router)
components/      UI: cards, charts, badges, panels
lib/             api client, polling hook, sensor metadata
```
