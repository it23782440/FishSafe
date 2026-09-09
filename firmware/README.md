# FishSafe Firmware (ESP32)

ESP32 firmware that reads five water-quality sensors, classifies each against
thresholds, uploads a JSON reading to the backend over SIM800L GPRS, and sends
an SMS on DANGER.

## Libraries (Arduino IDE → Library Manager)

| Library | Author |
|---------|--------|
| TinyGSM | Volodymyr Shymanskyy |
| ArduinoHttpClient | Arduino |
| ArduinoJson (v6) | Benoit Blanchon |
| OneWire | Paul Stoffregen |
| DallasTemperature | Miles Burton |

## Board setup

1. **Boards Manager URL** (File → Preferences):
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
2. Install **esp32 by Espressif Systems** (Boards Manager).
3. Select **ESP32 Dev Module**, correct COM port, upload speed 115200.

## Configure before flashing

Everything you change lives in the **`CONFIGURATION`** block at the top of
`FishSafe.ino`:

| Constant | What to set |
|----------|-------------|
| `DEVICE_ID` | Must match the device in the dashboard (`FISHSAFE-001`) |
| `API_HOST` / `API_PORT` / `API_PATH` | Your Render backend host + `/api/sensors/data` |
| `API_KEY` | Must equal `DEVICE_API_KEY` on the backend |
| `APN` | Your SIM carrier's APN (e.g. `dialogbb`, `internet`) |
| `ALERT_PHONE` | Farmer's phone, international format `+94...` |
| `PH_V7`, `PH_V4` | pH calibration voltages (see below) |
| `TURB_V_CLEAR` | Turbidity clear-water voltage |
| `RAIN_MV_DRY`, `RAIN_MV_WET` | Rain dry/wet millivolts |
| `TH_*` structs | Thresholds — keep identical to `backend/src/config/thresholds.js` |

## HTTP vs HTTPS note

SIM800L + TinyGSM does **plain HTTP** most reliably. Set `API_PORT = 80`. Render
serves HTTPS by default, but the `*.onrender.com` host also answers HTTP and
redirects — for an academic prototype the simplest robust path is HTTP on port
80. If your backend enforces HTTPS, use `TinyGsmClientSecure` (SIM800 SSL is
flaky) or put a tiny HTTP relay in front. This trade-off is documented so you
can demo reliably.

## Calibration quick steps

- **pH:** put probe in pH 7.0 buffer, read the pin voltage from Serial (add a
  temporary `Serial.println(analogReadMilliVolts(34)/1000.0)`), set `PH_V7`.
  Repeat in pH 4.0 buffer → `PH_V4`.
- **Turbidity:** in clear water, note the reconstructed sensor voltage → set
  `TURB_V_CLEAR`.
- **Rain:** dry board → note millivolts → `RAIN_MV_DRY`; fully wet → `RAIN_MV_WET`.
- **TDS:** immerse in a known ppm standard, tweak until the reading matches.
- **DS18B20:** compare to a reference thermometer; add a fixed offset if needed.

## Serial Monitor

Open at **115200 baud**. You'll see the boot log, GSM/GPRS status, a per-reading
dump, the exact JSON payload, and the HTTP status code for every upload.
