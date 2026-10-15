import "server-only";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import {
  checkResetCode,
  generateResetCode,
  hashResetCode,
  licenseStatus,
  moveEligibility,
  RESET_CODE_TTL_MS,
} from "@/lib/whisperly/rules";
import {
  adminAccessSchema,
  adminResetDeviceSchema,
  forgotSchema,
  loginSchema,
  moveSchema,
  refreshSchema,
  resetSchema,
  signupSchema,
  type DeviceInput,
} from "@/lib/whisperly/schemas";
import { sha256Hex } from "@/lib/whisperly/signing";
import {
  checkAppVersion,
  dummyHash,
  hashPassword,
  issueTokens,
  requireAdmin,
  requireDevice,
  verifyDeviceProof,
  verifyPassword,
  verifyRefresh,
} from "./auth";
import { wlDevices, wlPayments, wlUsers } from "./db";
import type { WlDeviceDoc, WlUserDoc } from "./documents";
import { notifyAdminNewSignup, sendAccessGranted, sendResetCode, sendWelcome } from "./email";
import { wlEnv } from "./env";
import { clientIp, readBody, WlError } from "./http";
import { limitAuth, limitEmails, recordFailure } from "./rateLimit";

const MAX_REFRESH_TOKENS = 5;

const now = (): string => new Date().toISOString();

// ---- responses ----

export interface LicenseView {
  status: ReturnType<typeof licenseStatus>;
  plan: WlUserDoc["plan"];
  role: WlUserDoc["role"];
  expiresAt: string | null;
  user: { id: string; firstName: string; lastName: string; email: string };
  device: { id: string | null; name: string; model: string; boundAt: string | null } | null;
  checkedAt: string;
  paymentsEnabled: boolean;
  moveCooldownDays: number;
}

function licenseView(user: WlUserDoc, device: WlDeviceDoc | null): LicenseView {
  return {
    status: licenseStatus(user.access, user.expires_at, new Date()),
    plan: user.plan,
    role: user.role,
    expiresAt: user.expires_at ?? null,
    user: { id: user.user_id, firstName: user.first_name, lastName: user.last_name, email: user.email },
    device: device ? { id: device.device_id, name: device.name, model: device.model, boundAt: device.bound_at } : null,
    checkedAt: now(),
    paymentsEnabled: wlEnv.paymentsEnabled,
    moveCooldownDays: wlEnv.moveCooldownDays,
  };
}

function deviceFields(d: DeviceInput, ip: string) {
  const t = now();
  return {
    device_id: d.id,
    public_key: d.publicKey,
    name: d.name || "Mac",
    model: d.model,
    os: d.os,
    app_version: d.appVersion,
    bound_at: t,
    last_seen_at: t,
    last_ip: ip,
  };
}

async function sessionFor(user: WlUserDoc, deviceId: string) {
  const tokens = await issueTokens(user, deviceId);
  const devices = await wlDevices();
  await devices.updateOne(
    { user_id: user.user_id },
    { $push: { refresh_token_hashes: { $each: [tokens.refreshHash], $slice: -MAX_REFRESH_TOKENS } } },
  );
  const device = await devices.findOne({ user_id: user.user_id });
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, license: licenseView(user, device) };
}

/**
 * Binds the account to this Mac if it has none, or checks it's the bound Mac.
 * A different Mac gets DEVICE_LOCKED with what it needs to offer a move.
 */
async function bindOrCheckDevice(user: WlUserDoc, d: DeviceInput, ip: string): Promise<void> {
  const devices = await wlDevices();
  const existing = await devices.findOne({ user_id: user.user_id });
  if (!existing) {
    try {
      await devices.insertOne({ user_id: user.user_id, ...deviceFields(d, ip), ip_history: [{ ip, at: now() }], refresh_token_hashes: [], moves: [] });
      return;
    } catch {
      // Lost a race with another sign-in: fall through and check what got bound.
      return bindOrCheckDevice(user, d, ip);
    }
  }
  if (!existing.device_id) {
    // Unbound (after an admin reset): this Mac becomes the bound one.
    await devices.updateOne({ user_id: user.user_id, device_id: null }, { $set: { ...deviceFields(d, ip), refresh_token_hashes: [] } });
    return;
  }
  if (existing.device_id === d.id) {
    // Same Mac. The key can change if the app's Keychain data was reset - the password proved it's the owner.
    await devices.updateOne({ user_id: user.user_id }, { $set: { public_key: d.publicKey, name: d.name || existing.name, model: d.model, os: d.os, app_version: d.appVersion } });
    return;
  }
  const move = moveEligibility(existing.moves, new Date(), wlEnv.moveCooldownDays);
  throw new WlError("DEVICE_LOCKED", "This account is already used on another Mac.", 409, {
    boundDevice: { name: existing.name, model: existing.model, lastSeenAt: existing.last_seen_at },
    canMove: move.allowed,
    nextMoveAt: move.nextMoveAt,
    moveCooldownDays: wlEnv.moveCooldownDays,
  });
}

async function checkPassword(email: string, password: string): Promise<WlUserDoc> {
  const user = await (await wlUsers()).findOne({ email });
  // Unknown emails are checked against a real dummy hash, so both cases take the same time.
  const ok = await verifyPassword(password, user?.password ?? (await dummyHash()));
  if (!user || !ok) {
    recordFailure(email);
    throw new WlError("INVALID_CREDENTIALS", "Email or password is incorrect.", 401);
  }
  return user;
}

// ---- auth ----

export async function signup(req: Request) {
  checkAppVersion(req);
  const { raw, data } = await readBody(req, signupSchema);
  const ip = clientIp(req);
  limitAuth(ip, data.email);
  await verifyDeviceProof(req, raw, data.device.publicKey, data.device.id);

  const users = await wlUsers();
  if (await users.findOne({ email: data.email }, { projection: { _id: 1 } })) {
    throw new WlError("EMAIL_TAKEN", "An account with this email already exists. Sign in instead.", 409);
  }
  const t = now();
  const user: WlUserDoc = {
    user_id: randomUUID(),
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email,
    password: await hashPassword(data.password),
    role: "USER", // never taken from the request; admins are made with `npm run whisperly:set-admin`
    access: "PENDING",
    plan: "FREE",
    created_at: t,
    updated_at: t,
    last_login_at: t,
    last_login_ip: ip,
  };
  try {
    await users.insertOne(user);
  } catch {
    throw new WlError("EMAIL_TAKEN", "An account with this email already exists. Sign in instead.", 409);
  }
  await bindOrCheckDevice(user, data.device, ip);
  void sendWelcome(user.email, user.first_name);
  void notifyAdminNewSignup(`${user.first_name} ${user.last_name}`.trim(), user.email);
  return sessionFor(user, data.device.id);
}

export async function login(req: Request) {
  checkAppVersion(req);
  const { raw, data } = await readBody(req, loginSchema);
  const ip = clientIp(req);
  limitAuth(ip, data.email);
  await verifyDeviceProof(req, raw, data.device.publicKey, data.device.id);
  const user = await checkPassword(data.email, data.password);
  await bindOrCheckDevice(user, data.device, ip);
  await (await wlUsers()).updateOne({ user_id: user.user_id }, { $set: { last_login_at: now(), last_login_ip: ip } });
  return sessionFor(user, data.device.id);
}

/** Self-service move to this Mac, at most once per WHISPERLY_MOVE_COOLDOWN_DAYS. */
export async function moveDevice(req: Request) {
  checkAppVersion(req);
  const { raw, data } = await readBody(req, moveSchema);
  const ip = clientIp(req);
  limitAuth(ip, data.email);
  await verifyDeviceProof(req, raw, data.device.publicKey, data.device.id);
  const user = await checkPassword(data.email, data.password);

  const devices = await wlDevices();
  const existing = await devices.findOne({ user_id: user.user_id });
  if (existing?.device_id && existing.device_id !== data.device.id) {
    const move = moveEligibility(existing.moves, new Date(), wlEnv.moveCooldownDays);
    if (!move.allowed) {
      throw new WlError("MOVE_NOT_ALLOWED", `You can move your account to another Mac once every ${wlEnv.moveCooldownDays} days.`, 409, {
        nextMoveAt: move.nextMoveAt,
      });
    }
    await devices.updateOne(
      { user_id: user.user_id },
      {
        $set: { ...deviceFields(data.device, ip), refresh_token_hashes: [] }, // the old Mac's sessions end now
        $push: {
          moves: { from_device_id: existing.device_id, to_device_id: data.device.id, at: now(), by: "USER", ip },
          ip_history: { $each: [{ ip, at: now() }], $slice: -20 },
        },
      },
    );
  } else {
    await bindOrCheckDevice(user, data.device, ip);
  }
  return sessionFor(user, data.device.id);
}

export async function refresh(req: Request) {
  checkAppVersion(req);
  const { raw, data } = await readBody(req, refreshSchema);
  const claims = await verifyRefresh(data.refreshToken);
  if (!claims) throw new WlError("UNAUTHORIZED", "Please sign in again.", 401);

  const devices = await wlDevices();
  const device = await devices.findOne({ user_id: claims.sub });
  if (!device?.device_id || !device.public_key || device.device_id !== claims.did) {
    throw new WlError("DEVICE_LOCKED", "This account is now used on another Mac.", 403);
  }
  const hash = sha256Hex(data.refreshToken);
  if (!device.refresh_token_hashes.includes(hash)) throw new WlError("UNAUTHORIZED", "Please sign in again.", 401);
  await verifyDeviceProof(req, raw, device.public_key, device.device_id);

  const user = await (await wlUsers()).findOne({ user_id: claims.sub });
  if (!user) throw new WlError("UNAUTHORIZED", "Please sign in again.", 401);

  // Rotate: the old refresh token stops working.
  await devices.updateOne({ user_id: user.user_id }, { $pull: { refresh_token_hashes: hash } });
  return sessionFor(user, device.device_id);
}

export async function logout(req: Request) {
  const { raw, data } = await readBody(req, refreshSchema);
  const claims = await verifyRefresh(data.refreshToken);
  if (!claims) return { signedOut: true };
  const devices = await wlDevices();
  const device = await devices.findOne({ user_id: claims.sub });
  if (device?.public_key && device.device_id === claims.did) {
    await verifyDeviceProof(req, raw, device.public_key, device.device_id);
    await devices.updateOne({ user_id: claims.sub }, { $pull: { refresh_token_hashes: sha256Hex(data.refreshToken) } });
  }
  return { signedOut: true };
}

export async function forgotPassword(req: Request) {
  const { data } = await readBody(req, forgotSchema);
  limitAuth(clientIp(req), data.email);
  const users = await wlUsers();
  const user = await users.findOne({ email: data.email });
  if (user && limitEmails(data.email)) {
    const code = generateResetCode();
    await users.updateOne(
      { user_id: user.user_id },
      { $set: { reset_code_hash: hashResetCode(code, user.user_id), reset_expires_at: new Date(Date.now() + RESET_CODE_TTL_MS).toISOString() } },
    );
    void sendResetCode(user.email, user.first_name, code);
  }
  // Same answer whether or not the account exists.
  return { sent: true };
}

export async function resetPassword(req: Request) {
  const { data } = await readBody(req, resetSchema);
  limitAuth(clientIp(req), data.email);
  const users = await wlUsers();
  const user = await users.findOne({ email: data.email });
  const result = user
    ? checkResetCode({ code: data.code, userId: user.user_id, storedHash: user.reset_code_hash, expiresAt: user.reset_expires_at }, new Date())
    : "invalid";
  if (!user || result !== "ok") {
    recordFailure(data.email);
    throw new WlError("INVALID_CODE", result === "expired" ? "That code has expired. Request a new one." : "That code is incorrect.", 400);
  }
  await users.updateOne(
    { user_id: user.user_id },
    { $set: { password: await hashPassword(data.newPassword), reset_code_hash: null, reset_expires_at: null, updated_at: now() } },
  );
  // Sign out everywhere after a reset.
  await (await wlDevices()).updateOne({ user_id: user.user_id }, { $set: { refresh_token_hashes: [] } });
  return { reset: true };
}

// ---- licence ----

export async function license(req: Request) {
  const { user, device } = await requireDevice(req, "");
  return licenseView(user, device);
}

// ---- admin ----

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function adminListUsers(req: Request) {
  await requireAdmin(req, "");
  const url = new URL(req.url);
  const query = (url.searchParams.get("query") ?? "").trim().slice(0, 100);
  const status = url.searchParams.get("status");
  const filter: Record<string, unknown> = {};
  if (status === "PENDING" || status === "ACTIVE" || status === "REVOKED") filter.access = status;
  if (query) {
    const re = new RegExp(escapeRegex(query), "i");
    filter.$or = [{ email: re }, { first_name: re }, { last_name: re }];
  }
  const users = await (await wlUsers()).find(filter, { projection: { password: 0, reset_code_hash: 0 } }).sort({ created_at: -1 }).limit(300).toArray();
  const devices = await (await wlDevices()).find({ user_id: { $in: users.map((u) => u.user_id) } }, { projection: { refresh_token_hashes: 0, public_key: 0 } }).toArray();
  const byUser = new Map(devices.map((d) => [d.user_id, d]));
  return {
    users: users.map((u) => {
      const d = byUser.get(u.user_id);
      return {
        id: u.user_id,
        firstName: u.first_name,
        lastName: u.last_name,
        email: u.email,
        role: u.role,
        access: u.access,
        status: licenseStatus(u.access, u.expires_at, new Date()),
        plan: u.plan,
        expiresAt: u.expires_at ?? null,
        notes: u.notes ?? "",
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at ?? null,
        device: d
          ? {
              bound: !!d.device_id,
              name: d.name,
              model: d.model,
              os: d.os,
              appVersion: d.app_version,
              boundAt: d.bound_at,
              lastSeenAt: d.last_seen_at,
              lastIp: d.last_ip,
              ipHistory: d.ip_history.slice(-5).reverse(),
              moves: d.moves.slice(-5).reverse(),
            }
          : null,
      };
    }),
  };
}

export async function adminSetAccess(req: Request) {
  const { raw, data } = await readBody(req, adminAccessSchema);
  const admin = await requireAdmin(req, raw);
  const users = await wlUsers();
  const user = await users.findOne({ user_id: data.userId });
  if (!user) throw new WlError("NOT_FOUND", "User not found.", 404);
  const set: Partial<WlUserDoc> = { access: data.status, updated_at: now() };
  if (data.plan) set.plan = data.plan;
  if (data.expiresAt !== undefined) set.expires_at = data.expiresAt;
  if (data.notes !== undefined) set.notes = data.notes;
  if (data.status === "ACTIVE" && user.access !== "ACTIVE") {
    set.granted_by = admin.user.email;
    set.granted_at = now();
  }
  await users.updateOne({ user_id: user.user_id }, { $set: set });
  if (data.status === "ACTIVE" && user.access !== "ACTIVE") void sendAccessGranted(user.email, user.first_name);
  return { updated: true };
}

export async function adminResetDevice(req: Request) {
  const { raw, data } = await readBody(req, adminResetDeviceSchema);
  const admin = await requireAdmin(req, raw);
  const devices = await wlDevices();
  const device = await devices.findOne({ user_id: data.userId });
  if (!device?.device_id) return { reset: true }; // already unbound
  await devices.updateOne(
    { user_id: data.userId },
    {
      $set: { device_id: null, public_key: null, bound_at: null, refresh_token_hashes: [] },
      $push: { moves: { from_device_id: device.device_id, to_device_id: null, at: now(), by: "ADMIN", ip: admin.ip } },
    },
  );
  return { reset: true };
}

// ---- billing (built, switched off with WHISPERLY_PAYMENTS_ENABLED=false) ----

function requirePayments(): Stripe {
  if (!wlEnv.paymentsEnabled) throw new WlError("PAYMENTS_DISABLED", "Payments are not enabled yet.", 503);
  if (!wlEnv.stripeSecretKey || !wlEnv.stripePriceId) throw new WlError("PAYMENTS_MISCONFIGURED", "Payments are not configured.", 503);
  return new Stripe(wlEnv.stripeSecretKey);
}

export async function billingCheckout(req: Request) {
  const stripe = requirePayments();
  const { user } = await requireDevice(req, await req.text());
  const paymentId = randomUUID();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: wlEnv.stripePriceId, quantity: 1 }],
    customer_email: user.email,
    client_reference_id: paymentId,
    metadata: { whisperly_user_id: user.user_id, whisperly_payment_id: paymentId },
    success_url: `${wlEnv.publicUrl}/api/whisperly/billing/return?status=success`,
    cancel_url: `${wlEnv.publicUrl}/api/whisperly/billing/return?status=cancel`,
  });
  const t = now();
  await (await wlPayments()).insertOne({
    payment_id: paymentId,
    user_id: user.user_id,
    stripe_session_id: session.id,
    status: "PENDING",
    plan: "PRO",
    amount: session.amount_total ?? null,
    currency: session.currency ?? null,
    created_at: t,
    updated_at: t,
  });
  return { url: session.url };
}

export async function billingWebhook(req: Request): Promise<{ received: true }> {
  const stripe = requirePayments();
  const signature = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, wlEnv.stripeWebhookSecret);
  } catch {
    throw new WlError("BAD_SIGNATURE", "Invalid webhook signature.", 400);
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentId = session.metadata?.whisperly_payment_id;
    const userId = session.metadata?.whisperly_user_id;
    if (paymentId && userId) {
      await (await wlPayments()).updateOne({ payment_id: paymentId }, { $set: { status: "PAID", updated_at: now() } });
      await (await wlUsers()).updateOne(
        { user_id: userId },
        { $set: { plan: "PRO", access: "ACTIVE", granted_by: "stripe", granted_at: now(), updated_at: now() } },
      );
    }
  }
  return { received: true };
}
