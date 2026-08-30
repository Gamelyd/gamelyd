import { z } from "zod";
import { currencySchema, type Currency } from "./common";
import { registerTournamentInputSchema } from "./register";

export const processorSchema = z.enum(["STRIPE", "PAYSTACK"]);
export type Processor = z.infer<typeof processorSchema>;

export const paymentKindSchema = z.enum([
  "ENTRY",
  "SPONSOR_FUND",
  "ONE_OFF",
]);
export type PaymentKind = z.infer<typeof paymentKindSchema>;

export const paymentStatusSchema = z.enum([
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const payoutStatusSchema = z.enum([
  "OWED",
  "PROCESSING",
  "PAID",
  "FAILED",
]);
export type PayoutStatus = z.infer<typeof payoutStatusSchema>;

export const payoutAccountStatusSchema = z.enum([
  "PENDING",
  "VERIFIED",
  "FAILED",
]);
export type PayoutAccountStatus = z.infer<typeof payoutAccountStatusSchema>;

export const payoutAccountSchema = z.object({
  account_id: z.string(),
  user_id: z.string(),
  processor: processorSchema,
  status: payoutAccountStatusSchema,
  bank_name: z.string().default(""),
  account_last4: z.string().default(""),
  account_name: z.string().default(""),
  currency: currencySchema,
  country: z.string().default(""),
  detail: z.string().default(""),
  created_at: z.string().default(""),
});
export type PayoutAccount = z.infer<typeof payoutAccountSchema>;

/**
 * Which processors this deployment can actually charge and pay out with. Drives
 * whether paid/sponsored events can be created at all, so a host is never
 * offered a money option that would dead-end at checkout.
 */
export interface PaymentsStatus {
  stripe: boolean;
  paystack: boolean;
  /** Currencies whose processor is configured right now. */
  currencies: Currency[];
  /** The rate a tournament created right now would be stamped with. */
  feeBps: number;
  /** Admin switches. False means "temporarily off", not "misconfigured". */
  paidEnabled: boolean;
  sponsoredEnabled: boolean;
}

/** Counts behind the admin payout desk's summary tiles. */
export interface PayoutTotals {
  owed: number;
  processing: number;
  paid: number;
  failed: number;
  /** Owed lines whose recipient has not connected an account yet. */
  needsAccount: number;
}

export const bankOptionSchema = z.object({
  name: z.string(),
  code: z.string(),
});
export type BankOption = z.infer<typeof bankOptionSchema>;

/** Paystack currencies: the captain supplies bank details we resolve. */
export const connectBankAccountInputSchema = z.object({
  currency: currencySchema,
  bank_code: z.string().min(1, "Pick your bank"),
  account_number: z
    .string()
    .trim()
    .regex(/^\d{8,20}$/, "Enter your account number (digits only)"),
});
export type ConnectBankAccountInput = z.infer<
  typeof connectBankAccountInputSchema
>;

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
  tournamentName: z.string().default(""),
  place: z.number().int(),
  teamName: z.string(),
  userId: z.string().default(""),
  userName: z.string().default(""),
  amount: z.number(),
  currency: currencySchema,
  status: payoutStatusSchema,
  note: z.string().default(""),
  transferRef: z.string().default(""),
  failureReason: z.string().default(""),
  paid_at: z.string().default(""),
  created_at: z.string().default(""),
  /** Admin view only: whether the recipient can actually be paid right now. */
  recipientReady: z.boolean().default(false),
});
export type PayoutRecord = z.infer<typeof payoutSchema>;

export const startEntryCheckoutInputSchema = z.object({
  Players: registerTournamentInputSchema.shape.Players,
  TeamName: registerTournamentInputSchema.shape.TeamName,
  Icon: registerTournamentInputSchema.shape.Icon,
  /** When set, the roster is resolved from the captain's saved team instead. */
  SavedTeamId: z.string().optional().default(""),
});
export type StartEntryCheckoutInput = z.infer<
  typeof startEntryCheckoutInputSchema
>;
