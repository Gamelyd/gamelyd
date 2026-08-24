import { z } from "zod";
import { userTypeSchema } from "./common";

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
  emailVerified: z.boolean().default(false),
  twitter: z.string().default(""),
  instagram: z.string().default(""),
  linkedin: z.string().default(""),
  facebook: z.string().default(""),
  country: z.string().default(""),
  location: z.string().default(""),
});
export type User = z.infer<typeof userSchema>;

export const signupInputSchema = z.object({
  first_name: z.string().min(2).max(100),
  last_name: z.string().min(2).max(100),
  user_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(1),
  password: z.string().min(5),
  user_type: userTypeSchema.default("USER"),
});
export type SignupInput = z.infer<typeof signupInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const forgotPasswordInputSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;

export const resetPasswordInputSchema = z.object({
  newPassword: z.string().min(5),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;

export const changePasswordInputSchema = z.object({
  password: z.string().min(5),
  newPassword: z.string().min(5),
});
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

export const updateUserInputSchema = z.object({
  first_name: z.string().min(2).max(100).optional(),
  last_name: z.string().min(2).max(100).optional(),
  user_name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  twitter: z.string().optional(),
  instagram: z.string().optional(),
  linkedin: z.string().optional(),
  facebook: z.string().optional(),
  country: z.string().optional(),
  location: z.string().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
