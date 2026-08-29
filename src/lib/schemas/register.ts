import { z } from "zod";
import { playerSchema } from "./draw";

export const registerTournamentSchema = z.object({
  _id: z.string(),
  Players: z.array(playerSchema),
  Created_at: z.string(),
  Updated_at: z.string(),
  TournamentId: z.string(),
  TournamentName: z.string(),
  TournamentIcon: z.string(),
  TournamentDate: z.string(),
  RegisterTournamentId: z.string(),
  TeamName: z.string(),
  RefNumber: z.string().default(""),
  PaymentChannel: z.string().default(""),
  Amount: z.number().default(0),
  Icon: z.string(),
  CheckedIn: z.boolean().default(false),
  CheckedInAt: z.string().default(""),
  /** Player who registered the team. Prize money for the team goes to them. */
  CaptainUserId: z.string().default(""),
});
export type RegisterTournament = z.infer<typeof registerTournamentSchema>;

export const registerTournamentInputSchema = z.object({
  Players: z.array(playerSchema).min(1).max(32),
  TeamName: z.string().min(1),
  Icon: z.string().min(1),
  RefNumber: z.string().optional().default(""),
  PaymentChannel: z.string().optional().default(""),
  Amount: z.coerce.number().optional().default(0),
  /**
   * Enter a roster saved on the captain's profile. The server resolves the
   * players from the saved team, so the whole roster joins at once instead of
   * each teammate needing a separate invite.
   */
  SavedTeamId: z.string().optional().default(""),
});
export type RegisterTournamentInput = z.infer<
  typeof registerTournamentInputSchema
>;

/**
 * What the registration service actually consumes. `SavedTeamId` is resolved
 * into `Players` at the action boundary, so it never reaches the service.
 */
export type RegisterTournamentPayload = Omit<
  RegisterTournamentInput,
  "SavedTeamId"
>;
