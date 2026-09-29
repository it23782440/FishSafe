# FishSafe — Wiring & Assembly Guide

This complements `pinout.md` (pin table) and `power.md` (power tree) with the
physical build steps for the floating enclosure.

## 1. SIM800L ↔ ESP32 UART

```
 ESP32 GPIO17 (TX2) ──[ 1kΩ ]──┬──────────► SIM800L RXD
                                │
                           [ 2kΩ ]           (divider: 3.3V → ~2.2V for SIM RX)
                                │
                               GND

 SIM800L TXD (2.8V) ───────────────────────► ESP32 GPIO16 (RX2)   (safe, no divider)

 SIM800L GND ───────────────────────────────► ESP32 GND           (COMMON GROUND)
 SIM800L VCC ───────────────────────────────► 3.7–4.2V dedicated  (see power.md)
```

- UART baud: **9600** (`SerialAT.begin(9600, SERIAL_8N1, 16, 17)` in firmware).
- The ESP32 TX→SIM RX divider protects the 2.8 V logic input. SIM TX→ESP RX is
  fine directly (2.8 V is a valid logic-high for the ESP32).

## 2. Sensor probe placement (floating device)

```
        ┌──────────────────────────────┐   ← IP67 ABS enclosure (floats)
        │  ESP32 + SIM800L + battery    │
        │  + buck converter + caps      │
        └───┬─────┬──────┬──────┬───────┘
     cable glands (silicone-sealed)
            │     │      │      │
         DS18B20  pH   Turb.   TDS      ← probes suspended below the waterline
        (rain sensor mounted on the TOP lid, facing up)
```

- Sensor cables pass through **cable glands**; seal each with **silicone** to
  keep the IP67 rating (proposal: Critical Success Factor "Waterproofing").
- The **rain sensor board** sits on the **top** of the lid (exposed to sky), not
  underwater.
- Keep the **DS18B20** near the pH/TDS probes so its temperature reading is a
  valid compensation reference for the TDS calculation.

## 3. Bench bring-up order (recommended)

1. ESP32 alone — flash firmware, confirm Serial Monitor boot log.
2. Add DS18B20 — confirm a sane temperature.
3. Add SIM800L on its own power — confirm network registration in the log.
4. Add analog sensors **one at a time**, each through its divider.
5. Calibrate (see project README → Calibration).
6. Seal into the enclosure and run the submersion test.

## 4. Pre-deployment waterproof test (from proposal)

- Seal the empty (or dummy-weighted) enclosure and submerge for **1–2 hours**.
- Check for any water ingress at glands/seams before installing electronics.
- Only fit electronics after the enclosure passes dry.

## Bill of materials (prototype)

| Item | Qty | Notes |
|------|----:|-------|
| ESP32 DevKit v1 | 1 | Dual-core, ADC1 pins used |
| DS18B20 waterproof probe | 1 | + 4.7 kΩ resistor |
| pH sensor module (PH-4502C) + probe | 1 | 5 V, needs divider |
| Turbidity sensor (SEN0189) | 1 | 5 V, needs divider |
| TDS/conductivity (DFRobot Gravity) | 1 | 3.3 V mode, direct |
| Rain sensor (FC-37/YL-83) | 1 | analog + digital out |
| SIM800L module | 1 | + SIM with data plan |
| 1S LiPo 3000 mAh | 1 | SIM800L + system power |
| MP1584 buck / MT3608 boost | 1 | 5 V rail |
| TP4056 charger | 1 | optional USB charging |
| 1000 µF + 100 nF caps | 1 set | SIM800L decoupling |
| Resistors 10k, 20k, 1k, 2k, 4.7k | set | dividers + pull-up |
| IP67 ABS enclosure + cable glands + silicone | 1 | floating housing |
| Breadboard + jumper wires | 1 | prototyping |
