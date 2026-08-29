import { z } from "zod";

/** Operations the admin tables can apply to a whole selection at once. */
export const bulkUserOpSchema = z.enum([
  "VERIFY",
  "UNVERIFY",
  "BAN",
  "UNBAN",
  "DELETE",
  "RESTORE",
]);
export type BulkUserOp = z.infer<typeof bulkUserOpSchema>;

export const bulkTournamentOpSchema = z.enum([
  "FEATURE",
  "UNFEATURE",
  "SUSPEND",
  "UNSUSPEND",
  "DELETE",
  "RESTORE",
]);
export type BulkTournamentOp = z.infer<typeof bulkTournamentOpSchema>;

/** What a bulk run reports back: how many landed, and why the rest did not. */
export interface BulkResult {
  done: number;
  failed: string[];
}
