/*
 * ============================================================================
 *  FishSafe - Real-Time Water Quality Monitoring & Alert System
 *  Firmware for ESP32 + SIM800L GSM/GPRS
 * ----------------------------------------------------------------------------
 *  Sensors:   DS18B20 (temperature), pH, Turbidity, Rain, TDS/Conductivity
 *  Flow:      Sensors -> ESP32 -> SIM800L (GPRS) -> Backend API -> MongoDB
 *  Alerts:    On DANGER, an SMS is sent directly from the SIM800L to the farmer.
 *
 *  Board:     ESP32 Dev Module (Arduino core for ESP32 >= 2.0.x)
 *  Author:    FishSafe Team (NTP/26/09)
 *
 *  REQUIRED LIBRARIES (install via Arduino IDE Library Manager):
 *    - TinyGSM               by Volodymyr Shymanskyy   (>= 0.11.7)
 *    - ArduinoHttpClient     by Arduino                (>= 0.4.0)
 *    - ArduinoJson           by Benoit Blanchon        (>= 6.21.0)
 *    - OneWire               by Paul Stoffregen        (>= 2.3.7)
 *    - DallasTemperature     by Miles Burton           (>= 3.9.0)
 *
 *  >>> EVERYTHING YOU MAY NEED TO CHANGE IS IN THE "CONFIGURATION" BLOCK <<<
 * ============================================================================
 */

// TinyGSM must know the modem model BEFORE including the library.
#define TINY_GSM_MODEM_SIM800
#define TINY_GSM_RX_BUFFER 1024      // Larger RX buffer = fewer dropped bytes.
#define SerialMon Serial             // USB serial monitor (debug)
#define SerialAT  Serial2            // UART2 talks to the SIM800L

#include <TinyGsmClient.h>
#include <ArduinoHttpClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ============================================================================
//  1) CONFIGURATION  --  edit the values in this block for your deployment
// ============================================================================

// ---- Device identity ----
const char* DEVICE_ID  = "FISHSAFE-001";     // Must match a device in the backend

// ---- Backend API (Render) ----
// Use the plain host (no https://) + port. TinyGSM's SIM800L does plain HTTP.
// If your backend is HTTPS-only on Render, either enable the SSL client
// (see notes in hardware/README) or place an HTTP proxy in front. For an
// academic prototype, HTTP on port 80 to the Render host is the simplest path.
const char* API_HOST   = "https://fishsafebackend-production.up.railway.app"; // <-- CHANGE ME
const int   API_PORT   = 443;                           // 80 = HTTP, 443 = HTTPS
const char* API_PATH   = "/api/sensors/data";          // POST endpoint
const char* API_KEY    = "CHANGE_ME_SUPER_SECRET_KEY"; // Must equal DEVICE_API_KEY on backend

// ---- Cellular (GPRS) ----
const char* APN        = "dialogbb";   // <-- CHANGE to your carrier's APN
const char* GPRS_USER  = "";           // usually empty
const char* GPRS_PASS  = "";           // usually empty
const char* SIM_PIN    = "";           // SIM PIN, or "" if disabled

// ---- SMS alert recipient (farmer's phone, international format) ----
const char* ALERT_PHONE = "+94769767326";  // <-- CHANGE ME

// ---- Timing ----
const unsigned long SEND_INTERVAL_MS = 60UL * 1000UL; // send every 60 s
const unsigned long SMS_COOLDOWN_MS  = 15UL * 60UL * 1000UL; // 15 min anti-spam
const int  MAX_HTTP_RETRIES = 3;

// ---- ADC (ESP32 12-bit, calibrated millivolt read) ----
const int  ADC_SAMPLES = 20;           // averaged samples per analog read

// ---- CALIBRATION (see PART 9 / hardware/README for procedure) ----
// pH: two-point calibration. Measure the analog voltage (in Volts, AT THE
//     ESP32 PIN i.e. AFTER the divider) while probe sits in pH7 then pH4 buffer.
float PH_V7 = 1.65;   // ESP32-pin voltage in pH 7.0 buffer  <-- CALIBRATE
float PH_V4 = 2.02;   // ESP32-pin voltage in pH 4.0 buffer  <-- CALIBRATE

// Turbidity: raw sensor voltage (reconstructed to sensor side) in CLEAR water.
float TURB_V_CLEAR = 4.10;  // sensor-side volts in clear water <-- CALIBRATE

// TDS/Conductivity: probe K factor is baked into the DFRobot formula; set the
// reference temperature used for compensation.
float TDS_TEMP_C = 25.0;    // will be overwritten by live DS18B20 temperature

// Rain: raw millivolts at the ESP32 pin for fully DRY and fully WET board.
int   RAIN_MV_DRY = 3100;   // dry board  (high voltage) <-- CALIBRATE
int   RAIN_MV_WET = 700;    // soaked board (low voltage) <-- CALIBRATE

// Hardware voltage divider ratio for 5V-swing sensors -> 3.3V ADC.
// Vpin = Vsensor * DIVIDER  (R1=10k top, R2=20k bottom => 0.667). pH & turbidity
// & rain go through this divider; TDS (Gravity, 0-2.3V) is wired direct => 1.0.
const float DIVIDER_PH   = 0.667;
const float DIVIDER_TURB = 0.667;
const float DIVIDER_TDS  = 1.000;

// ============================================================================
//  2) THRESHOLDS  --  keep these IDENTICAL to backend/src/config/thresholds.js
//     Values from the FishSafe proposal where given; others are documented
//     engineering assumptions that MUST be validated for your target species.
// ============================================================================
struct Range { float warnLow, safeLow, safeHigh, warnHigh; };
//                         v-- below = DANGER  |  safe band  |  above = DANGER --v
Range TH_TEMP = { 23.0, 25.0, 32.0, 34.0 };   // Proposal: tilapia 25-32 C
Range TH_PH   = { 6.0,  6.5,  8.5,  9.0  };   // Proposal: pH 6.5-8.5
// Turbidity/Rain/TDS only have an UPPER concern (or are one-sided): we encode
// them with a wide low side so only the high side trips.
Range TH_TURB = { -1e9, -1e9, 25.0, 40.0 };   // ASSUMPTION: <25 NTU good
Range TH_RAIN = { -1e9, -1e9, 50.0, 80.0 };   // ASSUMPTION: rain intensity %
Range TH_TDS  = { 50.0, 100.0, 800.0, 1000.0 }; // ASSUMPTION: TDS ppm for tilapia

// ============================================================================
//  3) PIN MAP  (see hardware/pinout.md for the full wiring table)
// ============================================================================
#define PIN_DS18B20   4     // OneWire data (needs 4.7k pull-up to 3V3)
#define PIN_PH        34    // ADC1_CH6, input-only  (via divider)
#define PIN_TURB      35    // ADC1_CH7, input-only  (via divider)
#define PIN_TDS       32    // ADC1_CH4              (direct, <=2.3V)
#define PIN_RAIN      33    // ADC1_CH5              (via divider)
#define PIN_SIM_TX    17    // ESP32 TX2 -> SIM800L RX (through level care)
#define PIN_SIM_RX    16    // ESP32 RX2 <- SIM800L TX
#define PIN_SIM_PWRKEY -1   // set to a GPIO if your SIM800L breakout wires PWRKEY

// ============================================================================
//  Globals
// ============================================================================
TinyGsm        modem(SerialAT);
TinyGsmClient  gsmClient(modem);
HttpClient     http(gsmClient, API_HOST, API_PORT);

OneWire           oneWire(PIN_DS18B20);
DallasTemperature ds18b20(&oneWire);

unsigned long lastSend = 0;
unsigned long lastSmsAt[5] = {0,0,0,0,0};  // per-sensor SMS cooldown timestamps
const char*   SENSOR_NAMES[5] = {"temperature","ph","turbidity","rain","conductivity"};

// Holds one full measurement cycle.
struct Reading {
  float temperature, ph, turbidity, rain, conductivity;
  bool  ok[5];                 // per-sensor validity
  const char* status[5];       // per-sensor status string
  const char* overall;         // worst-of overall status
  int   signalPct;             // GSM signal quality %
};

// ============================================================================
//  Helpers: analog reading
// ============================================================================
// Returns averaged, calibrated millivolts at the given ADC pin.
float readPinMilliVolts(int pin) {
  long sum = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) {
    sum += analogReadMilliVolts(pin);   // ESP32 core factory calibration
    delay(2);
  }
  return (float)sum / ADC_SAMPLES;
}

// ============================================================================
//  Sensor conversions
// ============================================================================
float readTemperature(bool &ok) {
  ds18b20.requestTemperatures();
  float t = ds18b20.getTempCByIndex(0);
  ok = (t != DEVICE_DISCONNECTED_C && t > -40 && t < 85);
  return ok ? t : NAN;
}

float readPH(bool &ok) {
  float vPin = readPinMilliVolts(PIN_PH) / 1000.0;   // volts at pin
  float vSensor = vPin / DIVIDER_PH;                 // reconstruct sensor volts
  // Two-point line through (PH_V7 -> 7.0) and (PH_V4 -> 4.0). Note PH_V4/PH_V7
  // are stored as PIN voltages, so compare against vPin directly.
  float slope = (4.0 - 7.0) / (PH_V4 - PH_V7);       // pH per volt
  float ph = 7.0 + (vPin - PH_V7) * slope;
  ok = (vPin > 0.05 && ph > 0.0 && ph < 14.0);
  (void)vSensor;
  return ok ? ph : NAN;
}

float readTurbidity(bool &ok) {
  float vPin = readPinMilliVolts(PIN_TURB) / 1000.0;
  float v = vPin / DIVIDER_TURB;                     // back to sensor 0-4.5V
  // DFRobot SEN0189 empirical curve (valid ~2.5-4.2V). Clamp to sane NTU.
  float ntu;
  if (v >= TURB_V_CLEAR) ntu = 0.0;                  // clearer than reference
  else ntu = -1120.4 * v * v + 5742.3 * v - 4353.8;
  if (ntu < 0)    ntu = 0;
  if (ntu > 3000) ntu = 3000;
  ok = (vPin > 0.05);
  return ok ? ntu : NAN;
}

float readTDS(bool &ok, float waterTempC) {
  float vPin = readPinMilliVolts(PIN_TDS) / 1000.0;
  float v = vPin / DIVIDER_TDS;
  // Temperature compensation to 25C (DFRobot Gravity TDS formula).
  float comp = 1.0 + 0.02 * (waterTempC - 25.0);
  float vc = v / comp;
  float tds = (133.42 * vc*vc*vc - 255.86 * vc*vc + 857.39 * vc) * 0.5; // ppm
  if (tds < 0) tds = 0;
  ok = (vPin > 0.02);
  return ok ? tds : NAN;
}

float readRain(bool &ok) {
  float mv = readPinMilliVolts(PIN_RAIN);
  // Map DRY(high mv)->0% .. WET(low mv)->100%.
  float pct = (float)(RAIN_MV_DRY - mv) * 100.0 / (float)(RAIN_MV_DRY - RAIN_MV_WET);
  if (pct < 0)   pct = 0;
  if (pct > 100) pct = 100;
  ok = true;                       // resistive rain board is always "readable"
  return pct;
}

// ============================================================================
//  Status logic  (SAFE / WARNING / DANGER) -- mirrors backend statusService.js
// ============================================================================
const char* classify(float v, const Range& r) {
  if (isnan(v)) return "UNKNOWN";
  if (v < r.warnLow  || v > r.warnHigh) return "DANGER";
  if (v < r.safeLow  || v > r.safeHigh) return "WARNING";
  return "SAFE";
}

// Overall = the worst status among all valid sensors.
const char* worstOf(const char* s[5]) {
  bool danger = false, warning = false;
  for (int i = 0; i < 5; i++) {
    if (strcmp(s[i], "DANGER")  == 0) danger  = true;
    if (strcmp(s[i], "WARNING") == 0) warning = true;
  }
  if (danger)  return "DANGER";
  if (warning) return "WARNING";
  return "SAFE";
}

// ============================================================================
//  Take one full reading cycle. Continues even if individual sensors fail.
// ============================================================================
Reading takeReading() {
  Reading r;
  r.temperature  = readTemperature(r.ok[0]);
  r.rain         = readRain(r.ok[3]);
  r.temperature  = r.ok[0] ? r.temperature : NAN;
  float tForTds  = r.ok[0] ? r.temperature : 25.0;
  r.ph           = readPH(r.ok[1]);
  r.turbidity    = readTurbidity(r.ok[2]);
  r.conductivity = readTDS(r.ok[4], tForTds);

  r.status[0] = r.ok[0] ? classify(r.temperature,  TH_TEMP) : "UNKNOWN";
  r.status[1] = r.ok[1] ? classify(r.ph,           TH_PH)   : "UNKNOWN";
  r.status[2] = r.ok[2] ? classify(r.turbidity,    TH_TURB) : "UNKNOWN";
  r.status[3] = r.ok[3] ? classify(r.rain,         TH_RAIN) : "UNKNOWN";
  r.status[4] = r.ok[4] ? classify(r.conductivity, TH_TDS)  : "UNKNOWN";
  r.overall   = worstOf(r.status);

  int csq = modem.getSignalQuality();            // 0-31, 99 = unknown
  r.signalPct = (csq == 99 || csq < 0) ? 0 : (int)((csq / 31.0) * 100.0);
  return r;
}

// ============================================================================
//  Build the JSON payload (field names MUST match the backend schema)
// ============================================================================
String buildJson(const Reading& r) {
  StaticJsonDocument<512> doc;
  doc["deviceId"] = DEVICE_ID;
  // Send null for a failed sensor rather than a bogus number.
  if (r.ok[0]) doc["temperature"]  = round2(r.temperature);  else doc["temperature"]  = nullptr;
  if (r.ok[1]) doc["ph"]           = round2(r.ph);           else doc["ph"]           = nullptr;
  if (r.ok[2]) doc["turbidity"]    = round2(r.turbidity);    else doc["turbidity"]    = nullptr;
  if (r.ok[3]) doc["rain"]         = round2(r.rain);         else doc["rain"]         = nullptr;
  if (r.ok[4]) doc["conductivity"] = round2(r.conductivity); else doc["conductivity"] = nullptr;

  JsonObject st = doc.createNestedObject("statuses");
  st["temperature"]  = r.status[0];
  st["ph"]           = r.status[1];
  st["turbidity"]    = r.status[2];
  st["rain"]         = r.status[3];
  st["conductivity"] = r.status[4];

  doc["overallStatus"] = r.overall;
  doc["signal"]        = r.signalPct;

  String out;
  serializeJson(doc, out);
  return out;
}

float round2(float v){ return isnan(v) ? v : roundf(v * 100.0) / 100.0; }

// ============================================================================
//  GSM / GPRS lifecycle
// ============================================================================
bool gsmConnect() {
  SerialMon.println(F("[GSM] Initialising modem..."));
  modem.restart();                                  // clean state each connect
  String info = modem.getModemInfo();
  SerialMon.print(F("[GSM] Modem: ")); SerialMon.println(info);

  if (strlen(SIM_PIN) && modem.getSimStatus() != 3) modem.simUnlock(SIM_PIN);

  SerialMon.print(F("[GSM] Waiting for network..."));
  if (!modem.waitForNetwork(60000L)) { SerialMon.println(F(" FAIL")); return false; }
  SerialMon.println(F(" OK"));

  SerialMon.print(F("[GPRS] Connecting APN: ")); SerialMon.println(APN);
  if (!modem.gprsConnect(APN, GPRS_USER, GPRS_PASS)) { SerialMon.println(F("[GPRS] FAIL")); return false; }
  SerialMon.print(F("[GPRS] Connected. IP: ")); SerialMon.println(modem.getLocalIP());
  return true;
}

// POST the JSON payload with retries. Returns true on HTTP 2xx.
bool postReading(const String& json) {
  for (int attempt = 1; attempt <= MAX_HTTP_RETRIES; attempt++) {
    SerialMon.printf("[HTTP] POST attempt %d/%d\n", attempt, MAX_HTTP_RETRIES);

    if (!modem.isGprsConnected()) {                 // recover a dropped link
      SerialMon.println(F("[GPRS] Link down, reconnecting..."));
      if (!gsmConnect()) { delay(3000); continue; }
    }

    http.setTimeout(20000);
    http.beginRequest();
    http.post(API_PATH);
    http.sendHeader("Content-Type", "application/json");
    http.sendHeader("x-api-key", API_KEY);
    http.sendHeader("Content-Length", json.length());
    http.beginBody();
    http.print(json);
    http.endRequest();

    int status = http.responseStatusCode();
    String body = http.responseBody();
    SerialMon.printf("[HTTP] status=%d body=%s\n", status, body.c_str());

    if (status >= 200 && status < 300) return true;
    delay(2000L * attempt);                          // simple backoff
  }
  return false;
}

// ============================================================================
//  SMS alerts (device-side, immediate) with per-sensor anti-spam cooldown
// ============================================================================
void maybeSendSms(const Reading& r) {
  for (int i = 0; i < 5; i++) {
    if (strcmp(r.status[i], "DANGER") != 0) continue;
    unsigned long now = millis();
    if (now - lastSmsAt[i] < SMS_COOLDOWN_MS && lastSmsAt[i] != 0) continue;

    float val = (i==0?r.temperature:i==1?r.ph:i==2?r.turbidity:i==3?r.rain:r.conductivity);
    char msg[140];
    snprintf(msg, sizeof(msg),
      "FishSafe %s ALERT: %s = %.1f (DANGER). Check pond now.",
      DEVICE_ID, SENSOR_NAMES[i], val);
    SerialMon.print(F("[SMS] ")); SerialMon.println(msg);
    if (modem.sendSMS(ALERT_PHONE, String(msg))) lastSmsAt[i] = now;
  }
}

// ============================================================================
//  Arduino setup / loop
// ============================================================================
void setup() {
  SerialMon.begin(115200);
  delay(200);
  SerialMon.println(F("\n=== FishSafe firmware booting ==="));

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);          // full 0-3.3V range on ADC pins
  ds18b20.begin();

  // SIM800L UART. 9600 baud is the safe default for SIM800L.
  SerialAT.begin(9600, SERIAL_8N1, PIN_SIM_RX, PIN_SIM_TX);
  delay(3000);

  gsmConnect();                            // best-effort; loop() will recover
}

void loop() {
  unsigned long now = millis();
  if (now - lastSend < SEND_INTERVAL_MS && lastSend != 0) return;
  lastSend = now;

  Reading r = takeReading();

  // Human-readable debug dump.
  SerialMon.println(F("---- Reading ----"));
  SerialMon.printf("Temp: %.2f C   [%s]\n", r.temperature,  r.status[0]);
  SerialMon.printf("pH  : %.2f     [%s]\n", r.ph,           r.status[1]);
  SerialMon.printf("Turb: %.1f NTU [%s]\n", r.turbidity,    r.status[2]);
  SerialMon.printf("Rain: %.0f %%  [%s]\n", r.rain,         r.status[3]);
  SerialMon.printf("TDS : %.0f ppm [%s]\n", r.conductivity, r.status[4]);
  SerialMon.printf("Overall: %s | Signal: %d%%\n", r.overall, r.signalPct);

  String json = buildJson(r);
  SerialMon.print(F("[JSON] ")); SerialMon.println(json);

  bool sent = postReading(json);
  SerialMon.println(sent ? F("[HTTP] Upload OK") : F("[HTTP] Upload FAILED"));

  maybeSendSms(r);                          // immediate danger SMS
}
