// Sensor acquisition, separated from networking and display.
#pragma once
#include <Arduino.h>

namespace planti {

struct SoilReading {
  bool valid = false;
  uint16_t raw = 0;              // seesaw capacitive value
  float percent = NAN;           // estimate between calibration points
  float temperatureC = NAN;      // seesaw chip temperature, within a few °C
  bool simulated = false;        // true only in bench mode
};

class SoilSensor {
 public:
  virtual ~SoilSensor() = default;
  virtual bool begin() = 0;
  virtual SoilReading read() = 0;
  virtual const char* name() const = 0;
  virtual bool simulated() const = 0;
};

// Adafruit STEMMA Soil Sensor (4026) over I2C.
SoilSensor* createSeesawSensor();
// Bench mode: deterministic simulated values, never uploaded.
SoilSensor* createBenchSensor();

float rawToPercent(uint16_t raw);

}  // namespace planti
