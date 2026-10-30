// Hardware and behavior configuration. Two boards are supported, chosen at
// build time (see platformio.ini):
//   PLANTI_BOARD_AMOLED=1  LILYGO T-Display-S3 AMOLED 1.91" (RM67162, QSPI, 536x240).
//                          Pins from LILYGO's T-Display-S3-AMOLED examples/factory/pins_config.h.
//   otherwise              LILYGO T-Display-S3 (ST7789, 8-bit parallel, 320x170).
//                          Pins from LILYGO's T-Display-S3 examples/factory/pin_config.h.
// Sensor pins follow Adafruit's 4026 guide and cable 3955 (white = SDA, green = SCL).
#pragma once
#include <stdint.h>

#ifndef PLANTI_BOARD_AMOLED
#define PLANTI_BOARD_AMOLED 0
#endif

namespace planti {

#if PLANTI_BOARD_AMOLED

constexpr const char* BOARD_NAME = "T-Display-S3 AMOLED";
constexpr int PIN_POWER_ON = -1;  // no peripheral power switch on this board
constexpr int PIN_LCD_BL = 38;    // AMOLED: panel power enable (screen stays black while LOW)
constexpr int PIN_BUTTON_1 = 0;   // BOOT button
constexpr int PIN_BUTTON_2 = 21;  // KEY button

// AMOLED: RM67162 over QSPI, 240x536 (drawn in landscape, 536x240)
constexpr int PIN_LCD_CS = 6, PIN_LCD_SCK = 47, PIN_LCD_RST = 17;
constexpr int PIN_LCD_D0 = 18, PIN_LCD_D1 = 7, PIN_LCD_D2 = 48, PIN_LCD_D3 = 5;
constexpr int SCREEN_W = 536, SCREEN_H = 240;

// I2C on the STEMMA QT / Qwiic port (labeled G 3V3 43 44), also on header pins
// 43 and 44. GPIO 17/18 belong to the display here, so they can't be used.
constexpr int PIN_I2C_SDA = 43;
constexpr int PIN_I2C_SCL = 44;

#else

constexpr const char* BOARD_NAME = "T-Display-S3";
constexpr int PIN_POWER_ON = 15;  // Must be HIGH for the LCD and peripherals on battery.
constexpr int PIN_LCD_BL = 38;
constexpr int PIN_BUTTON_1 = 0;   // BOOT button
constexpr int PIN_BUTTON_2 = 14;  // KEY button

// LCD: 8-bit parallel ST7789, 170x320
constexpr int PIN_LCD_DC = 7, PIN_LCD_CS = 6, PIN_LCD_WR = 8, PIN_LCD_RD = 9, PIN_LCD_RST = 5;
constexpr int PIN_LCD_D0 = 39, PIN_LCD_D1 = 40, PIN_LCD_D2 = 41, PIN_LCD_D3 = 42;
constexpr int PIN_LCD_D4 = 45, PIN_LCD_D5 = 46, PIN_LCD_D6 = 47, PIN_LCD_D7 = 48;
constexpr int SCREEN_W = 320, SCREEN_H = 170;

// I2C on the header (shared with the touch controller on the Touch variant).
constexpr int PIN_I2C_SDA = 18;
constexpr int PIN_I2C_SCL = 17;

#endif

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
