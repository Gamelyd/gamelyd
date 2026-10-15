import "server-only";
import bcrypt from "bcryptjs";
import { compareVersions } from "@/lib/whisperly/rules";
import { isFresh, sha256Hex, SIGNATURE_HEADERS, signaturePayload, verifyEd25519 } from "@/lib/whisperly/signing";
import { signWlToken, verifyWlToken, type WlClaims } from "@/lib/whisperly/tokens";
import { wlDevices, wlNonces, wlUsers } from "./db";
import type { WlDeviceDoc, WlUserDoc } from "./documents";
import { wlEnv } from "./env";
import { clientIp, WlError } from "./http";

// ---- passwords ----

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummy: Promise<string> | null = null;
/** A real bcrypt hash of a random value, used so sign-in with an unknown email costs the same time. */
export function dummyHash(): Promise<string> {
  dummy ??= bcrypt.hash(crypto.randomUUID(), 12);
  return dummy;
}

// ---- tokens ----

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshHash: string;
}

/** Issues an access + refresh pair bound to one device. Store `refreshHash`, never the token. */
export async function issueTokens(user: WlUserDoc, deviceId: string): Promise<IssuedTokens> {
  const base = { sub: user.user_id, did: deviceId, role: user.role };
  const accessToken = await signWlToken({ ...base, typ: "access" }, wlEnv.secretKey);
  const refreshToken = await signWlToken({ ...base, typ: "refresh" }, wlEnv.secretKey);
  return { accessToken, refreshToken, refreshHash: sha256Hex(refreshToken) };
}

export function verifyRefresh(token: string): Promise<WlClaims | null> {
  return verifyWlToken(token, wlEnv.secretKey, "refresh");
}

// ---- app version ----

/** Old app builds get 426 so they can be retired with WHISPERLY_MIN_APP_VERSION. */
export function checkAppVersion(req: Request): void {
  const v = req.headers.get(SIGNATURE_HEADERS.appVersion) ?? "0.0.0";
  if (compareVersions(v, wlEnv.minAppVersion) < 0) {
    throw new WlError("UPGRADE_REQUIRED", `Please update Whisperly to version ${wlEnv.minAppVersion} or newer.`, 426, {
      minVersion: wlEnv.minAppVersion,
    });
  }
}

// ---- device signatures ----

/**
 * Proves the request was made by the Mac holding the private key for
 * `publicKey`: checks the timestamp, the Ed25519 signature over
 * method/path/time/nonce/device/body, and that the nonce wasn't used before.
 */
export async function verifyDeviceProof(
  req: Request,
  rawBody: string,
  publicKey: string,
  expectedDeviceId: string,
): Promise<void> {
  const h = req.headers;
  const deviceId = h.get(SIGNATURE_HEADERS.device) ?? "";
  const ts = h.get(SIGNATURE_HEADERS.ts) ?? "";
  const nonce = h.get(SIGNATURE_HEADERS.nonce) ?? "";
  const sig = h.get(SIGNATURE_HEADERS.sig) ?? "";
  if (!deviceId || !ts || !nonce || !sig) throw new WlError("DEVICE_PROOF_MISSING", "This request must come from the Whisperly app.", 401);
  if (deviceId !== expectedDeviceId) throw new WlError("DEVICE_MISMATCH", "This account is signed in on another Mac.", 403);
  if (!/^[a-f0-9]{16,64}$/.test(nonce)) throw new WlError("DEVICE_PROOF_INVALID", "Invalid request signature.", 401);
  if (!isFresh(ts, Date.now())) {
    throw new WlError("CLOCK_SKEW", "Your Mac's clock is out of sync. Turn on 'Set time automatically' in System Settings.", 401);
  }
  const url = new URL(req.url);
  const payload = signaturePayload({ method: req.method, path: url.pathname + url.search, ts, nonce, deviceId, body: rawBody });
  if (!verifyEd25519(publicKey, payload, sig)) throw new WlError("DEVICE_PROOF_INVALID", "Invalid request signature.", 401);
  try {
    await (await wlNonces()).insertOne({ key: `${deviceId}:${nonce}`, created_at: new Date() });
  } catch {
    throw new WlError("REPLAY", "This request was already used.", 401);
  }
}

export interface DeviceContext {
  claims: WlClaims;
  user: WlUserDoc;
  device: WlDeviceDoc;
  ip: string;
}

/**
 * Guard for signed-in routes: a valid Whisperly access token, issued to the
 * Mac the account is bound to, on a request signed by that Mac's key.
 */
export async function requireDevice(req: Request, rawBody: string): Promise<DeviceContext> {
  checkAppVersion(req);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const claims = bearer ? await verifyWlToken(bearer, wlEnv.secretKey, "access") : null;
  if (!claims) throw new WlError("UNAUTHORIZED", "Please sign in again.", 401);

  const devices = await wlDevices();
  const device = await devices.findOne({ user_id: claims.sub });
  if (!device || !device.device_id || !device.public_key || device.device_id !== claims.did) {
    throw new WlError("DEVICE_LOCKED", "This account is now used on another Mac.", 403);
  }
  await verifyDeviceProof(req, rawBody, device.public_key, device.device_id);

  const user = await (await wlUsers()).findOne({ user_id: claims.sub });
  if (!user) throw new WlError("UNAUTHORIZED", "Please sign in again.", 401);

  const ip = clientIp(req);
  await touchDevice(device, ip, req);
  return { claims, user, device, ip };
}

export async function requireAdmin(req: Request, rawBody: string): Promise<DeviceContext> {
  const ctx = await requireDevice(req, rawBody);
  if (ctx.user.role !== "ADMIN") throw new WlError("FORBIDDEN", "Admin access required.", 403);
  return ctx;
}

/** Records last seen time and IP (the last 20 distinct IP changes are kept for the admin screen). */
export async function touchDevice(device: WlDeviceDoc, ip: string, req: Request): Promise<void> {
  const now = new Date().toISOString();
  const appVersion = req.headers.get(SIGNATURE_HEADERS.appVersion) ?? device.app_version;
  const update: Record<string, unknown> = { last_seen_at: now, last_ip: ip, app_version: appVersion };
  const devices = await wlDevices();
  if (device.last_ip !== ip) {
    await devices.updateOne(
      { user_id: device.user_id },
      { $set: update, $push: { ip_history: { $each: [{ ip, at: now }], $slice: -20 } } },
    );
  } else {
    await devices.updateOne({ user_id: device.user_id }, { $set: update });
  }
}
