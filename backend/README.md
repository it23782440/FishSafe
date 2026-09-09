# FishSafe Backend (Node + Express + MongoDB)

REST API that ingests ESP32 readings, stores them in MongoDB, computes
SAFE/WARNING/DANGER status server-side, generates de-duplicated alerts, and
serves the dashboard.

## Run locally

```bash
cd backend
cp .env.example .env          # then edit .env with your MongoDB URI + secrets
npm install
npm run dev                   # nodemon, http://localhost:5000
```

Seed ~24h of demo data (no hardware needed):

```bash
npm run seed
```

Health check: <http://localhost:5000/api/health>

## Environment variables

| Var | Purpose |
|-----|---------|
| `PORT` | Server port (Render sets this automatically) |
| `NODE_ENV` | `development` / `production` |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `DEVICE_API_KEY` | Shared secret the ESP32 sends in `x-api-key` |
| `CORS_ORIGINS` | Comma-separated allowed browser origins (Vercel URLs) |
| `DEVICE_OFFLINE_SECONDS` | Seconds without data before device = offline |

## API reference

Base path: `/api`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | – | Service + uptime |
| POST | `/sensors/data` | `x-api-key` | Ingest one reading (device) |
| GET | `/sensors/latest?deviceId=` | – | Most recent reading |
| GET | `/sensors/history?deviceId=&range=24h` | – | Readings in range (chronological) |
| GET | `/sensors/:sensor?deviceId=&range=` | – | Time series for one sensor |
| GET | `/alerts?deviceId=&active=&severity=` | – | Alert history |
| GET | `/device/status?deviceId=` | – | Online/offline + signal + last seen |
| GET | `/config/thresholds` | – | Threshold config |

`:sensor` ∈ `temperature | ph | turbidity | rain | conductivity`
`range` ∈ `1h | 6h | 24h | 7d | 30d`

### POST /sensors/data — request body

```json
{
  "deviceId": "FISHSAFE-001",
  "temperature": 28.5,
  "ph": 7.2,
  "turbidity": 15.4,
  "rain": 0,
  "conductivity": 450,
  "statuses": { "temperature": "SAFE", "ph": "SAFE", "turbidity": "SAFE", "rain": "SAFE", "conductivity": "SAFE" },
  "overallStatus": "SAFE",
  "signal": 78
}
```

The server **recomputes** `statuses` and `overallStatus` from `thresholds.js`
(the device values are advisory), so the dashboard can never disagree with the
configured thresholds. A failed sensor should be sent as `null`.

### Example response

```json
{ "ok": true, "id": "66b...", "overallStatus": "SAFE",
  "statuses": { "temperature": "SAFE", "ph": "SAFE", "turbidity": "SAFE", "rain": "SAFE", "conductivity": "SAFE" },
  "alertsCreated": 0 }
```

## Architecture

```
routes ─► middleware (auth, validate) ─► controllers ─► services ─► models ─► MongoDB
                                                    │
                                     statusService (thresholds) + alertService (dedup)
```

## Security

- API-key auth on device write (`x-api-key`).
- `helmet` security headers.
- CORS restricted to configured origins.
- `express-rate-limit` (120 req/min/IP).
- Payload validation + 16 kb body cap.
- No secrets in code — all via env vars.
