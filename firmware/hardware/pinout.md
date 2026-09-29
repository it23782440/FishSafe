# FishSafe — ESP32 Pin Diagram & Wiring Table

> **Board assumed:** ESP32 DevKit v1 (30-pin). All analog sensors use **ADC1**
> pins (GPIO 32–39). **ADC2 pins are avoided** because they conflict with the
> radio; even though we use GSM (not Wi-Fi), ADC1 is the safe, reliable choice.
>
> **CRITICAL:** The ESP32 ADC is **3.3 V max**. Several of these sensor modules
> output **0–5 V**. Those MUST go through a **voltage divider** (or you will
> damage the pin / clip the reading). See the "Interface" column.

## Master connection table

| Component | Module pin | ESP32 pin | Type | Interface / notes |
|-----------|-----------|-----------|------|-------------------|
| **DS18B20 temperature** | DATA | **GPIO4** | Digital 1-Wire | **4.7 kΩ pull-up** from DATA→3V3. Sensor VCC→3V3, GND→GND |
| DS18B20 | VCC | 3V3 | Power | ~1.5 mA |
| DS18B20 | GND | GND | Power | Common ground |
| **pH sensor (PH-4502C)** | Po (analog out) | **GPIO34** | Analog in (input-only) | **Divider 5V→3.3V** (R1=10k, R2=20k). Board VCC→5V |
| pH sensor | V+ | 5V | Power | Powered at 5 V for correct probe bias |
| pH sensor | GND | GND | Power | Common ground |
| **Turbidity (SEN0189)** | A (analog out) | **GPIO35** | Analog in (input-only) | **Divider 5V→3.3V** (R1=10k, R2=20k). Board VCC→5V |
| Turbidity | VCC | 5V | Power | ~40 mA |
| Turbidity | GND | GND | Power | Common ground |
| **TDS / conductivity (DFRobot Gravity)** | A (analog out) | **GPIO32** | Analog in | **Direct** (output ≤ 2.3 V, safe). VCC→**3V3** (3.3 V mode) |
| TDS | VCC | 3V3 | Power | Gravity TDS runs at 3.3–5 V; 3V3 keeps output in ADC range |
| TDS | GND | GND | Power | Common ground |
| **Rain sensor (FC-37 / YL-83)** | AO (analog out) | **GPIO33** | Analog in | **Divider** if powered at 5V. Or power board at 3V3 → direct |
| Rain sensor | VCC | 5V (or 3V3) | Power | Comparator board |
| Rain sensor | GND | GND | Power | Common ground |
| **SIM800L** | TXD | **GPIO16 (RX2)** | UART | SIM TX (2.8 V) → ESP32 RX: safe direct |
| SIM800L | RXD | **GPIO17 (TX2)** | UART | ESP32 TX (3.3 V) → SIM RX (2.8 V): add **1kΩ series + divider** or logic shift |
| SIM800L | VCC | **3.7–4.2 V dedicated** | Power | **NOT from ESP32.** See power.md. Needs 2 A bursts |
| SIM800L | GND | GND | Power | **Common ground with ESP32 — mandatory** |
| ESP32 | 5V / VIN | Buck 5V | Power | From shared supply |
| ESP32 | 3V3 | (regulator out) | Power | Powers 3.3 V sensors |

## Voltage divider (5 V sensor → 3.3 V ADC)

```
 Sensor AO (0–5V) ──[ R1 = 10kΩ ]──┬── ESP32 ADC pin (0–3.3V)
                                    │
                               [ R2 = 20kΩ ]
                                    │
                                   GND
   Vpin = Vsensor × R2/(R1+R2) = Vsensor × 20/30 = 0.667 × Vsensor
   → 5.0 V sensor  ≈ 3.30 V at pin   (matches DIVIDER_PH / DIVIDER_TURB = 0.667)
```

Use this divider on **pH**, **turbidity**, and the **rain AO** (if the rain board
is powered at 5 V). The firmware reconstructs the sensor-side voltage using the
`DIVIDER_*` constants, so the divider ratio and the firmware must agree.

## Do NOT connect directly to an ADC pin

- ❌ pH module analog out at 5 V — needs divider.
- ❌ Turbidity analog out (up to ~4.5 V) — needs divider.
- ❌ Rain AO when powered at 5 V — needs divider.
- ✅ TDS Gravity output (≤ 2.3 V) — safe direct.
- ✅ DS18B20 — digital, 3.3 V logic, safe (with pull-up).

## ADC notes

- 12-bit ADC (0–4095). The firmware uses `analogReadMilliVolts()` which applies
  the ESP32's factory eFuse calibration → far more accurate than raw counts.
- `analogSetAttenuation(ADC_11db)` gives the full ~0–3.3 V range.
- GPIO34/35/36/39 are **input-only** (no internal pull-ups) — perfect for analog.
