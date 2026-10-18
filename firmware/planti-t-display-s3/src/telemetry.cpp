#include "telemetry.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>

#include "config.h"
#include "root_ca.h"
#include "secrets.h"

namespace planti {

static_assert(sizeof(PLANTI_DEVICE_CREDENTIAL) > 20, "Set PLANTI_DEVICE_CREDENTIAL in include/secrets.h");

namespace {
constexpr time_t EPOCH_2024 = 1704067200;  // anything earlier means "not synced"
constexpr uint32_t WIFI_RETRY_MS = 15000;

void formatIso(time_t epoch, char* out, size_t len) {
  struct tm t;
  gmtime_r(&epoch, &t);
  strftime(out, len, "%Y-%m-%dT%H:%M:%SZ", &t);
}
}  // namespace

void Telemetry::begin() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  ensureWifi();
}

void Telemetry::ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  const uint32_t now = millis();
  if (lastWifiAttemptMs_ != 0 && now - lastWifiAttemptMs_ < WIFI_RETRY_MS) return;
  lastWifiAttemptMs_ = now;
  Serial.printf("[wifi] connecting to \"%s\"\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void Telemetry::loop() {
  ensureWifi();
  status_.wifiConnected = WiFi.status() == WL_CONNECTED;
  status_.rssi = status_.wifiConnected ? int8_t(WiFi.RSSI()) : 0;

  if (status_.wifiConnected && !timeConfigured_) {
    // UTC; the server stores UTC and the app renders local time.
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    timeConfigured_ = true;
    Serial.printf("[wifi] connected, IP %s\n", WiFi.localIP().toString().c_str());
  }
  status_.timeSynced = time(nullptr) > EPOCH_2024;
  status_.pending = count_;

  if (!status_.wifiConnected || count_ == 0 || status_.credentialRejected) return;
  if (millis() < nextUploadMs_) return;

  if (upload()) {
    backoffMs_ = 0;
    nextUploadMs_ = 0;
  } else {
    // Bounded exponential backoff: 5 s, 10 s, 20 s … capped at 5 min.
    backoffMs_ = backoffMs_ == 0 ? BACKOFF_MIN_MS : min(backoffMs_ * 2, BACKOFF_MAX_MS);
    nextUploadMs_ = millis() + backoffMs_;
    Serial.printf("[upload] will retry in %lu s (%u queued)\n", (unsigned long)(backoffMs_ / 1000), (unsigned)count_);
  }
  status_.pending = count_;
}

void Telemetry::enqueue(const SoilReading& reading, const char* sensorName) {
  if (!reading.valid || reading.simulated) return;  // never upload simulated values
  sensorName_ = sensorName;

  const time_t now = time(nullptr);
  const bool synced = now > EPOCH_2024;
  if (!synced) {
    // Without a clock the server stamps receipt time, so several queued
    // unsynced readings would collide; keep only the newest one.
    size_t kept = 0;
    for (size_t i = 0; i < count_; i++)
      if (buffer_[i].epoch != 0) buffer_[kept++] = buffer_[i];
    count_ = kept;
  }
  if (count_ == BUFFER_CAPACITY) dropFront(1);  // oldest reading goes first

  buffer_[count_++] = Queued{synced ? now : 0, reading.raw, reading.percent, reading.temperatureC,
                             status_.rssi, uint32_t(millis() / 1000)};
  status_.pending = count_;
}

void Telemetry::dropFront(size_t n) {
  n = min(n, count_);
  for (size_t i = n; i < count_; i++) buffer_[i - n] = buffer_[i];
  count_ -= n;
}

bool Telemetry::upload() {
  const size_t batch = min(count_, MAX_BATCH);
  JsonDocument doc;
  doc["deviceId"] = PLANTI_DEVICE_ID;
  doc["firmwareVersion"] = PLANTI_FIRMWARE_VERSION;
  JsonArray readings = doc["readings"].to<JsonArray>();
  char iso[25];
  for (size_t i = 0; i < batch; i++) {
    const Queued& q = buffer_[i];
    JsonObject r = readings.add<JsonObject>();
    if (q.epoch != 0) {
      formatIso(q.epoch, iso, sizeof(iso));
      r["recordedAt"] = iso;
    }
    r["soilMoistureRaw"] = q.raw;
    if (!isnan(q.percent)) r["soilMoisturePercent"] = roundf(q.percent * 10) / 10;
    if (!isnan(q.temperatureC)) r["temperatureC"] = roundf(q.temperatureC * 10) / 10;
    r["soilMoistureStatus"] = "unknown";  // the device does not judge plant needs
    r["source"] = "device";
    JsonObject meta = r["metadata"].to<JsonObject>();
    meta["sensor"] = sensorName_;
    meta["calibration"] = SOIL_CALIBRATED ? "custom" : "default";
    meta["calibrationDryRaw"] = SOIL_DRY_RAW;
    meta["calibrationWetRaw"] = SOIL_WET_RAW;
    if (q.rssi != 0) meta["rssi"] = q.rssi;
    meta["uptimeSeconds"] = q.uptimeSeconds;
  }
  String body;
  serializeJson(doc, body);

  const String url = String(PLANTI_BASE_URL) + "/api/telemetry";
  const bool https = url.startsWith("https://");
  WiFiClientSecure secure;
  WiFiClient plain;
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (https) {
#if PLANTI_ALLOW_INSECURE_TLS
    secure.setInsecure();
    Serial.println("[upload] WARNING: TLS certificate checks disabled (development only)");
#else
    secure.setCACert(PLANTI_ROOT_CA);
#endif
    if (!http.begin(secure, url)) return false;
  } else {
    if (!http.begin(plain, url)) return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + PLANTI_DEVICE_CREDENTIAL);  // never logged

  const int code = http.POST(body);
  status_.lastHttpStatus = code;
  const String response = code > 0 ? http.getString() : String();
  http.end();

  if (code == 201) {
    Serial.printf("[upload] %u reading(s) sent: %s\n", (unsigned)batch, response.c_str());
    dropFront(batch);
    status_.lastUploadOkMs = millis();
    return true;
  }
  if (code == 401) {
    Serial.println("[upload] 401: device credential rejected. Pair the device again in Planti and update secrets.h.");
    status_.credentialRejected = true;
    return false;
  }
  if (code == 400 || code == 413 || code == 422) {
    // The server will never accept this batch; drop it instead of retrying forever.
    Serial.printf("[upload] %d: batch rejected (%s), dropping %u reading(s)\n", code, response.c_str(), (unsigned)batch);
    dropFront(batch);
    return true;
  }
  Serial.printf("[upload] failed: %s\n", code > 0 ? String(code).c_str() : http.errorToString(code).c_str());
  return false;
}

}  // namespace planti
