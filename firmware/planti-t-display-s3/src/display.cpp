#include "display.h"

#include <Arduino_GFX_Library.h>

#include "config.h"

namespace planti {

namespace {

// Planti brand colors in RGB565.
constexpr uint16_t rgb565(uint8_t r, uint8_t g, uint8_t b) { return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3); }
constexpr uint16_t COLOR_DEEP = rgb565(0x12, 0x26, 0x1C);
constexpr uint16_t COLOR_FOREST = rgb565(0x1F, 0x4D, 0x3A);
constexpr uint16_t COLOR_NEON = rgb565(0xB6, 0xF2, 0x3A);
constexpr uint16_t COLOR_IVORY = rgb565(0xF8, 0xFA, 0xF5);
constexpr uint16_t COLOR_SAGE = rgb565(0xA9, 0xC4, 0xB4);
constexpr uint16_t COLOR_AMBER = rgb565(0xF0, 0xB4, 0x3C);
constexpr uint16_t COLOR_CLAY = rgb565(0xE0, 0x7A, 0x55);

#if PLANTI_BOARD_AMOLED
// RM67162 AMOLED over QSPI, as in Arduino_GFX's LILYGO_T_Display_S3_AMOLED config.
Arduino_DataBus* bus = new Arduino_ESP32QSPI(PIN_LCD_CS, PIN_LCD_SCK, PIN_LCD_D0, PIN_LCD_D1, PIN_LCD_D2, PIN_LCD_D3);
Arduino_GFX* panel = new Arduino_RM67162(bus, PIN_LCD_RST, 1 /* landscape */);
#else
// Bus and panel exactly as in LILYGO's Arduino_GFXDemo for this board.
Arduino_DataBus* bus = new Arduino_ESP32PAR8Q(PIN_LCD_DC, PIN_LCD_CS, PIN_LCD_WR, PIN_LCD_RD, PIN_LCD_D0, PIN_LCD_D1,
                                              PIN_LCD_D2, PIN_LCD_D3, PIN_LCD_D4, PIN_LCD_D5, PIN_LCD_D6, PIN_LCD_D7);
Arduino_GFX* panel = new Arduino_ST7789(bus, PIN_LCD_RST, 1 /* landscape */, true /* IPS */, 170, 320, 35, 0, 35, 0);
#endif
// Draw into a PSRAM framebuffer and push whole frames: no flicker.
Arduino_Canvas* canvas = new Arduino_Canvas(SCREEN_W, SCREEN_H, panel);

// The layout is designed on the LCD's 320x170 grid and scaled to the screen.
int16_t sx(int16_t x) { return (int32_t)x * SCREEN_W / 320; }
int16_t sy(int16_t y) { return (int32_t)y * SCREEN_H / 170; }
// Small text doubles on the dense AMOLED; larger text scales with the height.
uint8_t ts(uint8_t size) {
  if (SCREEN_W == 320) return size;
  return size == 1 ? 2 : (uint8_t)(size * SCREEN_H / 170.0f + 0.5f);
}
int16_t textWidth(const char* text, uint8_t size) { return strlen(text) * 6 * ts(size); }

// x, y and size are in layout units
void label(int16_t x, int16_t y, const char* text, uint16_t color, uint8_t size = 1) {
  canvas->setTextColor(color);
  canvas->setTextSize(ts(size));
  canvas->setCursor(sx(x), sy(y));
  canvas->print(text);
}

// Right-aligned to the screen's right margin, optionally on a filled pill
void labelRight(int16_t y, const char* text, uint16_t color, uint16_t pill = 0) {
  const int16_t pad = pill ? sx(8) : 0;
  const int16_t w = textWidth(text, 1) + 2 * pad;
  const int16_t x = SCREEN_W - sx(8) - w;
  if (pill) canvas->fillRoundRect(x, sy(y) - sy(6), w, sy(6) * 2 + 8 * ts(1), sx(4), pill);
  canvas->setTextColor(color);
  canvas->setTextSize(ts(1));
  canvas->setCursor(x + pad, sy(y));
  canvas->print(text);
}

void formatAgo(uint32_t ms, char* out, size_t len) {
  const uint32_t s = ms / 1000;
  if (s < 60) snprintf(out, len, "%lus ago", (unsigned long)s);
  else if (s < 3600) snprintf(out, len, "%lum ago", (unsigned long)(s / 60));
  else snprintf(out, len, "%luh ago", (unsigned long)(s / 3600));
}

}  // namespace

bool Display::begin() {
  if (PIN_LCD_BL >= 0) {
    pinMode(PIN_LCD_BL, OUTPUT);
    digitalWrite(PIN_LCD_BL, HIGH);
  }
  if (!canvas->begin()) {
    Serial.println("[display] framebuffer allocation failed");
    return false;
  }
  canvas->fillScreen(COLOR_DEEP);
  label(16, 70, "planti", COLOR_NEON, 4);
  label(16, 112, "LESS GUESSING. MORE GROWING.", COLOR_SAGE, 1);
  canvas->flush();
  return true;
}

void Display::render(const DisplayState& s) {
  char buf[48];
  canvas->fillScreen(COLOR_DEEP);

  // Header: wordmark and mode
  label(12, 10, "planti", COLOR_NEON, 2);
  if (s.bench) labelRight(12, "BENCH: SIMULATED", COLOR_DEEP, COLOR_AMBER);
  else labelRight(12, "LIVE DEVICE", COLOR_SAGE);
  canvas->drawFastHLine(sx(12), sy(32), sx(296), COLOR_FOREST);

  // Soil moisture
  label(12, 44, "SOIL MOISTURE", COLOR_SAGE, 1);
  if (!s.sensorOk) {
    label(12, 62, "Sensor not found", COLOR_CLAY, 2);
    snprintf(buf, sizeof(buf), "Check 3V3, GND, SDA %d, SCL %d", PIN_I2C_SDA, PIN_I2C_SCL);
    label(12, 86, buf, COLOR_SAGE, 1);
  } else if (s.reading.valid) {
    snprintf(buf, sizeof(buf), "%.0f%%", s.reading.percent);
    label(12, 58, buf, COLOR_IVORY, 5);
    snprintf(buf, sizeof(buf), "raw %u%s", s.reading.raw, SOIL_CALIBRATED ? "" : " (uncalibrated)");
    label(12, 102, buf, COLOR_SAGE, 1);
  } else {
    label(12, 62, "Reading...", COLOR_IVORY, 2);
  }

  // Temperature
  label(212, 44, "TEMP", COLOR_SAGE, 1);
  if (s.reading.valid && !isnan(s.reading.temperatureC)) {
    snprintf(buf, sizeof(buf), "%.1fC", s.reading.temperatureC);
    label(212, 58, buf, COLOR_IVORY, 2);
    label(212, 80, "sensor chip", COLOR_SAGE, 1);
    label(212, 92, "+/- a few C", COLOR_SAGE, 1);
  } else {
    label(212, 58, "--", COLOR_IVORY, 2);
  }

  // Status bar: Wi-Fi and last upload
  canvas->drawFastHLine(sx(12), sy(128), sx(296), COLOR_FOREST);
  const uint16_t wifiColor = s.net.wifiConnected ? COLOR_NEON : COLOR_CLAY;
  canvas->fillCircle(sx(18), sy(147), 4 * ts(1), wifiColor);
  if (s.net.wifiConnected) snprintf(buf, sizeof(buf), "Wi-Fi %ddBm", s.net.rssi);
  else snprintf(buf, sizeof(buf), "Wi-Fi offline");
  label(28, 143, buf, COLOR_IVORY, 1);

  if (s.bench) {
    label(150, 143, "not uploading (bench)", COLOR_AMBER, 1);
  } else if (s.net.credentialRejected) {
    label(150, 143, "credential rejected", COLOR_CLAY, 1);
  } else if (s.net.lastUploadOkMs) {
    char ago[16];
    formatAgo(millis() - s.net.lastUploadOkMs, ago, sizeof(ago));
    snprintf(buf, sizeof(buf), "uploaded %s", ago);
    label(150, 143, buf, COLOR_NEON, 1);
  } else {
    label(150, 143, "no upload yet", COLOR_SAGE, 1);
  }
  if (s.net.pending > 0 && !s.bench) {
    snprintf(buf, sizeof(buf), "%u queued", (unsigned)s.net.pending);
    label(150, 157, buf, COLOR_AMBER, 1);
  }
  if (!s.net.timeSynced && s.net.wifiConnected) label(28, 157, "syncing clock", COLOR_SAGE, 1);

  canvas->flush();
}

}  // namespace planti
