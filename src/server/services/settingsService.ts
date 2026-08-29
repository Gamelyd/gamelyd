import "server-only";
import { ObjectId } from "mongodb";
import { settings } from "@/server/db";
import { ServiceError } from "@/server/services/userService";
import { PLATFORM_FEE_BPS } from "@/lib/fees";

/**
 * The fee is read on almost every money-related render, so it is cached in
 * process for a short window rather than hitting Mongo each time. A change
 * applies immediately on the instance that made it and within the TTL
 * elsewhere; tournaments already created keep the rate stamped on them, so a
 * stale read can never mis-charge an existing event.
 */
const TTL_MS = 30_000;

let cached: { bps: number; at: number } | null = null;

export const MIN_FEE_BPS = 0;
/** 50%, a hard ceiling so a typo cannot take most of a prize pot. */
export const MAX_FEE_BPS = 5000;

export async function getPlatformFeeBps(): Promise<number> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.bps;
  try {
    const doc = await (await settings()).findOne({ key: "platform" });
    const bps =
      typeof doc?.platformFeeBps === "number" &&
      Number.isFinite(doc.platformFeeBps)
        ? doc.platformFeeBps
        : PLATFORM_FEE_BPS;
    cached = { bps, at: Date.now() };
    return bps;
  } catch (error) {
    // Never let a settings read break checkout; fall back to the built-in rate.
    console.error("[settings] fee read failed:", error);
    return cached?.bps ?? PLATFORM_FEE_BPS;
  }
}

export async function setPlatformFeeBps(
  bps: number,
  adminUid: string,
): Promise<number> {
  if (!Number.isInteger(bps) || bps < MIN_FEE_BPS || bps > MAX_FEE_BPS) {
    throw new ServiceError(
      `The fee must be a whole number between ${MIN_FEE_BPS / 100}% and ${MAX_FEE_BPS / 100}%`,
    );
  }
  const now = new Date().toISOString();
  await (await settings()).updateOne(
    { key: "platform" },
    {
      $set: { platformFeeBps: bps, updated_at: now, updated_by: adminUid },
      $setOnInsert: { _id: new ObjectId(), key: "platform" },
    },
    { upsert: true },
  );
  cached = { bps, at: Date.now() };
  return bps;
}

export interface PlatformSettings {
  feeBps: number;
  paidEnabled: boolean;
  sponsoredEnabled: boolean;
  updated_at: string;
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const doc = await (await settings()).findOne({ key: "platform" });
  return {
    feeBps:
      typeof doc?.platformFeeBps === "number" ? doc.platformFeeBps : PLATFORM_FEE_BPS,
    // Off until an admin turns them on: money features should be opt-in, not
    // live the moment a deployment exists.
    paidEnabled: doc?.paidEnabled === true,
    sponsoredEnabled: doc?.sponsoredEnabled === true,
    updated_at: doc?.updated_at ?? "",
  };
}

/** Turns a money option on or off for NEW tournaments. */
export async function setEventTypeEnabled(
  which: "paid" | "sponsored",
  enabled: boolean,
  adminUid: string,
): Promise<PlatformSettings> {
  const field = which === "paid" ? "paidEnabled" : "sponsoredEnabled";
  const now = new Date().toISOString();
  await (await settings()).updateOne(
    { key: "platform" },
    {
      $set: { [field]: enabled, updated_at: now, updated_by: adminUid },
      $setOnInsert: { _id: new ObjectId(), key: "platform" },
    },
    { upsert: true },
  );
  typesCache = null;
  return getPlatformSettings();
}

/**
 * Cached alongside the fee: read on every create-page render, and a stale read
 * only ever affects whether the option is offered, never an existing event.
 */
let typesCache: {
  paid: boolean;
  sponsored: boolean;
  at: number;
} | null = null;

export async function getEnabledEventTypes(): Promise<{
  paid: boolean;
  sponsored: boolean;
}> {
  if (typesCache && Date.now() - typesCache.at < TTL_MS) {
    return { paid: typesCache.paid, sponsored: typesCache.sponsored };
  }
  try {
    const doc = await (await settings()).findOne({ key: "platform" });
    const value = {
      paid: doc?.paidEnabled === true,
      sponsored: doc?.sponsoredEnabled === true,
    };
    typesCache = { ...value, at: Date.now() };
    return value;
  } catch (error) {
    console.error("[settings] event type read failed:", error);
    // Fail closed: if we cannot read the setting, do not offer money events.
    return typesCache
      ? { paid: typesCache.paid, sponsored: typesCache.sponsored }
      : { paid: false, sponsored: false };
  }
}
