import "server-only";
import { ObjectId } from "mongodb";
import { users } from "../db";
import { env } from "../env";
import type { UserDoc } from "../documents";
import { hashPassword, verifyPassword } from "../auth/password";
import {
  generateAccessToken,
  generatePasswordResetToken,
  generateTokens,
  verifyRefreshToken,
} from "../auth/jwt";
import { getSessionClaims } from "../auth/session";
import { serializeUser } from "../serialize";
import { sendEmail } from "../email/mailer";
import {
  forgotPasswordEmail,
  passwordChangedEmail,
  registerEmail,
} from "../email/templates";
import type { User } from "@/lib/schemas/user";
import type { UserType } from "@/lib/schemas/common";
import type { Paginated } from "@/lib/result";
import type {
  SignupInput,
  UpdateUserInput,
} from "@/lib/schemas/user";

export interface AuthResult {
  user: User;
  token: string;
  refreshToken: string;
}

export class ServiceError extends Error {}

export function isAccountLocked(
  doc: Pick<UserDoc, "isDeleted" | "isSuspended">,
): boolean {
  return Boolean(doc.isDeleted || doc.isSuspended);
}

export async function revokeUserSessions(userId: string): Promise<void> {
  const col = await users();
  await col.updateOne(
    { user_id: userId },
    {
      $set: {
        token: "",
        refresh_token: "",
        updated_at: new Date().toISOString(),
      },
    },
  );
}

export async function createUser(input: SignupInput): Promise<AuthResult> {
  const col = await users();

  const emailTaken = await col.countDocuments({ email: input.email });
  if (emailTaken > 0) throw new ServiceError("Email already exists");
  const phoneTaken = await col.countDocuments({ phone: input.phone });
  if (phoneTaken > 0) throw new ServiceError("Phone number already exists");
  const nameTaken = await col.countDocuments({ user_name: input.user_name });
  if (nameTaken > 0) throw new ServiceError("Username already exists");

  const now = new Date().toISOString();
  const _id = new ObjectId();
  const uid = _id.toHexString();
  const hashed = await hashPassword(input.password);
  const { token, refreshToken } = await generateTokens({
    email: input.email,
    first_name: input.first_name,
    last_name: input.last_name,
    uid,
    user_type: input.user_type,
  });

  const doc: UserDoc = {
    _id,
    user_id: uid,
    first_name: input.first_name,
    last_name: input.last_name,
    user_name: input.user_name,
    email: input.email,
    phone: input.phone,
    password: hashed,
    user_type: input.user_type,
    token,
    refresh_token: refreshToken,
    created_at: now,
    updated_at: now,
    isDeleted: false,
    isSuspended: false,
    emailVerified: false,
    twitter: "",
    instagram: "",
    linkedin: "",
    facebook: "",
    country: "",
    location: "",
    icon: "",
  };

  await col.insertOne(doc);
  void sendEmail(input.email, registerEmail(input.first_name));

  return { user: { ...serializeUser(doc), token }, token, refreshToken };
}

export async function authenticate(
  email: string,
  password: string,
): Promise<AuthResult> {
  const col = await users();
  const found = await col.findOne({ email });
  if (!found) throw new ServiceError("Email or password is incorrect");

  const valid = await verifyPassword(password, found.password);
  if (!valid) throw new ServiceError("Email or password is incorrect");

  if (isAccountLocked(found)) {
    throw new ServiceError("This account has been banned");
  }

  const { token, refreshToken } = await generateTokens({
    email: found.email,
    first_name: found.first_name,
    last_name: found.last_name,
    uid: found.user_id,
    user_type: found.user_type,
  });

  await col.updateOne(
    { user_id: found.user_id },
    {
      $set: {
        token,
        refresh_token: refreshToken,
        updated_at: new Date().toISOString(),
      },
    },
  );

  return { user: { ...serializeUser(found), token }, token, refreshToken };
}

/**
 * Exchange a refresh token for a new access + refresh pair. Fails (returns
 * null) if the token is invalid, does not match the stored session, or the
 * account is banned/deleted — so a banned user cannot mint a new session.
 */
/**
 * Mint a new access token from the refresh cookie. The refresh token itself
 * stays the same so overlapping refreshes cannot invalidate each other.
 */
export async function exchangeRefreshToken(
  refreshToken: string,
): Promise<AuthResult | null> {
  const claims = await verifyRefreshToken(refreshToken);
  if (!claims) return null;

  const col = await users();
  const found = await col.findOne({ user_id: claims.uid });
  if (!found) return null;
  if (isAccountLocked(found)) return null;
  if (!found.refresh_token) {
    await col.updateOne(
      { user_id: found.user_id },
      { $set: { refresh_token: refreshToken } },
    );
  } else if (found.refresh_token !== refreshToken) {
    return null;
  }

  const token = await generateAccessToken({
    email: found.email,
    first_name: found.first_name,
    last_name: found.last_name,
    uid: found.user_id,
    user_type: found.user_type,
  });

  await col.updateOne(
    { user_id: found.user_id },
    {
      $set: {
        token,
        updated_at: new Date().toISOString(),
      },
    },
  );

  return {
    user: { ...serializeUser(found), token },
    token,
    refreshToken,
  };
}

/**
 * Read-only session lookup for Server Components. Never writes cookies —
 * Next.js only allows that from a client-invoked Server Action or Route Handler.
 */
export async function resolveCurrentUser(): Promise<User | null> {
  const claims = await getSessionClaims();
  if (!claims) return null;
  const user = await getUserById(claims.uid);
  if (!user || isAccountLocked(user)) return null;
  return user;
}

export async function forgotPassword(email: string): Promise<boolean> {
  const col = await users();
  const found = await col.findOne({ email });
  if (!found) return false;

  const token = await generatePasswordResetToken({
    email: found.email,
    first_name: found.first_name,
    last_name: found.last_name,
    uid: found.user_id,
    user_type: found.user_type,
  });

  // Dev convenience: print the reset link to the server console so the flow
  // can be tested locally without a working SMTP host. Never runs in production.
  // The path is logged too, in case the dev server is on a different port than
  // NEXT_PUBLIC_APP_URL — just prepend your running origin.
  if (process.env.NODE_ENV !== "production") {
    console.info(
      `\n[dev] Password reset for ${found.email}` +
        `\n      link: ${env.appUrl}/resetpassword/${token}` +
        `\n      path: /resetpassword/${token}\n`,
    );
  }

  await sendEmail(found.email, forgotPasswordEmail(token, found.first_name));
  return true;
}

export async function resetPassword(
  uid: string,
  newPassword: string,
): Promise<void> {
  const col = await users();
  const found = await col.findOne({ user_id: uid });
  if (!found) throw new ServiceError("User not found");

  const hashed = await hashPassword(newPassword);
  await col.updateOne(
    { user_id: uid },
    { $set: { password: hashed, updated_at: new Date().toISOString() } },
  );
  void sendEmail(found.email, passwordChangedEmail(found.first_name));
}

export async function changePassword(
  uid: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const col = await users();
  const found = await col.findOne({ user_id: uid });
  if (!found) throw new ServiceError("User not found");

  const valid = await verifyPassword(currentPassword, found.password);
  if (!valid) throw new ServiceError("Current password is incorrect");

  const hashed = await hashPassword(newPassword);
  await col.updateOne(
    { user_id: uid },
    { $set: { password: hashed, updated_at: new Date().toISOString() } },
  );
  void sendEmail(found.email, passwordChangedEmail(found.first_name));
}

export async function updateUser(
  uid: string,
  input: UpdateUserInput,
): Promise<User> {
  const col = await users();

  if (input.email) {
    const taken = await col.countDocuments({
      email: input.email,
      user_id: { $ne: uid },
    });
    if (taken > 0) throw new ServiceError("Email already exists");
  }
  if (input.user_name) {
    const taken = await col.countDocuments({
      user_name: input.user_name,
      user_id: { $ne: uid },
    });
    if (taken > 0) throw new ServiceError("Username already exists");
  }

  const $set: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  };
  if (input.icon !== undefined) {
    $set.icon = input.icon;
    $set.Icon = input.icon;
  }

  const updated = await col.findOneAndUpdate(
    { user_id: uid },
    { $set },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("User not found");
  return serializeUser(updated);
}

export async function getUserById(userId: string): Promise<User | null> {
  const col = await users();
  const found = await col.findOne({ user_id: userId });
  return found ? serializeUser(found) : null;
}

export async function getAllUsers(page = 1): Promise<Paginated<User>> {
  const col = await users();
  const perPage = 25;
  const safePage = Math.max(page, 1);

  const total = await col.countDocuments({});
  const docs = await col
    .find()
    .sort({ _id: -1 })
    .skip((safePage - 1) * perPage)
    .limit(perPage)
    .toArray();

  return {
    total,
    page: safePage,
    last_page: Math.max(Math.ceil(total / perPage), 1),
    items: docs.map(serializeUser),
  };
}

export async function searchUsers(
  search: string,
  page: number,
): Promise<Paginated<User>> {
  const col = await users();
  const perPage = 10;
  const safePage = Math.max(page, 1);
  const regex = { $regex: search, $options: "i" };
  const filter =
    search.trim().length > 0
      ? {
          $or: [
            { user_name: regex },
            { first_name: regex },
            { last_name: regex },
          ],
        }
      : {};

  const total = await col.countDocuments(filter);
  const docs = await col
    .find(filter)
    .sort({ _id: -1 })
    .skip((safePage - 1) * perPage)
    .limit(perPage)
    .toArray();

  return {
    total,
    page: safePage,
    last_page: Math.max(Math.ceil(total / perPage), 1),
    items: docs.map(serializeUser),
  };
}

export async function deleteUser(userId: string): Promise<User> {
  const col = await users();
  const found = await col.findOneAndUpdate(
    { user_id: userId },
    {
      $set: {
        isDeleted: true,
        token: "",
        refresh_token: "",
        updated_at: new Date().toISOString(),
      },
    },
    { returnDocument: "after" },
  );
  if (!found) throw new ServiceError("User not found");
  return serializeUser(found);
}

export async function checkUserName(name: string): Promise<number> {
  const col = await users();
  return col.countDocuments({ user_name: name });
}

/* ------------------------- admin management ------------------------- */

export async function setUserType(
  userId: string,
  type: UserType,
): Promise<User> {
  const col = await users();
  const updated = await col.findOneAndUpdate(
    { user_id: userId },
    { $set: { user_type: type, updated_at: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("User not found");
  return serializeUser(updated);
}

export async function toggleSuspendUser(userId: string): Promise<boolean> {
  const col = await users();
  const found = await col.findOne({ user_id: userId });
  if (!found) throw new ServiceError("User not found");
  const next = !found.isSuspended;
  await col.updateOne(
    { user_id: userId },
    {
      $set: {
        isSuspended: next,
        ...(next
          ? { token: "", refresh_token: "" }
          : {}),
        updated_at: new Date().toISOString(),
      },
    },
  );
  return next;
}

export async function toggleDeleteUser(userId: string): Promise<boolean> {
  const col = await users();
  const found = await col.findOne({ user_id: userId });
  if (!found) throw new ServiceError("User not found");
  const next = !found.isDeleted;
  await col.updateOne(
    { user_id: userId },
    {
      $set: {
        isDeleted: next,
        ...(next
          ? { token: "", refresh_token: "" }
          : {}),
        updated_at: new Date().toISOString(),
      },
    },
  );
  return next;
}
