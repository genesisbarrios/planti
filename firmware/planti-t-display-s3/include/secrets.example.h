// Copy to include/secrets.h (git-ignored) and fill in. Never commit secrets.h.
#pragma once

#define WIFI_SSID "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"

// Base URL of the Planti app, without a trailing slash.
//   Deployed: "https://your-planti.vercel.app"
//   Local dev on the same Wi-Fi: "http://192.168.1.20:3000" (your computer's LAN IP)
#define PLANTI_BASE_URL "https://your-planti.vercel.app"

// From the plant's page in Planti → Devices → Pair a device (shown once).
#define PLANTI_DEVICE_ID "00000000-0000-0000-0000-000000000000"
#define PLANTI_DEVICE_CREDENTIAL "planti_dev_..."

// Development only: skip TLS certificate checks for HTTPS. Leave at 0.
#define PLANTI_ALLOW_INSECURE_TLS 0
