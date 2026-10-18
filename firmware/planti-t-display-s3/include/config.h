// Hardware and behavior configuration. Pins verified against LILYGO's
// T-Display-S3 pin_config.h (examples/factory) and Adafruit's 4026 guide.
#pragma once
#include <stdint.h>

namespace planti {

// Board
constexpr int PIN_POWER_ON = 15;  // Must be HIGH for the LCD and peripherals on battery.
constexpr int PIN_LCD_BL = 38;
constexpr int PIN_BUTTON_1 = 0;   // BOOT button
constexpr int PIN_BUTTON_2 = 14;

// LCD: 8-bit parallel ST7789, 170x320
constexpr int PIN_LCD_DC = 7, PIN_LCD_CS = 6, PIN_LCD_WR = 8, PIN_LCD_RD = 9, PIN_LCD_RST = 5;
constexpr int PIN_LCD_D0 = 39, PIN_LCD_D1 = 40, PIN_LCD_D2 = 41, PIN_LCD_D3 = 42;
constexpr int PIN_LCD_D4 = 45, PIN_LCD_D5 = 46, PIN_LCD_D6 = 47, PIN_LCD_D7 = 48;

// I2C on the header (shared with the touch controller on the Touch variant).
// Adafruit cable: white = SDA, green = SCL, red = 3V3, black = GND.
constexpr int PIN_I2C_SDA = 18;
constexpr int PIN_I2C_SCL = 17;
constexpr uint8_t SOIL_SENSOR_ADDRESS = 0x36;  // 0x36–0x39 via AD0/AD1 jumpers

// Capacitive calibration (seesaw touchRead(0)). Adafruit documents roughly
// 300–500 in soil, depending on how packed it is. Calibrate for your pot:
// note the value in dry soil and right after a thorough watering, then set
// these and SOIL_CALIBRATED to true. The percentage is an estimate between
// these two points, not an absolute water content.
constexpr uint16_t SOIL_DRY_RAW = 300;
constexpr uint16_t SOIL_WET_RAW = 1000;
constexpr bool SOIL_CALIBRATED = false;

// Timing
constexpr uint32_t READ_INTERVAL_MS = 60UL * 1000UL;        // one reading per minute
constexpr uint32_t DISPLAY_REFRESH_MS = 1000UL;
constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 20UL * 1000UL;
constexpr uint32_t HTTP_TIMEOUT_MS = 10UL * 1000UL;
constexpr uint32_t BACKOFF_MIN_MS = 5UL * 1000UL;
constexpr uint32_t BACKOFF_MAX_MS = 5UL * 60UL * 1000UL;

// Readings kept in RAM while offline, uploaded as a batch on reconnect.
constexpr size_t BUFFER_CAPACITY = 48;
constexpr size_t MAX_BATCH = 20;

}  // namespace planti
