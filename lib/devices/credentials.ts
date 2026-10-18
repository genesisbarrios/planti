import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Per-device credentials. A credential is 32 random bytes (256 bits), shown to
 * the user once at provisioning. The database stores only
 * HMAC-SHA256(DEVICE_INGESTION_SECRET, credential), so a database leak alone
 * cannot be used to impersonate a device.
 */

const PREFIX = "planti_dev_";
const CREDENTIAL_PATTERN = /^planti_dev_[A-Za-z0-9_-]{43}$/;

export function generateDeviceCredential(): string {
  return PREFIX + randomBytes(32).toString("base64url");
}

export function isWellFormedCredential(credential: string): boolean {
  return CREDENTIAL_PATTERN.test(credential);
}

export function hashDeviceCredential(credential: string, secret: string): string {
  if (!secret || secret.length < 32) {
    throw new Error("DEVICE_INGESTION_SECRET must be at least 32 characters");
  }
  return createHmac("sha256", secret).update(credential, "utf8").digest("hex");
}

/** Constant-time comparison of a presented credential with a stored hash. */
export function verifyDeviceCredential(credential: string, storedHash: string, secret: string): boolean {
  if (!isWellFormedCredential(credential) || !/^[0-9a-f]{64}$/.test(storedHash)) return false;
  const presented = Buffer.from(hashDeviceCredential(credential, secret), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}
