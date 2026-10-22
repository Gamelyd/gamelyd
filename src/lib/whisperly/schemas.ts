/** Request schemas for the Whisperly API (/api/whisperly/*). */
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(200)
  .regex(/[a-z]/, "A lowercase letter")
  .regex(/[A-Z]/, "An uppercase letter")
  .regex(/\d/, "A number")
  .regex(/[^A-Za-z0-9]/, "A symbol");

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

/** The Mac the request comes from. `id` is a SHA-256 hex of the hardware UUID. */
export const deviceSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/, "Invalid device id"),
  publicKey: z.string().min(40).max(200), // Ed25519 SPKI DER, base64 (~60 chars)
  name: z.string().trim().max(120).default("Mac"),
  model: z.string().trim().max(120).default(""),
  os: z.string().trim().max(120).default(""),
  appVersion: z.string().trim().max(40).default(""),
});

export const signupSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).default(""),
  email: emailSchema,
  password: passwordSchema,
  device: deviceSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  device: deviceSchema,
});

export const moveSchema = loginSchema.extend({ confirm: z.literal(true) });

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(2000) });

export const forgotSchema = z.object({ email: emailSchema });

export const resetSchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  newPassword: passwordSchema,
});

export const adminAccessSchema = z.object({
  userId: z.string().min(1).max(64),
  status: z.enum(["PENDING", "ACTIVE", "REVOKED"]),
  plan: z.enum(["FREE", "PRO"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(1000).optional(),
});

export const adminResetDeviceSchema = z.object({ userId: z.string().min(1).max(64) });

// ---- user data ----

/** Max request sizes (characters of JSON) for synced data. Mongo documents top out at 16 MB. */
export const DATA_LIMITS = { settings: 512 * 1024, profile: 6 * 1024 * 1024, meeting: 12 * 1024 * 1024 } as const;

const dataId = z.string().trim().min(1).max(64).regex(/^[\w-]+$/, "Invalid id");

/** The app's settings object (API keys are never part of it). Stored as-is. */
export const settingsSaveSchema = z.object({ settings: z.record(z.string(), z.unknown()) });

export const profileSaveSchema = z.object({
  profile: z.looseObject({
    id: dataId,
    name: z.string().max(200),
    items: z
      .array(
        z.looseObject({
          id: z.string().min(1).max(64),
          kind: z.enum(["file", "text"]),
          name: z.string().max(300),
          text: z.string(),
        }),
      )
      .max(500),
  }),
});

export const meetingSaveSchema = z.object({
  meeting: z.looseObject({
    id: dataId,
    title: z.string().max(500),
    startedAt: z.number().finite(),
    endedAt: z.number().finite().optional(),
  }),
  preview: z.string().max(400).default(""),
});

export const dataIdSchema = z.object({ id: dataId });

export type DeviceInput = z.infer<typeof deviceSchema>;
