# Planti firmware: LILYGO T-Display-S3 + Adafruit STEMMA Soil Sensor

Reads soil moisture and the sensor chip's temperature once a minute. It shows them on the
T-Display-S3 screen and uploads them to Planti's `POST /api/telemetry` with a per-device
credential.

> **Status:** compiles for both environments (`device`, `bench`) with PlatformIO, and the server
> path has been tested end to end with the exact JSON this firmware sends. **It has not yet been
> tested with the physical board and sensor.** Treat sensor support as unverified until the
> hardware test below passes.

## Hardware

| Part | Notes |
| --- | --- |
| LILYGO T-Display-S3 (ESP32-S3, 1.9" 170×320 ST7789) | Touch and non-touch variants share these pins |
| Adafruit STEMMA Soil Sensor, product 4026 | seesaw chip, I2C address `0x36`, 3–5 V, 10K pull-ups to VIN |
| Adafruit JST PH 4-pin to male header cable, product 3955 | |

### Wiring

Power the sensor from **3V3**, not 5V. Its I2C pull-ups go to VIN, and the ESP32-S3's pins are
not 5 V tolerant.

| Cable wire | Signal | T-Display-S3 pin |
| --- | --- | --- |
| Black | GND | GND |
| Red | V+ | 3V3 |
| White | SDA | GPIO 18 |
| Green | SCL | GPIO 17 |

Sources: GPIO 17/18 are the I2C pins in LILYGO's `examples/factory/pin_config.h`. On the Touch
variant the touch controller shares this bus at a different address. Wire colors are from
Adafruit's product page for cable 3955. GPIO 43/44 (the small JST-SH connector) are the
UART0 pins and are not used here.

## Setup

1. **Pair the device in Planti.** Open the plant's page → *Devices* → *Pair a device*. Copy the
   **Device ID** and **credential**; the credential is shown only once.
2. **Create `include/secrets.h`** from `include/secrets.example.h`. Git ignores this file, so it is
   never committed. Fill in Wi-Fi, `PLANTI_BASE_URL`, the device ID and the credential.
   - Deployed app: `https://…`. The certificate is checked against ISRG Root X1 in
     `include/root_ca.h` (Let's Encrypt, used by Vercel). Replace it if your host uses another CA.
   - Local development: `http://<your-computer's-LAN-IP>:3000`, with the board on the same Wi-Fi.
3. **Install PlatformIO** (VS Code extension, or `pip install platformio`).
4. **Flash and watch the log:**
   ```bash
   cd firmware/planti-t-display-s3
   pio run -e device -t upload
   pio device monitor
   ```
   If upload fails, hold **BOOT**, tap **RST**, release **BOOT**, and retry.

Versions are pinned to what LILYGO tests: `espressif32@6.5.0` (arduino-esp32 2.0.14) and
GFX Library for Arduino 1.4.2. The board definition in `boards/` comes from LILYGO's repository (MIT).

## Bench mode (no sensor)

```bash
pio run -e bench -t upload
```

This shows deterministic values labeled **BENCH: SIMULATED** in amber on the screen, so you can
test the display and Wi-Fi. Bench readings are **never uploaded**: the firmware refuses to queue
them, and the server rejects simulated data on the hardware endpoint with `422`.

## Calibration

The sensor reports a capacitive value (`touchRead(0)`). Adafruit documents roughly **300–500 in
soil**, depending on how packed it is. The default calibration (dry = 300, wet = 1000) is only a
starting point.

1. Insert the sensor in your plant's soil while it is dry, and note `raw` on the screen or serial log.
2. Water thoroughly, wait a few minutes, and note `raw` again.
3. Set `SOIL_DRY_RAW`, `SOIL_WET_RAW` and `SOIL_CALIBRATED = true` in `include/config.h`, then reflash.

The percentage Planti stores is an **estimate between those two points**, not an absolute water
content. Every reading records which calibration was used (`metadata.calibration`, `calibrationDryRaw`,
`calibrationWetRaw`). The device always sends `soilMoistureStatus: "unknown"`, because judging
what a plant needs is not the sensor's job.

## Behavior

- **Sensing:** one reading per minute, averaged over 5 samples. Press **KEY** (GPIO 14) to read now.
- **Time:** NTP sync over Wi-Fi, readings timestamped in UTC. Until the clock syncs, the
  server stamps receipt time, and only the newest unsynced reading is kept.
- **Offline:** up to 48 readings are buffered in RAM and uploaded in batches of 20 on reconnect.
  Retries back off 5 s → 10 s → … → 5 min.
- **Errors:** `401` stops uploads and shows *credential rejected* (pair again). `400/413/422` drops
  the batch instead of retrying forever. `429/5xx`/network errors retry with backoff.
- **Screen:** Planti wordmark, LIVE DEVICE or BENCH label, moisture %, raw value, temperature,
  Wi-Fi status and signal, time since the last successful upload, and the queue size.
- **Logs:** the serial log never prints the credential or Wi-Fi password.

## Hardware test checklist

- [ ] Serial log shows `seesaw found at 0x36`.
- [ ] `raw` rises when you squeeze the sensor or put it in wetter soil.
- [ ] Screen shows Wi-Fi connected and *uploaded Ns ago*.
- [ ] Planti dashboard shows **LIVE DEVICE**, *Receiving readings*, and the new reading.
- [ ] Unplug Wi-Fi: readings queue; restore: the queue uploads and the chart has no gap.
- [ ] Watering the plant shows a rise in the chart, and the logged watering's outcome updates.
