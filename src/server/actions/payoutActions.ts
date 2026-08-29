"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult, type Paginated } from "@/lib/result";
import {
  connectBankAccountInputSchema,
  type BankOption,
  type PayoutAccount,
  type PayoutRecord,
  type PayoutStatus,
  type PayoutTotals,
} from "@/lib/schemas/payment";
import { currencySchema, type Currency } from "@/lib/schemas/common";
import { getSessionClaims } from "@/server/auth/session";
import { guardAdmin } from "@/server/auth/admin";
import { ServiceError } from "@/server/services/userService";
import {
  canReceivePayout,
  connectBankAccount,
  listBanksForCurrency,
  listMyPayoutAccounts,
  refreshStripePayoutAccount,
  removePayoutAccount,
  startStripePayoutOnboarding,
} from "@/server/services/payoutAccountService";
import {
  disbursePayout,
  listMyPayouts,
  listPayoutsAdmin,
  markPayoutPaidManually,
  payoutTotals,
} from "@/server/services/payoutService";
import { processorForCurrency } from "@/lib/fees";

/* --------------------------- payout accounts --------------------------- */

export async function myPayoutAccountsAction(): Promise<
  ActionResult<PayoutAccount[]>
> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    return ok(await listMyPayoutAccounts(claims.uid));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not load your payout accounts");
  }
}

export async function listBanksAction(
  currency: string,
): Promise<ActionResult<BankOption[]>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const parsed = currencySchema.safeParse((currency || "").toUpperCase());
  if (!parsed.success) return fail("Pick a currency");
  try {
    return ok(await listBanksForCurrency(parsed.data));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not load the bank list");
  }
}

export async function connectBankAccountAction(
  input: unknown,
): Promise<ActionResult<PayoutAccount>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const parsed = parseInput(connectBankAccountInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(
      await connectBankAccount(claims.uid, parsed.data),
      "Payout account connected",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not connect that account");
  }
}

export async function startStripePayoutOnboardingAction(): Promise<
  ActionResult<{ url: string }>
> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    return ok(await startStripePayoutOnboarding(claims.uid));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not start Stripe onboarding");
  }
}

export async function refreshStripePayoutAccountAction(): Promise<
  ActionResult<PayoutAccount | null>
> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    return ok(await refreshStripePayoutAccount(claims.uid));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not refresh your Stripe account");
  }
}

export async function removePayoutAccountAction(
  currency: string,
): Promise<ActionResult<{ ok: true }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const parsed = currencySchema.safeParse((currency || "").toUpperCase());
  if (!parsed.success) return fail("Pick a currency");
  try {
    await removePayoutAccount(
      claims.uid,
      processorForCurrency(parsed.data as Currency),
    );
    return ok({ ok: true } as const, "Payout account removed");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not remove that account");
  }
}

/**
 * Whether the signed-in user could be paid in this currency today. The register
 * form asks before showing a pay button, so the requirement is visible up front
 * rather than as a rejection at checkout.
 */
export async function canReceivePayoutAction(
  currency: string,
): Promise<ActionResult<boolean>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const parsed = currencySchema.safeParse((currency || "").toUpperCase());
  if (!parsed.success) return fail("Pick a currency");
  try {
    return ok(await canReceivePayout(claims.uid, parsed.data));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not check your payout account");
  }
}

export async function myPayoutsAction(): Promise<ActionResult<PayoutRecord[]>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    return ok(await listMyPayouts(claims.uid));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not load your prize money");
  }
}

/* ----------------------------- admin desk ----------------------------- */

export async function adminListPayoutsAction(
  status: PayoutStatus | "ALL" = "OWED",
  search = "",
  page = 1,
): Promise<ActionResult<Paginated<PayoutRecord>>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    return ok(await listPayoutsAdmin({ status, search, page }));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not load payouts");
  }
}

export async function adminPayoutTotalsAction(): Promise<
  ActionResult<PayoutTotals>
> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    return ok(await payoutTotals());
  } catch (error) {
    console.error(error);
    return fail("Could not load payout totals");
  }
}

export async function adminDisbursePayoutAction(
  payoutId: string,
): Promise<ActionResult<PayoutRecord>> {
  const admin = await guardAdmin();
  if (!admin) return fail("Admin access required");
  try {
    return ok(await disbursePayout(payoutId, admin.uid), "Transfer sent");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not send that payout");
  }
}

/** Bulk send. Each row is attempted on its own so one failure does not stop the rest. */
export async function adminDisbursePayoutsAction(
  payoutIds: string[],
): Promise<ActionResult<{ sent: number; failed: { id: string; error: string }[] }>> {
  const admin = await guardAdmin();
  if (!admin) return fail("Admin access required");
  const ids = [...new Set(payoutIds.filter((id) => id.length > 0))].slice(0, 50);
  if (ids.length === 0) return fail("Select at least one payout");

  let sent = 0;
  const failed: { id: string; error: string }[] = [];
  for (const id of ids) {
    try {
      await disbursePayout(id, admin.uid);
      sent += 1;
    } catch (error) {
      failed.push({
        id,
        error:
          error instanceof ServiceError
            ? error.message
            : "The transfer was rejected",
      });
    }
  }
  return ok(
    { sent, failed },
    failed.length === 0
      ? `Sent ${sent} payout${sent === 1 ? "" : "s"}`
      : `Sent ${sent}, ${failed.length} failed`,
  );
}

export async function adminMarkPayoutPaidAction(
  payoutId: string,
  reference: string,
): Promise<ActionResult<PayoutRecord>> {
  const admin = await guardAdmin();
  if (!admin) return fail("Admin access required");
  try {
    return ok(
      await markPayoutPaidManually(payoutId, admin.uid, reference.trim()),
      "Marked as paid",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not update that payout");
  }
}
