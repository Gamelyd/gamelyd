import { z } from "zod";
import { currencySchema } from "./common";
import { registerTournamentInputSchema } from "./register";

export const processorSchema = z.enum(["STRIPE", "PAYSTACK"]);
export type Processor = z.infer<typeof processorSchema>;

export const paymentKindSchema = z.enum(["ENTRY", "SPONSOR_FUND"]);
export type PaymentKind = z.infer<typeof paymentKindSchema>;

export const paymentStatusSchema = z.enum([
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const payoutStatusSchema = z.enum(["OWED", "PAID", "FAILED"]);
export type PayoutStatus = z.infer<typeof payoutStatusSchema>;

export const paymentSchema = z.object({
  payment_id: z.string(),
  kind: paymentKindSchema,
  status: paymentStatusSchema,
  processor: processorSchema,
  currency: currencySchema,
  tournamentId: z.string(),
  userId: z.string(),
  amount: z.number(),
  fee: z.number(),
  net: z.number(),
  processorRef: z.string().default(""),
  created_at: z.string(),
});
export type PaymentRecord = z.infer<typeof paymentSchema>;

export const payoutSchema = z.object({
  payout_id: z.string(),
  tournamentId: z.string(),
  place: z.number().int(),
  teamName: z.string(),
  amount: z.number(),
  currency: currencySchema,
  status: payoutStatusSchema,
  note: z.string().default(""),
});
export type PayoutRecord = z.infer<typeof payoutSchema>;

export const startEntryCheckoutInputSchema = z.object({
  Players: registerTournamentInputSchema.shape.Players,
  TeamName: registerTournamentInputSchema.shape.TeamName,
  Icon: registerTournamentInputSchema.shape.Icon,
});
export type StartEntryCheckoutInput = z.infer<
  typeof startEntryCheckoutInputSchema
>;
