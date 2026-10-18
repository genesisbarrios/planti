import { describe, expect, it } from "vitest";
import {
  generateDeviceCredential,
  hashDeviceCredential,
  isWellFormedCredential,
  verifyDeviceCredential,
} from "@/lib/devices/credentials";

const SECRET = "0123456789abcdef0123456789abcdef";

describe("device credentials", () => {
  it("generates unique, well-formed credentials", () => {
    const a = generateDeviceCredential();
    const b = generateDeviceCredential();
    expect(a).not.toBe(b);
    expect(isWellFormedCredential(a)).toBe(true);
  });

  it("stores a hash that is not the credential and verifies it", () => {
    const credential = generateDeviceCredential();
    const hash = hashDeviceCredential(credential, SECRET);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(credential);
    expect(verifyDeviceCredential(credential, hash, SECRET)).toBe(true);
  });

  it("rejects a different credential, a different secret, and malformed input", () => {
    const credential = generateDeviceCredential();
    const hash = hashDeviceCredential(credential, SECRET);
    expect(verifyDeviceCredential(generateDeviceCredential(), hash, SECRET)).toBe(false);
    expect(verifyDeviceCredential(credential, hash, "f".repeat(32))).toBe(false);
    expect(verifyDeviceCredential("planti_dev_short", hash, SECRET)).toBe(false);
    expect(verifyDeviceCredential(credential, "not-a-hash", SECRET)).toBe(false);
  });

  it("refuses a weak ingestion secret", () => {
    expect(() => hashDeviceCredential(generateDeviceCredential(), "short")).toThrow(/at least 32/);
  });
});
