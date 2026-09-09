# FishSafe — Power Architecture

The **single most common cause of failure** in ESP32 + SIM800L projects is
**power**. The SIM800L draws short **~2 A** current spikes during GSM
transmission. If it shares the ESP32's regulator, the rail sags, the ESP32
browns out, and the board **reboots in a loop**. This document prevents that.

## Golden rules

1. **Never power the SIM800L from the ESP32's 3V3 or 5V pin.** It needs its own
   3.4–4.4 V (ideal ~4.0 V) source able to deliver 2 A bursts.
2. **All grounds must be common** (ESP32, SIM800L, every sensor, the supply).
3. Add a **big bulk capacitor** right at the SIM800L VCC: **1000 µF (or more)**
   electrolytic + a 100 nF ceramic. This absorbs the TX spikes.
4. Power the 5 V sensors from a stable 5 V rail; power 3.3 V sensors from the
   ESP32's onboard 3V3 regulator (their current draw is small).

## Recommended prototype power tree

```
 LiPo 3.7V (1S, 2000–3000 mAh)
   │
   ├─────────────► SIM800L VCC   (direct 3.7–4.2V is IDEAL for SIM800L)
   │                 └─ 1000µF bulk cap + 100nF at the module VCC/GND
   │
   ├──► MT3608 / MP1584 boost-buck ──► 5.0V rail ──► ESP32 VIN
   │                                          └────► pH VCC, Turbidity VCC, Rain VCC (5V)
   │
   └──► (ESP32 onboard AMS1117) ──► 3V3 rail ──► DS18B20, TDS (3.3V mode)
```

Notes:
- A **1S LiPo (3.7 V nominal, up to 4.2 V)** feeds the SIM800L *directly* — this
  is the cleanest way to meet its voltage window. Do **not** feed 5 V into a bare
  SIM800L (max ~4.4 V).
- Use a **buck/boost converter (MP1584 buck or MT3608 boost)** to make the 5 V
  rail for the ESP32 and 5 V sensors from the LiPo.
- Include a **TP4056** module if you want USB charging of the LiPo.

## Current budget (approximate)

| Component | Typical | Peak |
|-----------|--------:|-----:|
| ESP32 (GSM active, Wi-Fi off) | 80 mA | 240 mA |
| SIM800L idle / registered | 20 mA | — |
| SIM800L TX burst | — | **2000 mA** |
| pH module | 5 mA | 10 mA |
| Turbidity | 40 mA | 50 mA |
| TDS | 5 mA | 10 mA |
| Rain board | 15 mA | 20 mA |
| DS18B20 | 1.5 mA | 4 mA |
| **Continuous baseline** | **~170 mA** | — |

Size the LiPo for runtime: `hours ≈ capacity(mAh) / average_mA`. A 3000 mAh
LiPo at ~180 mA average ≈ **15+ hours**; add a small solar panel + TP4056 for
continuous field operation.

## Components that must NOT be powered from an ESP32 GPIO

- ❌ **SIM800L** — dedicated 3.7–4.2 V, 2 A-capable source only.
- ❌ **Turbidity sensor** at 5 V — draws too much for a GPIO; use the 5 V rail.
- ❌ Any sensor's VCC from a *GPIO pin* — GPIOs can source only ~12–40 mA and
  are for signals, not power. Always use the 3V3 / 5V power rails.

## Safe prototype wiring recommendation

1. Bench test on a **breadboard** with a **bench PSU set to 4.0 V** for the
   SIM800L before touching a LiPo.
2. Add the SIM800L bulk capacitor **first**.
3. Confirm the SIM800L registers (`AT+CREG?` → `0,1` or `0,5`) *before* adding
   sensors.
4. Only then add sensors one at a time and verify readings.
5. For deployment, move to a soldered protoboard/PCB — breadboard contacts can't
   handle the SIM800L current spikes reliably.
