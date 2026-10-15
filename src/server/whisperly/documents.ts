import "server-only";
import type { ObjectId } from "mongodb";
import type { WlAccess } from "@/lib/whisperly/rules";

/** Whisperly accounts - collection `whisperly_users` (separate from gamelyd's `user`). */
export interface WlUserDoc {
  _id?: ObjectId;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string; // stored lowercase
  password: string; // bcrypt
  role: "USER" | "ADMIN";
  access: WlAccess;
  plan: "FREE" | "PRO";
  granted_by?: string | null;
  granted_at?: string | null;
  expires_at?: string | null;
  notes?: string;
  reset_code_hash?: string | null;
  reset_expires_at?: string | null;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
  last_login_ip?: string | null;
}

export interface WlMoveRecord {
  from_device_id: string | null;
  to_device_id: string | null;
  at: string;
  by: "USER" | "ADMIN";
  ip: string;
}

/** The one Mac an account is bound to - collection `whisperly_devices` (one per user). */
export interface WlDeviceDoc {
  _id?: ObjectId;
  user_id: string;
  device_id: string | null; // null after an admin reset: the next sign-in binds a new Mac
  public_key: string | null;
  name: string;
  model: string;
  os: string;
  app_version: string;
  bound_at: string | null;
  last_seen_at: string | null;
  last_ip: string | null;
  ip_history: { ip: string; at: string }[];
  refresh_token_hashes: string[];
  moves: WlMoveRecord[];
}

/** Used nonces (replay protection), expired by a TTL index - collection `whisperly_nonces`. */
export interface WlNonceDoc {
  _id?: ObjectId;
  key: string; // `${device_id}:${nonce}`
  created_at: Date;
}

/** Collection `whisperly_payments` (used only when payments are enabled). */
export interface WlPaymentDoc {
  _id?: ObjectId;
  payment_id: string;
  user_id: string;
  stripe_session_id: string;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELED";
  plan: "PRO";
  amount: number | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
}
