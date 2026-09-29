# 🐟 FishSafe — Real-Time Water Quality Monitoring & Alert System

Final-year IoT project (NTP/26/09) for **freshwater aquaculture**. A floating
ESP32 device continuously measures water quality, uploads readings over the GSM
network, stores them in MongoDB, and shows them on a live web dashboard — with
SMS alerts when a parameter leaves its safe range.

```
Sensors → ESP32 → SIM800L (GPRS) → Internet → Render Backend → MongoDB → Vercel Dashboard
                        └────────────► SMS alert to farmer (on DANGER)
```

## 1. Project overview

FishSafe replaces slow, manual pond checks with continuous, automatic
monitoring of **5 parameters**: temperature, pH, turbidity, rain, and
conductivity/TDS. When a reading crosses a threshold, the farmer gets an SMS
immediately and the event is logged for the dashboard.

> **Proposal note:** the proposal's narrative monitors **4** parameters
> (temperature, pH, turbidity, rain). Its hardware bill-of-materials also lists
> a **water conductivity sensor**, which this implementation promotes to a
> fully monitored 5th parameter (per the project requirements). Thresholds for
> turbidity, rain, and conductivity are **engineering assumptions** (the
> proposal gives numeric safe ranges only for temperature 25–32 °C and pH
> 6.5–8.5) and must be validated for your target species.

## 2. Architecture

| Layer | Tech | Hosting |
|-------|------|---------|
| Device | ESP32 + SIM800L + 5 sensors | Floating IP67 enclosure |
| Transport | HTTP POST over GPRS + SMS | GSM network |
| Backend | Node.js + Express + Mongoose | **Render** |
| Database | MongoDB | **MongoDB Atlas** |
| Dashboard | Next.js + Tailwind + Recharts | **Vercel** |

## 3. Hardware requirements

See [`hardware/wiring.md`](hardware/wiring.md) for the full BOM. Core parts:
ESP32 DevKit, DS18B20, pH (PH-4502C), turbidity (SEN0189), rain (FC-37),
TDS (DFRobot Gravity), SIM800L, 1S LiPo, buck/boost converter, resistors, caps,
IP67 enclosure + cable glands.

## 4. Software requirements

- Arduino IDE (with ESP32 board support) + the 5 libraries in
  [`firmware/README.md`](firmware/README.md).
- Node.js ≥ 18.
- A MongoDB Atlas account (free tier), Render account, Vercel account.

## 5. Wiring

Pin table: [`hardware/pinout.md`](hardware/pinout.md).
Power tree (why the SIM800L needs its own supply): [`hardware/power.md`](hardware/power.md).

## 6. Firmware setup

[`firmware/README.md`](firmware/README.md). Edit the `CONFIGURATION` block, flash
`FishSafe.ino`, watch the Serial Monitor at 115200 baud.

## 7. Calibration

- **pH** — two-point with pH 4.0 & 7.0 buffers → set `PH_V4`, `PH_V7`.
- **Turbidity** — clear water + NTU references → set `TURB_V_CLEAR`.
- **DS18B20** — cross-check against a reference thermometer.
- **TDS** — known ppm standard at 25 °C.
- **Rain** — dry/wet millivolts → `RAIN_MV_DRY`, `RAIN_MV_WET`.

## 8. Backend setup

[`backend/README.md`](backend/README.md):

```bash
cd backend && cp .env.example .env && npm install && npm run seed && npm run dev
```

## 9. MongoDB setup

1. Create a free cluster at <https://cloud.mongodb.com>.
2. **Database Access** → add a user + password.
3. **Network Access** → allow `0.0.0.0/0` (or Render's IPs).
4. **Connect → Drivers** → copy the SRV string, insert the password, and add the
   db name `fishsafe`. Put it in `MONGODB_URI` (env var, never hard-coded).
   Indexes on `deviceId` + `timestamp` are created automatically by the models.

## 10. Frontend setup

[`frontend/README.md`](frontend/README.md):

```bash
cd frontend && cp .env.example .env.local && npm install && npm run dev
```

## 11. Local testing

1. `cd backend && npm run seed && npm run dev`
2. `cd frontend && npm run dev` → open <http://localhost:3000>
3. Simulate a device upload:

```bash
curl -X POST http://localhost:5000/api/sensors/data \
  -H "Content-Type: application/json" \
  -H "x-api-key: CHANGE_ME_SUPER_SECRET_KEY" \
  -d '{"deviceId":"FISHSAFE-001","temperature":28.5,"ph":7.2,"turbidity":15.4,"rain":0,"conductivity":450,"signal":80}'
```

The dashboard should update within one poll interval (~10 s) with no manual
refresh.

## 12. Render deployment (backend)

1. Push this repo to GitHub.
2. Render → **New + → Web Service** → pick the repo. Root directory: `backend`.
   - Build: `npm install` · Start: `npm start` · Health check: `/api/health`
   - (Or use the included [`backend/render.yaml`](backend/render.yaml) blueprint.)
3. Add env vars: `MONGODB_URI`, `DEVICE_API_KEY`, `CORS_ORIGINS`
   (your Vercel URL), `NODE_ENV=production`, `DEVICE_OFFLINE_SECONDS=180`.
4. Deploy → note the `https://<name>.onrender.com` URL.

> Free Render services sleep after inactivity; the first request wakes them
> (few seconds). Polling from the dashboard keeps it warm while open.

## 13. Vercel deployment (frontend)

1. Vercel → **New Project** → import the repo. Root directory: `frontend`.
2. Env vars: `NEXT_PUBLIC_API_BASE_URL=https://<name>.onrender.com`,
   `NEXT_PUBLIC_DEVICE_ID=FISHSAFE-001`, `NEXT_PUBLIC_POLL_MS=10000`.
3. Deploy. Then set the backend's `CORS_ORIGINS` to the Vercel domain and
   redeploy the backend.

## 14. Environment variables (summary)

**Backend:** `PORT`, `NODE_ENV`, `MONGODB_URI`, `DEVICE_API_KEY`,
`CORS_ORIGINS`, `DEVICE_OFFLINE_SECONDS`.
**Frontend:** `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_DEVICE_ID`,
`NEXT_PUBLIC_POLL_MS`.
**Firmware:** `API_HOST/PORT/PATH`, `API_KEY`, `APN`, `ALERT_PHONE`, calibration.

## 15. API documentation

Full table in [`backend/README.md`](backend/README.md).

## 16. Real-time data — why polling

Polling (SWR every ~10 s) was chosen over WebSockets/SSE because:
- Render's free tier and serverless-friendly hosting handle short HTTP requests
  far more reliably than long-lived socket connections.
- The device only reports once per minute, so sub-second latency is unnecessary.
- Polling auto-recovers from a sleeping/restarting backend with zero extra code.
- It works identically in local dev, Vercel, and behind any proxy.

## 17. Troubleshooting

See **PART 10** of the project write-up, and per-component READMEs. Highlights:
ESP32 reboot loop → SIM800L power (`hardware/power.md`); CORS error → set
`CORS_ORIGINS`; dashboard not updating → check `NEXT_PUBLIC_API_BASE_URL` and
the backend health endpoint.

## Project structure

```
FishSafe/
├── firmware/          ESP32 Arduino firmware (.ino) + setup
├── backend/           Express API, models, services (Render)
├── frontend/          Next.js dashboard (Vercel)
├── hardware/          pinout / wiring / power docs
└── README.md
```
