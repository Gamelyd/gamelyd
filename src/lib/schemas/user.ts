import { z } from "zod";
import { LIMITS } from "@/lib/limits";
import { planSchema } from "@/lib/plans";
import { isValidPhoneNumber } from "libphonenumber-js";
import { userTypeSchema } from "./common";
import { isStrongPassword, PASSWORD_MIN_LENGTH } from "@/lib/password";

/** Password that satisfies every shared strength rule (used for new passwords). */
const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(LIMITS.password)
  .refine(isStrongPassword, {
    message:
      "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol",
  });

/**
 * Phone number in international E.164 format, e.g. +2348012345678. Collected on
 * the profile rather than at signup, so blank is a normal, valid state.
 */
const optionalPhoneSchema = z
  .string()
  .trim()
  .max(LIMITS.phone)
  .refine((value) => value === "" || isValidPhoneNumber(value), {
    message: "Enter a valid phone number including country code",
  })
  .default("");

/** Public-facing user (never includes password / refresh token). */
export const userSchema = z.object({
  _id: z.string(),
  user_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  user_name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  user_type: userTypeSchema,
  token: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  isDeleted: z.boolean().default(false),
  isSuspended: z.boolean().default(false),
  isBanned: z.boolean().default(false),
  emailVerified: z.boolean().default(false),
  verified: z.boolean().default(false),
  twitter: z.string().default(""),
  instagram: z.string().default(""),
  linkedin: z.string().default(""),
  facebook: z.string().default(""),
  country: z.string().default(""),
  location: z.string().default(""),
  plan: planSchema.default("FREE"),
  icon: z.string().default(""),
});
export type User = z.infer<typeof userSchema>;

/**
 * Signup asks for the least that can identify an account.
 *
 * The wall sits at the exact moment a player is trying to join a tournament
 * they were invited to, so every extra field is paid for in people who never
 * arrive. Real name and phone are useful but not needed to play, so they moved
 * to the profile, where someone who cares can fill them in later.
 */
export const signupInputSchema = z.object({
  first_name: z.string().trim().max(LIMITS.firstName).default(""),
  last_name: z.string().trim().max(LIMITS.lastName).default(""),
  user_name: z.string().min(2).max(LIMITS.userName),
  email: z.string().email().max(LIMITS.email),
  phone: optionalPhoneSchema,
  password: strongPasswordSchema,
  user_type: userTypeSchema.default("USER"),
});
export type SignupInput = z.infer<typeof signupInputSchema>;
/**
 * What the signup form actually collects. The fields the schema defaults are
 * absent here, so the form cannot accidentally start requiring them again.
 */
export type SignupFormInput = Omit<
  z.input<typeof signupInputSchema>,
  "first_name" | "last_name" | "phone"
>;

export const loginInputSchema = z.object({
  email: z.string().email().max(LIMITS.email),
  password: z.string().min(1).max(LIMITS.password),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const forgotPasswordInputSchema = z.object({
  email: z.string().email().max(LIMITS.email),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;

export const resetPasswordInputSchema = z.object({
  newPassword: strongPasswordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;

export const changePasswordInputSchema = z.object({
  password: z.string().min(1).max(LIMITS.password),
  newPassword: strongPasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

export const updateUserInputSchema = z.object({
  first_name: z.string().min(2).max(LIMITS.firstName).optional(),
  last_name: z.string().min(2).max(LIMITS.lastName).optional(),
  user_name: z.string().min(2).max(LIMITS.userName).optional(),
  email: z.string().email().max(LIMITS.email).optional(),
  phone: z.string().max(LIMITS.phone).optional(),
  twitter: z.string().max(LIMITS.socialHandle).optional(),
  instagram: z.string().max(LIMITS.socialHandle).optional(),
  linkedin: z.string().max(LIMITS.socialHandle).optional(),
  facebook: z.string().max(LIMITS.socialHandle).optional(),
  country: z.string().max(LIMITS.country).optional(),
  location: z.string().max(LIMITS.location).optional(),
  icon: z.string().max(LIMITS.iconRef).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
