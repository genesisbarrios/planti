# Model comparison

Generated 2026-10-18T09:36:33.066Z by `npm run compare:models`. Real inference through Nebius Token Factory on evidence built from the five seeded simulator scenarios (no user data). Sample size is 5 scenarios per configuration, which is too small for statistical claims; this is a smoke-level quality and latency comparison.

| Configuration | Schema-valid | Median latency | Mean completion tokens | Confidence capped |
| --- | --- | --- | --- | --- |
| nvidia/Nemotron-3_5-Lightning (reasoning on) | 5/5 | 16036 ms | 4365 | 0 |
| nvidia/Nemotron-3_5-Lightning (reasoning off) | 5/5 | 2396 ms | 635 | 0 |
| nvidia/nemotron-3-super-120b-a12b (reasoning on) | 5/5 | 5850 ms | 1062 | 0 |

## Outputs by scenario

### Moisture gradually declining

Calculated confidence: **high**

**nvidia/Nemotron-3_5-Lightning (reasoning on)** (17659 ms, confidence medium)

> The simulated moisture data for this Monstera deliciosa shows a steady decline from approximately 54.8% to 33.2% over about 72 hours, with the latest reading at 33.2% at 2026-10-18T12:00:00Z. No watering events are recorded in the care history, and the user's preference is to water when the top 3 cm of soil feel dry. The environment is bright indirect light at an east window with a temperature of 23.1°C.
>
> **Next step:** Physically check the moisture content of the top 3 cm of soil using a finger or moisture meter to determine if watering is needed per the user's preference.

**nvidia/Nemotron-3_5-Lightning (reasoning off)** (2987 ms, confidence medium)

> The plant's moisture has been steadily decreasing over the past 72 hours, from approximately 55% to 33% at the current reading. The deterministic trend indicates a consistent decline of about 0.45 percentage points per hour with very high fit (R² = 0.997). The latest reading of 33.2% moisture is below the owner's stated preference of allowing the top 3 cm to dry before watering, though the system has not recorded any watering events in the history. The sensor reports adequate status and the temperature is 23.1°C. All readings are simulated, not measured. The plant is in bright indirect light in a 20 cm plastic nursery pot with chunky aroid mix. No sudden changes or watering responses are recorded.
>
> **Next step:** Water the plant when the top 3 cm of the aroid mix feel dry, using room-temperature water until modest runoff appears at the pot's bottom.

**nvidia/nemotron-3-super-120b-a12b (reasoning on)** (5953 ms, confidence high)

> The plant's soil moisture is currently 33.2% and has been declining steadily at about -0.45% per hour over the past 71.5 hours, with no watering recorded recently.
>
> **Next step:** Check the top 3 cm of soil for dryness; if it feels dry, water the plant according to the user's preference.

### Watering, then a moisture increase

Calculated confidence: **high**

**nvidia/Nemotron-3_5-Lightning (reasoning on)** (16036 ms, confidence medium)

> The simulated moisture data show a recent decline from a post-watering peak of 67.6% to 57.2% over approximately 21 hours, with an overall calculated trend of -0.474 percentage points per hour (R² = 0.971). The data are marked as simulated, not measured, so actual plant water status cannot be confirmed from readings alone.
>
> **Next step:** Manually assess the top 3 cm of soil moisture before the next watering using a finger or probe, to verify whether the plant requires water per the stated preference.

**nvidia/Nemotron-3_5-Lightning (reasoning off)** (3452 ms, confidence medium)

> The plant's moisture has been declining over the past 23 hours (from ~68% to 57.2%) after a watering event on 2026-10-17 at 12:00 UTC that raised moisture from 42.7% to 67.6%. The current moisture is 57.2% at 2026-10-18 12:00 UTC, and the deterministic trend indicates a steady decline of approximately 0.474 percentage points per hour. The hourly series shows a clear drop from the post-watering peak, with readings now near the lower end of the 48‑hour window. The user's care preference is to water when the top 3 cm feel dry, but no direct soil‑dryness data are provided.
>
> **Next step:** Check the soil moisture at the 3 cm depth (e.g., by inserting a finger or a moisture probe) to determine if the top layer is dry, then water only if it feels dry, consistent with the user's stated preference.

**nvidia/nemotron-3-super-120b-a12b (reasoning on)** (8630 ms, confidence medium)

> The plant's soil moisture is currently 57.2% and has been declining at an estimated rate of -0.474% per hour since the last watering 24 hours ago. After watering, moisture rose from 42.7% to 67.6% and has since gradually decreased, suggesting the soil is drying out.
>
> **Next step:** Check the top 3 cm of soil for dryness (e.g., using a finger test) to decide whether to water now.

### Stable moisture

Calculated confidence: **high**

**nvidia/Nemotron-3_5-Lightning (reasoning on)** (17651 ms, confidence medium)

> The latest simulated moisture reading is 46.3% as of 2026-10-18T12:00:00Z, and the calculated trend over 71.5 hours is stable based on 144 readings. No sudden moisture changes or recorded watering responses are present. The owner's care preference is to water when the top 3 cm of soil feel dry.
>
> **Next step:** Manually check the top 3 cm of the aroid mix by feel or with a moisture probe to determine if watering is needed, aligning with the user's stated care preference.

**nvidia/Nemotron-3_5-Lightning (reasoning off)** (2144 ms, confidence medium)

> The plant's moisture has been stable around 46–48% over the past 48 hours, with the most recent reading at 46.3% at the east window in bright indirect light. Temperature is 23.1°C. No watering or response events are recorded. The underlying data are simulated, not measured.
>
> **Next step:** Check the soil moisture manually by inserting a finger or moisture probe into the top 3 cm of the aroid mix, following the user's preference to water when the top 3 cm feel dry.

**nvidia/nemotron-3-super-120b-a12b (reasoning on)** (5850 ms, confidence high)

> The plant's moisture readings have been stable around 46% over the past 48 hours with no recorded watering events, and the trend is assessed as stable. According to the user's care preference, watering should occur when the top 3 cm of soil feels dry.
>
> **Next step:** Check the top 3 cm of soil for dryness (e.g., with a finger or moisture probe) and water the plant if it feels dry.

### Noisy sensor

Calculated confidence: **low**

**nvidia/Nemotron-3_5-Lightning (reasoning on)** (14448 ms, confidence low)

> The most recent simulated moisture reading for this Monstera deliciosa is 43%, recorded at 2026-10-18T12:00:00.000Z. Over the past 72 hours, moisture readings have varied widely (35.9%–65.8%) with no consistent trend identified (calculated R² = 0.197, confidence low). The owner’s care preference is to water when the top 3 cm of soil feel dry, but no in-situ verification or last watering timestamp is provided in the data.
>
> **Next step:** Physically check the top 3 cm of the aroid mix by feeling for dryness, per the owner's care preference.

**nvidia/Nemotron-3_5-Lightning (reasoning off)** (2249 ms, confidence low)

> The plant's most recent moisture reading is 43%, recorded at the east window in bright indirect light. Over the past 48 hours, moisture has fluctuated between approximately 36% and 66%, with no consistent upward or downward direction. The calculated trend is unclear, and the sensor data are simulated, not measured. The owner waters when the top 3 cm feel dry. No care events or watering responses are recorded in the history.
>
> **Next step:** Check the soil moisture manually by inserting a finger or wooden stick about 3 cm into the aroid mix; if it feels dry at that depth, water the plant; if it feels moist, wait another day before checking again.

**nvidia/nemotron-3-super-120b-a12b (reasoning on)** (4877 ms, confidence low)

> The plant's current soil moisture reads 43 % with no recent watering recorded, and moisture values have fluctuated widely over the past 48 hours without a clear upward or downward trend.
>
> **Next step:** Perform a manual check of the top 3 cm of soil to see if it feels dry before deciding to water, following the user’s care preference.

### Stale or disconnected device

Calculated confidence: **low**

**nvidia/Nemotron-3_5-Lightning (reasoning on)** (15277 ms, confidence low)

> The most recent simulated moisture reading is 32.9% at 06:00 Z, recorded 6 hours ago; the calculated trend shows a steady decline over the past 65.5 hours with high fit (R²=0.996), but data freshness is stale and all readings are simulated, not measured. Current soil moisture status is therefore uncertain.
>
> **Next step:** Insert a finger into the top 3 cm of the soil to check moisture, following the user's stated care preference.

**nvidia/Nemotron-3_5-Lightning (reasoning off)** (2396 ms, confidence low)

> The plant's soil moisture has been steadily decreasing over the past 72 hours, with the most recent simulated reading at 32.9% moisture taken 360 minutes ago. The deterministic trend shows a consistent decline of approximately 0.45 percentage points per hour, and the reading is flagged as stale. No care events or watering history are recorded. The plant is in bright indirect light in a 20 cm plastic nursery pot with chunky aroid mix, and the owner waters when the top 3 cm feel dry.
>
> **Next step:** Wait for a fresh moisture reading before watering or adjusting care.

**nvidia/nemotron-3-super-120b-a12b (reasoning on)** (5262 ms, confidence low)

> The plant's soil moisture was 32.9 % six hours ago and has been declining at an estimated rate of about 0.45 % per hour over the preceding 65.5 hours, according to the simulated data. No watering events are recorded, and the latest reading is stale, so the current moisture level is unknown.
>
> **Next step:** Perform a manual check of the top 3 cm of soil for dryness (e.g., finger test) or obtain a current sensor moisture reading before deciding to water.
