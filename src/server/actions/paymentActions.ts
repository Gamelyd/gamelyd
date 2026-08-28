"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult } from "@/lib/result";
import { startEntryCheckoutInputSchema } from "@/lib/schemas/payment";
import type { PayoutRecord } from "@/lib/schemas/payment";
import { getSessionClaims } from "@/server/auth/session";
import { ServiceError } from "@/server/services/userService";
import {
  fulfillByProcessorRef,
  listTournamentPayouts,
  startEntryCheckout,
  startSponsorCheckout,
} from "@/server/services/paymentService";
import { parseCurrency } from "@/lib/currency";

export async function startEntryCheckoutAction(
  tournamentId: string,
  input: unknown,
): Promise<ActionResult<{ checkoutUrl: string }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const parsed = parseInput(startEntryCheckoutInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await startEntryCheckout(claims.uid, tournamentId, parsed.data));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not start checkout");
  }
}

export async function startSponsorCheckoutAction(
  tournamentId: string,
): Promise<ActionResult<{ checkoutUrl: string }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    return ok(await startSponsorCheckout(claims.uid, tournamentId));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not start prize-pool checkout");
  }
}

export async function listTournamentPayoutsAction(
  tournamentId: string,
): Promise<ActionResult<PayoutRecord[]>> {
  try {
    const rows = await listTournamentPayouts(tournamentId);
    return ok(
      rows.map((row) => ({
        payout_id: row.payout_id,
        tournamentId: row.tournamentId,
        place: row.place,
        teamName: row.teamName,
        amount: row.amount,
        currency: parseCurrency(row.currency),
        status: row.status,
        note: row.note,
      })),
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not load payouts");
  }
}

export async function confirmPaystackPaymentAction(
  reference: string,
): Promise<ActionResult<{ ok: true }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    await fulfillByProcessorRef(reference);
    return ok({ ok: true });
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not confirm payment");
  }
}
