/*
 * ============================================================================
 * FishSafe - ESP32 + SIM800L + Railway HTTPS Firmware
 * Complete Sensor Telemetry & SMS Alert Code
 * ============================================================================
 */

#define TINY_GSM_MODEM_SIM800
#define TINY_GSM_RX_BUFFER 1024

#define SerialMon Serial
#define SerialAT  Serial2

#include <TinyGsmClient.h>
#include <ArduinoHttpClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ============================================================================
// 1. MODEM & CLIENTS
// ============================================================================

TinyGsm modem(SerialAT);

// SIM800L's built-in SSL only speaks TLS 1.0, and Railway requires TLS 1.2+,
// so a direct HTTPS connection from the SIM800L to Railway always fails.
// Leave USE_TLS = 0 and point API_HOST at a plain-HTTP relay (e.g. a
// Cloudflare-proxied domain with "Always Use HTTPS" OFF) that forwards to Railway.
// Only set USE_TLS = 1 with a modem that supports TLS 1.2 (SIM7600, A7670...).
#define USE_TLS 0

#if USE_TLS
TinyGsmClientSecure gsmClient(modem);
#else
TinyGsmClient gsmClient(modem);
#endif

// ============================================================================
// 2. RAILWAY BACKEND CONFIGURATION
// ============================================================================

// Do NOT include "https://" or trailing slashes "/"
const char* API_HOST = "fishsafebackend-production.up.railway.app"; // replace with your HTTP relay host when USE_TLS = 0
const int   API_PORT = USE_TLS ? 443 : 80;
const char* API_PATH = "/api/sensors/data";

// Must match your backend's DEVICE_API_KEY environment variable
const char* API_KEY   = "YOUR_DEVICE_API_KEY_HERE";
const char* DEVICE_ID = "FISHSAFE-001";

// ============================================================================
// 3. GSM / GPRS / SMS CONFIGURATION
// ============================================================================

const char* APN         = "dialogbb"; // Network APN
const char* GPRS_USER   = "";
const char* GPRS_PASS   = "";
const char* SIM_PIN     = "";

// SMS Alert Recipient
const char* ALERT_PHONE = "+94769767326";

// ============================================================================
// 4. TIMING & RETRIES
// ============================================================================

const unsigned long SEND_INTERVAL_MS = 60UL * 1000UL;      // Upload every 60 seconds
const unsigned long SMS_COOLDOWN_MS  = 15UL * 60UL * 1000UL; // 15 min SMS cooldown
const int           MAX_HTTP_RETRIES = 3;

// ============================================================================
// 5. PIN DEFINITIONS
// ============================================================================

#define PIN_DS18B20 4
#define PIN_PH      34
#define PIN_TURB    35
#define PIN_TDS     32
#define PIN_RAIN    33

// SIM800L Hardware Serial Pins
// ESP32 TX2 (GPIO17) -> SIM800L RX
// ESP32 RX2 (GPIO16) <- SIM800L TX
#define PIN_SIM_TX  17
#define PIN_SIM_RX  16

// ============================================================================
// 6. SENSOR OBJECTS & VARIABLES
// ============================================================================

OneWire oneWire(PIN_DS18B20);
DallasTemperature ds18b20(&oneWire);

unsigned long lastSend = 0;
unsigned long lastSmsAt[5] = {0, 0, 0, 0, 0};

const char* SENSOR_NAMES[5] = {
  "temperature",
  "ph",
  "turbidity",
  "rain",
  "conductivity"
};

// Calibration Constants
const int   ADC_SAMPLES   = 20;
float       PH_V7         = 1.65;
float       PH_V4         = 2.02;
float       TURB_V_CLEAR  = 4.10;
float       TDS_TEMP_C    = 25.0;
int         RAIN_MV_DRY   = 3100;
int         RAIN_MV_WET   = 700;

const float DIVIDER_PH    = 0.667;
const float DIVIDER_TURB  = 0.667;
const float DIVIDER_TDS   = 1.000;

// ============================================================================
// 7. THRESHOLDS & STRUCTURES
// ============================================================================

struct Range {
  float warnLow;
  float safeLow;
  float safeHigh;
  float warnHigh;
};

Range TH_TEMP = {23.0, 25.0, 32.0, 34.0};
Range TH_PH   = {6.0,  6.5,  8.5,  9.0};
Range TH_TURB = {-1e9, -1e9, 25.0, 40.0};
Range TH_RAIN = {-1e9, -1e9, 50.0, 80.0};
Range TH_TDS  = {50.0, 100.0, 800.0, 1000.0};

struct Reading {
  float temperature;
  float ph;
  float turbidity;
  float rain;
  float conductivity;

  bool ok[5];
  const char* status[5];
  const char* overall;
  int signalPct;
};

// ============================================================================
// 8. HELPER FUNCTIONS
// ============================================================================

float round2(float v) {
  if (isnan(v)) return v;
  return roundf(v * 100.0) / 100.0;
}

float readPinMilliVolts(int pin) {
  long sum = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) {
    sum += analogReadMilliVolts(pin);
    delay(2);
  }
  return (float)sum / ADC_SAMPLES;
}

// ============================================================================
// 9. SENSOR READINGS
// ============================================================================

float readTemperature(bool &ok) {
  ds18b20.requestTemperatures();
  float t = ds18b20.getTempCByIndex(0);
  ok = (t != DEVICE_DISCONNECTED_C && t > -40 && t < 85);
  return ok ? t : NAN;
}

float readPH(bool &ok) {
  float vPin = readPinMilliVolts(PIN_PH) / 1000.0;
  float slope = (4.0 - 7.0) / (PH_V4 - PH_V7);
  float ph = 7.0 + (vPin - PH_V7) * slope;
  ok = (vPin > 0.05 && ph > 0.0 && ph < 14.0);
  return ok ? ph : NAN;
}

float readTurbidity(bool &ok) {
  float vPin = readPinMilliVolts(PIN_TURB) / 1000.0;
  float v = vPin / DIVIDER_TURB;
  float ntu;

  if (v >= TURB_V_CLEAR) {
    ntu = 0.0;
  } else {
    ntu = -1120.4 * v * v + 5742.3 * v - 4353.8;
  }

  if (ntu < 0) ntu = 0;
  if (ntu > 3000) ntu = 3000;

  ok = (vPin > 0.05);
  return ok ? ntu : NAN;
}

float readTDS(bool &ok, float waterTempC) {
  float vPin = readPinMilliVolts(PIN_TDS) / 1000.0;
  float v = vPin / DIVIDER_TDS;
  float comp = 1.0 + 0.02 * (waterTempC - 25.0);
  float vc = v / comp;
  float tds = (133.42 * vc * vc * vc - 255.86 * vc * vc + 857.39 * vc) * 0.5;

  if (tds < 0) tds = 0;

  ok = (vPin > 0.02);
  return ok ? tds : NAN;
}

float readRain(bool &ok) {
  float mv = readPinMilliVolts(PIN_RAIN);
  float pct = (float)(RAIN_MV_DRY - mv) * 100.0 / (float)(RAIN_MV_DRY - RAIN_MV_WET);

  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;

  ok = true;
  return pct;
}

// ============================================================================
// 10. EVALUATION & CLASSIFICATION
// ============================================================================

const char* classify(float v, const Range& r) {
  if (isnan(v)) return "UNKNOWN";
  if (v < r.warnLow || v > r.warnHigh) return "DANGER";
  if (v < r.safeLow || v > r.safeHigh) return "WARNING";
  return "SAFE";
}

const char* worstOf(const char* s[5]) {
  bool danger = false;
  bool warning = false;

  for (int i = 0; i < 5; i++) {
    if (strcmp(s[i], "DANGER") == 0) danger = true;
    if (strcmp(s[i], "WARNING") == 0) warning = true;
  }

  if (danger) return "DANGER";
  if (warning) return "WARNING";
  return "SAFE";
}

Reading takeReading() {
  Reading r;

  r.temperature  = readTemperature(r.ok[0]);
  r.rain         = readRain(r.ok[3]);
  float tForTds  = r.ok[0] ? r.temperature : 25.0;
  r.ph           = readPH(r.ok[1]);
  r.turbidity    = readTurbidity(r.ok[2]);
  r.conductivity = readTDS(r.ok[4], tForTds);

  r.status[0] = r.ok[0] ? classify(r.temperature, TH_TEMP)  : "UNKNOWN";
  r.status[1] = r.ok[1] ? classify(r.ph, TH_PH)             : "UNKNOWN";
  r.status[2] = r.ok[2] ? classify(r.turbidity, TH_TURB)   : "UNKNOWN";
  r.status[3] = r.ok[3] ? classify(r.rain, TH_RAIN)         : "UNKNOWN";
  r.status[4] = r.ok[4] ? classify(r.conductivity, TH_TDS) : "UNKNOWN";

  r.overall = worstOf(r.status);

  int csq = modem.getSignalQuality();
  if (csq == 99 || csq < 0) {
    r.signalPct = 0;
  } else {
    r.signalPct = (int)((csq / 31.0) * 100.0);
  }

  return r;
}

// ============================================================================
// 11. JSON BUILDING
// ============================================================================

String buildJson(const Reading& r) {
  StaticJsonDocument<512> doc;

  doc["deviceId"] = DEVICE_ID;

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

// ============================================================================
// 12. GSM / GPRS NETWORK MANAGEMENT
// ============================================================================

bool gsmConnect() {
  SerialMon.println();
  SerialMon.println("[GSM] Initialising modem...");

  if (!modem.restart()) {
    SerialMon.println("[GSM] Modem restart FAILED");
    return false;
  }

  String info = modem.getModemInfo();
  SerialMon.print("[GSM] Modem: ");
  SerialMon.println(info);

  if (strlen(SIM_PIN) && modem.getSimStatus() != 3) {
    modem.simUnlock(SIM_PIN);
  }

  SerialMon.print("[GSM] Waiting for network...");
  if (!modem.waitForNetwork(60000L)) {
    SerialMon.println(" FAIL");
    return false;
  }
  SerialMon.println(" OK");

  SerialMon.print("[GPRS] Connecting APN: ");
  SerialMon.println(APN);

  if (!modem.gprsConnect(APN, GPRS_USER, GPRS_PASS)) {
    SerialMon.println("[GPRS] CONNECTION FAILED");
    return false;
  }

  SerialMon.println("[GPRS] CONNECTED");
  SerialMon.print("[GPRS] IP address: ");
  SerialMon.println(modem.getLocalIP());

  return modem.isGprsConnected();
}

// ============================================================================
// 13. HTTPS CONNECTION TEST
// ============================================================================

bool testHTTPS() {
  SerialMon.println("\n--------------------------------");
  SerialMon.println("[HTTPS] Testing Railway connection");
  SerialMon.println("--------------------------------");

  SerialMon.print("[HTTPS] Server: ");
  SerialMon.println(API_HOST);

  gsmClient.setTimeout(30);

  if (!gsmClient.connect(API_HOST, API_PORT)) {
    SerialMon.println("[HTTPS] CONNECTION FAILED");
    return false;
  }

  SerialMon.println("[HTTPS] CONNECTION SUCCESS");

  gsmClient.println("GET / HTTP/1.1");
  gsmClient.print("Host: ");
  gsmClient.println(API_HOST);
  gsmClient.println("Connection: close");
  gsmClient.println();

  unsigned long start = millis();
  while (gsmClient.connected() && millis() - start < 10000) {
    while (gsmClient.available()) {
      char c = gsmClient.read();
      SerialMon.write(c);
      start = millis();
    }
  }

  gsmClient.stop();
  SerialMon.println("\n[HTTPS] Test finished");
  return true;
}

// ============================================================================
// 14. DATA UPLOAD VIA HTTPS POST
// ============================================================================

bool postReading(const String& json) {
  for (int attempt = 1; attempt <= MAX_HTTP_RETRIES; attempt++) {
    SerialMon.printf("[HTTP] POST attempt %d/%d\n", attempt, MAX_HTTP_RETRIES);

    if (!modem.isGprsConnected()) {
      SerialMon.println("[GPRS] Link down, reconnecting...");
      if (!gsmConnect()) {
        delay(3000);
        continue;
      }
    }

    HttpClient http(gsmClient, API_HOST, API_PORT);
    http.setTimeout(20000);

    SerialMon.println("[HTTPS] Opening connection...");

    http.beginRequest();
    http.post(API_PATH);
    http.sendHeader("Host", API_HOST);
    http.sendHeader("Content-Type", "application/json");
    http.sendHeader("x-api-key", API_KEY);
    http.sendHeader("Content-Length", json.length());
    http.beginBody();
    http.print(json);
    http.endRequest();

    int status  = http.responseStatusCode();
    String body = http.responseBody();
    http.stop();

    if (status == 301 || status == 308) {
      SerialMon.println("[HTTP] Redirected to HTTPS - API_HOST must be a plain-HTTP relay, not Railway directly");
    } else if (status == 401) {
      SerialMon.println("[HTTP] Unauthorized - API_KEY does not match DEVICE_API_KEY on Railway");
    } else if (status < 0) {
      SerialMon.println("[HTTP] No connection/response (TLS, DNS or GPRS problem)");
    }

    SerialMon.printf("[HTTP] status=%d\n", status);
    SerialMon.print("[HTTP] body=");
    SerialMon.println(body);

    if (status >= 200 && status < 300) {
      return true;
    }

    delay(2000L * attempt);
  }

  return false;
}

// ============================================================================
// 15. SMS ALERT ENGINE
// ============================================================================

void maybeSendSms(const Reading& r) {
  for (int i = 0; i < 5; i++) {
    if (strcmp(r.status[i], "DANGER") != 0) continue;

    unsigned long now = millis();
    if (lastSmsAt[i] != 0 && now - lastSmsAt[i] < SMS_COOLDOWN_MS) continue;

    float val;
    if (i == 0)      val = r.temperature;
    else if (i == 1) val = r.ph;
    else if (i == 2) val = r.turbidity;
    else if (i == 3) val = r.rain;
    else             val = r.conductivity;

    char msg[140];
    snprintf(msg, sizeof(msg),
             "FishSafe %s ALERT: %s = %.1f (DANGER). Check pond now.",
             DEVICE_ID, SENSOR_NAMES[i], val);

    SerialMon.print("[SMS] ");
    SerialMon.println(msg);

    if (modem.sendSMS(ALERT_PHONE, String(msg))) {
      lastSmsAt[i] = now;
      SerialMon.println("[SMS] Sent OK");
    } else {
      SerialMon.println("[SMS] Send FAILED");
    }
  }
}

// ============================================================================
// 16. SETUP
// ============================================================================

void setup() {
  SerialMon.begin(115200);
  delay(1000);

  SerialMon.println("\n================================");
  SerialMon.println("FishSafe Firmware Booting");
  SerialMon.println("================================");

  // ADC Configuration
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Initialize sensors & hardware serial
  ds18b20.begin();
  SerialAT.begin(9600, SERIAL_8N1, PIN_SIM_RX, PIN_SIM_TX);
  delay(3000);

  // Connect to GPRS
  if (!gsmConnect()) {
    // Don't stop here: postReading() retries the connection from loop().
    SerialMon.println("\n[GSM] GSM/GPRS FAILED - will retry in loop");
    return;
  }

  SerialMon.println("\n================================");
  SerialMon.println("[GSM] GSM + GPRS READY");
  SerialMon.println("================================");

  // Test HTTPS connection
  testHTTPS();
}

// ============================================================================
// 17. MAIN LOOP
// ============================================================================

void loop() {
  unsigned long now = millis();

  if (lastSend != 0 && now - lastSend < SEND_INTERVAL_MS) {
    delay(100);
    return;
  }

  lastSend = now;

  // Take sensor measurements
  Reading r = takeReading();

  SerialMon.println("\n---- Reading ----");
  SerialMon.printf("Temp: %.2f C   [%s]\n", r.temperature,  r.status[0]);
  SerialMon.printf("pH  : %.2f     [%s]\n", r.ph,           r.status[1]);
  SerialMon.printf("Turb: %.1f NTU [%s]\n", r.turbidity,    r.status[2]);
  SerialMon.printf("Rain: %.0f %%  [%s]\n", r.rain,         r.status[3]);
  SerialMon.printf("TDS : %.0f ppm [%s]\n", r.conductivity, r.status[4]);
  SerialMon.printf("Overall: %s | Signal: %d%%\n", r.overall, r.signalPct);

  // Build JSON payload
  String json = buildJson(r);
  SerialMon.print("[JSON] ");
  SerialMon.println(json);

  // Upload to Railway Backend
  bool sent = postReading(json);
  if (sent) {
    SerialMon.println("[HTTP] Upload OK");
  } else {
    SerialMon.println("[HTTP] Upload FAILED");
  }

  // Check and dispatch SMS alerts if needed
  maybeSendSms(r);
}