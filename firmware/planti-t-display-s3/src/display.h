// On-device screen, separated from sensing and networking.
#pragma once
#include <Arduino.h>

#include "sensor.h"
#include "telemetry.h"

namespace planti {

struct DisplayState {
  SoilReading reading;
  bool sensorOk = false;
  bool bench = false;
  TelemetryStatus net;
};

class Display {
 public:
  bool begin();
  void render(const DisplayState& state);
};

}  // namespace planti
