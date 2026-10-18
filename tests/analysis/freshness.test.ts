import { describe, expect, it } from "vitest";
import { classifyFreshness, deviceConnection } from "@/lib/analysis/freshness";

const now = new Date("2026-10-18T12:00:00.000Z");

describe("classifyFreshness", () => {
  it("returns none when there is no timestamp", () => {
    expect(classifyFreshness(null, now, 15)).toEqual({ freshness: "none", ageMinutes: null });
  });

  it("returns none for an unparseable timestamp", () => {
    expect(classifyFreshness("not-a-date", now, 15).freshness).toBe("none");
  });

  it("is fresh within the threshold, including the boundary", () => {
    expect(classifyFreshness("2026-10-18T11:50:00.000Z", now, 15)).toEqual({ freshness: "fresh", ageMinutes: 10 });
    expect(classifyFreshness("2026-10-18T11:45:00.000Z", now, 15).freshness).toBe("fresh");
  });

  it("is stale past the threshold", () => {
    expect(classifyFreshness("2026-10-18T11:44:00.000Z", now, 15)).toEqual({ freshness: "stale", ageMinutes: 16 });
  });

  it("treats small future clock drift as age zero", () => {
    expect(classifyFreshness("2026-10-18T12:02:00.000Z", now, 15)).toEqual({ freshness: "fresh", ageMinutes: 0 });
  });
});

describe("deviceConnection", () => {
  it("is never_reported without readings, even if a device record exists", () => {
    expect(deviceConnection(null, now, 15)).toBe("never_reported");
  });

  it("is online with a recent reading", () => {
    expect(deviceConnection(new Date("2026-10-18T11:58:00.000Z"), now, 15)).toBe("online");
  });

  it("is stale when the device stopped reporting", () => {
    expect(deviceConnection("2026-10-18T09:00:00.000Z", now, 15)).toBe("stale");
  });
});
