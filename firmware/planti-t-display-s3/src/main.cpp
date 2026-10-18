// Planti firmware: reads the soil sensor once a minute, shows the reading on
// the T-Display-S3 screen, and uploads it to Planti's /api/telemetry.
//
// Buttons: KEY (GPIO 14) takes a reading and queues it immediately.

#include <Arduino.h>

#include "config.h"
#include "display.h"
#include "sensor.h"
#include "telemetry.h"

using namespace planti;

namespace {
SoilSensor* sensor = nullptr;
Display display;
Telemetry telemetry;
DisplayState state;
uint32_t lastReadMs = 0;
uint32_t lastDrawMs = 0;
bool firstRead = true;

void takeReading() {
  const SoilReading r = sensor->read();
  state.sensorOk = r.valid;
  if (!r.valid) {
    Serial.println("[sensor] read failed");
    return;
  }
  state.reading = r;
  Serial.printf("[sensor] raw=%u percent=%.1f temp=%.1fC%s\n", r.raw, r.percent, r.temperatureC, r.simulated ? " (SIMULATED)" : "");
  telemetry.enqueue(r, sensor->name());  // refuses simulated readings
}
}  // namespace

void setup() {
  Serial.begin(115200);
  // Required on battery or 5V-pin power; harmless on USB.
  pinMode(PIN_POWER_ON, OUTPUT);
  digitalWrite(PIN_POWER_ON, HIGH);
  pinMode(PIN_BUTTON_2, INPUT_PULLUP);
  delay(200);
  Serial.printf("\nPlanti firmware %s\n", PLANTI_FIRMWARE_VERSION);

  display.begin();

#if PLANTI_BENCH_SENSOR
  sensor = createBenchSensor();
  state.bench = true;
#else
  sensor = createSeesawSensor();
#endif
  state.sensorOk = sensor->begin();
  telemetry.begin();
}

void loop() {
  const uint32_t now = millis();
  telemetry.loop();

  static bool buttonWasDown = false;
  const bool buttonDown = digitalRead(PIN_BUTTON_2) == LOW;
  const bool pressed = buttonDown && !buttonWasDown;
  buttonWasDown = buttonDown;

  if (firstRead || pressed || now - lastReadMs >= READ_INTERVAL_MS) {
    firstRead = false;
    lastReadMs = now;
    takeReading();
  }

  if (now - lastDrawMs >= DISPLAY_REFRESH_MS) {
    lastDrawMs = now;
    state.net = telemetry.status();
    display.render(state);
  }
  delay(20);
}
