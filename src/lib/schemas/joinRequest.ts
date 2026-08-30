import { z } from "zod";
import { playerSchema } from "./draw";

export const joinRequestSchema = z.object({
  JoinRequestId: z.string(),
  TournamentId: z.string(),
  User_id: z.string(),
  UserName: z.string().default(""),
  TeamName: z.string(),
  Players: z.array(playerSchema).default([]),
  Icon: z.string().default(""),
  Created_at: z.string(),
});
export type JoinRequest = z.infer<typeof joinRequestSchema>;
