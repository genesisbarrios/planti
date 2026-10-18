// Wi-Fi, time sync and telemetry upload, separated from sensing and display.
#pragma once
#include <Arduino.h>

#include "sensor.h"

namespace planti {

struct TelemetryStatus {
  bool wifiConnected = false;
  bool timeSynced = false;
  bool credentialRejected = false;  // server said 401: re-provision the device
  uint32_t lastUploadOkMs = 0;      // millis() of last successful upload, 0 = never
  size_t pending = 0;               // readings waiting in the buffer
  int lastHttpStatus = 0;
  int8_t rssi = 0;
};

class Telemetry {
 public:
  void begin();
  // Call often; non-blocking except during an actual upload.
  void loop();
  // Queues a measured reading for upload. Simulated readings are refused.
  void enqueue(const SoilReading& reading, const char* sensorName);
  const TelemetryStatus& status() const { return status_; }

 private:
  struct Queued {
    time_t epoch;  // 0 when the clock was not synced
    uint16_t raw;
    float percent;
    float temperatureC;
    int8_t rssi;
    uint32_t uptimeSeconds;
  };

  void ensureWifi();
  bool upload();
  void dropFront(size_t n);

  Queued buffer_[48];
  size_t count_ = 0;
  const char* sensorName_ = "unknown";
  TelemetryStatus status_;
  uint32_t lastWifiAttemptMs_ = 0;
  uint32_t nextUploadMs_ = 0;
  uint32_t backoffMs_ = 0;
  bool timeConfigured_ = false;
};

}  // namespace planti
