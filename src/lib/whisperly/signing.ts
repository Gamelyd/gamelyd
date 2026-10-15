/**
 * Whisperly device signatures.
 *
 * Every Whisperly request that needs a device is signed by the app with an
 * Ed25519 private key that never leaves the Mac (it's encrypted with that
 * Mac's Keychain). The server checks the signature with the public key it
 * stored when the device was bound, so tokens or app data copied to another
 * machine are useless there.
 *
 * Pure helpers (no DB, no server-only) so they can be unit-tested.
 */
import { createHash, createPublicKey, verify } from "node:crypto";

/** Requests older/newer than this are rejected (replay protection with the nonce store). */
export const MAX_SKEW_MS = 2 * 60 * 1000;

export const SIGNATURE_HEADERS = {
  device: "x-wl-device",
  ts: "x-wl-ts",
  nonce: "x-wl-nonce",
  sig: "x-wl-sig",
  appVersion: "x-wl-app-version",
} as const;

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * The exact bytes the app signs. Any change to method, path, time, nonce,
 * device or body invalidates the signature.
 */
export function signaturePayload(input: {
  method: string;
  path: string;
  ts: string;
  nonce: string;
  deviceId: string;
  body: string;
}): string {
  return [
    "WL1",
    input.method.toUpperCase(),
    input.path,
    input.ts,
    input.nonce,
    input.deviceId,
    sha256Hex(input.body),
  ].join("\n");
}

export function isFresh(ts: string, now: number, maxSkewMs = MAX_SKEW_MS): boolean {
  const t = Number(ts);
  return Number.isFinite(t) && Math.abs(now - t) <= maxSkewMs;
}

/** True when `sigB64` is a valid Ed25519 signature of `payload` by `publicKeyB64` (SPKI DER, base64). */
export function verifyEd25519(publicKeyB64: string, payload: string, sigB64: string): boolean {
  try {
    const key = createPublicKey({ key: Buffer.from(publicKeyB64, "base64"), format: "der", type: "spki" });
    if (key.asymmetricKeyType !== "ed25519") return false;
    return verify(null, Buffer.from(payload), key, Buffer.from(sigB64, "base64"));
  } catch {
    return false;
  }
}
