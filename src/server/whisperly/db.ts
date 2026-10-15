import "server-only";
import { MongoClient, type Collection, type Db } from "mongodb";
import { wlEnv } from "./env";
import type { WlDeviceDoc, WlNonceDoc, WlPaymentDoc, WlUserDoc } from "./documents";

/**
 * Whisperly's own Mongo connection and collections. Deliberately separate from
 * gamelyd's db.ts: it only shares the MongoDB server (MONGODB_URL).
 */
export const WL_COLLECTIONS = {
  users: "whisperly_users",
  devices: "whisperly_devices",
  nonces: "whisperly_nonces",
  payments: "whisperly_payments",
} as const;

const g = globalThis as unknown as { _wlClient?: Promise<MongoClient>; _wlIndexes?: Promise<void> };

function client(): Promise<MongoClient> {
  g._wlClient ??= new MongoClient(wlEnv.mongodbUrl, { serverSelectionTimeoutMS: 10_000 }).connect();
  return g._wlClient;
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection(WL_COLLECTIONS.users).createIndex({ email: 1 }, { unique: true }),
    db.collection(WL_COLLECTIONS.users).createIndex({ user_id: 1 }, { unique: true }),
    db.collection(WL_COLLECTIONS.users).createIndex({ access: 1, created_at: -1 }),
    db.collection(WL_COLLECTIONS.devices).createIndex({ user_id: 1 }, { unique: true }),
    db.collection(WL_COLLECTIONS.devices).createIndex({ device_id: 1 }),
    db.collection(WL_COLLECTIONS.nonces).createIndex({ key: 1 }, { unique: true }),
    db.collection(WL_COLLECTIONS.nonces).createIndex({ created_at: 1 }, { expireAfterSeconds: 300 }),
    db.collection(WL_COLLECTIONS.payments).createIndex({ payment_id: 1 }, { unique: true }),
    db.collection(WL_COLLECTIONS.payments).createIndex({ stripe_session_id: 1 }, { unique: true, sparse: true }),
  ]).then(() => undefined);
}

export async function wlDb(): Promise<Db> {
  const db = (await client()).db(wlEnv.dbName);
  // Created once per process; unique indexes back the "one account per email / one device per account" rules.
  g._wlIndexes ??= ensureIndexes(db).catch((err) => {
    g._wlIndexes = undefined;
    console.error("[whisperly] index creation failed:", err);
  });
  await g._wlIndexes;
  return db;
}

export async function wlUsers(): Promise<Collection<WlUserDoc>> {
  return (await wlDb()).collection<WlUserDoc>(WL_COLLECTIONS.users);
}
export async function wlDevices(): Promise<Collection<WlDeviceDoc>> {
  return (await wlDb()).collection<WlDeviceDoc>(WL_COLLECTIONS.devices);
}
export async function wlNonces(): Promise<Collection<WlNonceDoc>> {
  return (await wlDb()).collection<WlNonceDoc>(WL_COLLECTIONS.nonces);
}
export async function wlPayments(): Promise<Collection<WlPaymentDoc>> {
  return (await wlDb()).collection<WlPaymentDoc>(WL_COLLECTIONS.payments);
}
