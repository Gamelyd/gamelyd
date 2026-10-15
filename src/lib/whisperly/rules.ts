/**
 * Whisperly business rules that don't need a database - kept pure so they
 * can be unit-tested.
 */
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

// ---- moving an account to another Mac ----

export interface DeviceMove {
  at: string; // ISO
  by: "USER" | "ADMIN";
}

/**
 * Self-service moves are allowed at most once per `cooldownDays`. Admin resets
 * don't count. The very first move is always allowed.
 */
export function moveEligibility(
  moves: DeviceMove[],
  now: Date,
  cooldownDays: number,
): { allowed: boolean; nextMoveAt: string | null } {
  const lastUserMove = moves
    .filter((m) => m.by === "USER")
    .map((m) => Date.parse(m.at))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a)[0];
  if (lastUserMove === undefined) return { allowed: true, nextMoveAt: null };
  const next = lastUserMove + cooldownDays * 24 * 60 * 60 * 1000;
  return next <= now.getTime()
    ? { allowed: true, nextMoveAt: null }
    : { allowed: false, nextMoveAt: new Date(next).toISOString() };
}

// ---- password reset codes ----

export const RESET_CODE_TTL_MS = 15 * 60 * 1000;

export function generateResetCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Codes are stored hashed with the user id as salt, never in plain text. */
export function hashResetCode(code: string, userId: string): string {
  return createHash("sha256").update(`wl-reset:${userId}:${code.trim()}`).digest("hex");
}

export function checkResetCode(
  input: { code: string; userId: string; storedHash?: string | null; expiresAt?: string | null },
  now: Date,
): "ok" | "invalid" | "expired" {
  if (!input.storedHash || !input.expiresAt) return "invalid";
  if (Date.parse(input.expiresAt) < now.getTime()) return "expired";
  const a = Buffer.from(hashResetCode(input.code, input.userId), "hex");
  const b = Buffer.from(input.storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "invalid";
}

// ---- app versions ----

/** Compares dotted versions numerically: -1, 0 or 1. Missing parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

// ---- access ----

export type WlAccess = "PENDING" | "ACTIVE" | "REVOKED";
export type WlLicenseStatus = WlAccess | "EXPIRED";

/** Effective licence status: an ACTIVE grant past its expiry counts as EXPIRED. */
export function licenseStatus(access: WlAccess, expiresAt: string | null | undefined, now: Date): WlLicenseStatus {
  if (access === "ACTIVE" && expiresAt && Date.parse(expiresAt) <= now.getTime()) return "EXPIRED";
  return access;
}
