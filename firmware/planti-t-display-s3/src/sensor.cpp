#include "sensor.h"

#include <Adafruit_seesaw.h>
#include <Wire.h>

#include "config.h"

namespace planti {

float rawToPercent(uint16_t raw) {
  const float span = float(SOIL_WET_RAW) - float(SOIL_DRY_RAW);
  if (span <= 0) return NAN;
  float pct = (float(raw) - float(SOIL_DRY_RAW)) / span * 100.0f;
  return constrain(pct, 0.0f, 100.0f);
}

namespace {

class SeesawSoilSensor : public SoilSensor {
 public:
  bool begin() override {
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    ok_ = ss_.begin(SOIL_SENSOR_ADDRESS);
    if (ok_) {
      Serial.printf("[sensor] seesaw found at 0x%02X, version %08lX\n", SOIL_SENSOR_ADDRESS, (unsigned long)ss_.getVersion());
    } else {
      Serial.printf("[sensor] seesaw NOT found at 0x%02X (check 3V3, GND, SDA=%d, SCL=%d)\n", SOIL_SENSOR_ADDRESS, PIN_I2C_SDA, PIN_I2C_SCL);
    }
    return ok_;
  }

  SoilReading read() override {
    SoilReading r;
    if (!ok_ && !begin()) return r;  // retry detection, e.g. after re-plugging
    // Average a few samples: single capacitive reads jitter.
    uint32_t sum = 0;
    int n = 0;
    for (int i = 0; i < 5; i++) {
      uint16_t v = ss_.touchRead(0);
      if (v != 65535) {  // 65535 signals a failed read
        sum += v;
        n++;
      }
      delay(10);
    }
    if (n == 0) {
      ok_ = false;
      return r;
    }
    r.raw = uint16_t(sum / n);
    r.percent = rawToPercent(r.raw);
    r.temperatureC = ss_.getTemp();
    r.valid = true;
    return r;
  }

  const char* name() const override { return "adafruit-4026"; }
  bool simulated() const override { return false; }

 private:
  Adafruit_seesaw ss_;
  bool ok_ = false;
};

class BenchSensor : public SoilSensor {
 public:
  bool begin() override {
    Serial.println("[sensor] BENCH MODE: values are SIMULATED and will not be uploaded");
    return true;
  }
  SoilReading read() override {
    // Slow drying sine wave so the display visibly changes.
    const float t = millis() / 60000.0f;
    SoilReading r;
    r.raw = uint16_t(560 + 120 * sinf(t / 7.0f));
    r.percent = rawToPercent(r.raw);
    r.temperatureC = 22.0f + sinf(t / 30.0f);
    r.valid = true;
    r.simulated = true;
    return r;
  }
  const char* name() const override { return "bench-simulated"; }
  bool simulated() const override { return true; }
};

}  // namespace

SoilSensor* createSeesawSensor() { return new SeesawSoilSensor(); }
SoilSensor* createBenchSensor() { return new BenchSensor(); }

}  // namespace planti
