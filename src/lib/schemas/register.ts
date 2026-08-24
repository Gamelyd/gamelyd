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
});
export type RegisterTournament = z.infer<typeof registerTournamentSchema>;

export const registerTournamentInputSchema = z.object({
  Players: z.array(playerSchema).min(1),
  TeamName: z.string().min(1),
  Icon: z.string().min(1),
  RefNumber: z.string().optional().default(""),
  PaymentChannel: z.string().optional().default(""),
  Amount: z.coerce.number().optional().default(0),
});
export type RegisterTournamentInput = z.infer<
  typeof registerTournamentInputSchema
>;
