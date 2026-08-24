import { z } from "zod";
import { orgRoleSchema, orgInviteStatusSchema } from "./common";

export const orgSchema = z.object({
  _id: z.string(),
  org_id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  image: z.string().default(""),
  banner: z.string().default(""),
  website: z.string().default(""),
  twitter: z.string().default(""),
  instagram: z.string().default(""),
  linkedin: z.string().default(""),
  facebook: z.string().default(""),
  owner_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  isDeleted: z.boolean().default(false),
});
export type Org = z.infer<typeof orgSchema>;

/** An org paired with the current user's role in it (for "my orgs"). */
export const orgWithRoleSchema = orgSchema.extend({
  role: orgRoleSchema,
});
export type OrgWithRole = z.infer<typeof orgWithRoleSchema>;

export const orgMemberSchema = z.object({
  _id: z.string(),
  org_id: z.string(),
  user_id: z.string(),
  role: orgRoleSchema,
  created_at: z.string(),
});
export type OrgMember = z.infer<typeof orgMemberSchema>;

/** A membership hydrated with the member's public profile fields. */
export const orgMemberWithUserSchema = orgMemberSchema.extend({
  first_name: z.string(),
  last_name: z.string(),
  user_name: z.string(),
  email: z.string(),
});
export type OrgMemberWithUser = z.infer<typeof orgMemberWithUserSchema>;

export const orgInviteSchema = z.object({
  _id: z.string(),
  invite_id: z.string(),
  org_id: z.string(),
  org_name: z.string(),
  inviter_id: z.string(),
  invitee_id: z.string(),
  role: orgRoleSchema,
  status: orgInviteStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type OrgInvite = z.infer<typeof orgInviteSchema>;

/* ------------------------------ Inputs ---------------------------- */

export const createOrgInputSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(1000).optional().default(""),
  image: z.string().max(400).optional().default(""),
  banner: z.string().max(400).optional().default(""),
  website: z.string().max(200).optional().default(""),
  twitter: z.string().max(200).optional().default(""),
  instagram: z.string().max(200).optional().default(""),
  linkedin: z.string().max(200).optional().default(""),
  facebook: z.string().max(200).optional().default(""),
});
export type CreateOrgInput = z.infer<typeof createOrgInputSchema>;

export const updateOrgInputSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(1000).optional(),
  image: z.string().max(400).optional(),
  banner: z.string().max(400).optional(),
  website: z.string().max(200).optional(),
  twitter: z.string().max(200).optional(),
  instagram: z.string().max(200).optional(),
  linkedin: z.string().max(200).optional(),
  facebook: z.string().max(200).optional(),
});
export type UpdateOrgInput = z.infer<typeof updateOrgInputSchema>;

export const inviteMemberInputSchema = z.object({
  usernameOrEmail: z.string().min(1),
  role: orgRoleSchema.default("MEMBER"),
});
export type InviteMemberInput = z.infer<typeof inviteMemberInputSchema>;
