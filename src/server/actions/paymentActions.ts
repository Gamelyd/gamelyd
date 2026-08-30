"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult } from "@/lib/result";
import { startEntryCheckoutInputSchema } from "@/lib/schemas/payment";
import { saveTournamentInputSchema } from "@/lib/schemas/tournament";
import type { PaymentsStatus, PayoutRecord } from "@/lib/schemas/payment";
import { getSessionClaims } from "@/server/auth/session";
import { ServiceError } from "@/server/services/userService";
import {
  fulfillByProcessorRef,
  listPayoutsForViewer,
  oneOffResult,
  startEntryCheckout,
  startOneOffTournamentCheckout,
  startSponsorCheckout,
} from "@/server/services/paymentService";
import { serializePayout } from "@/server/services/payoutService";
import { paymentsStatus } from "@/server/payments/status";

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

/**
 * What this deployment can charge in. Read by the create wizard so paid and
 * sponsored events are only offered when a processor is actually wired up.
 */
export async function paymentsStatusAction(): Promise<
  ActionResult<PaymentsStatus>
> {
  try {
    return ok(await paymentsStatus());
  } catch (error) {
    console.error(error);
    return fail("Could not check payment configuration");
  }
}

export async function listTournamentPayoutsAction(
  tournamentId: string,
): Promise<ActionResult<PayoutRecord[]>> {
  const claims = await getSessionClaims();
  // The board names winners and amounts - signed-out visitors see nothing.
  if (!claims) return ok([]);
  try {
    const rows = await listPayoutsForViewer(tournamentId, claims.uid);
    return ok(rows.map((row) => serializePayout(row)));
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

/** Pay once to create one tournament above the free limits, no subscription. */
export async function startOneOffTournamentCheckoutAction(
  input: unknown,
): Promise<ActionResult<{ checkoutUrl: string }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const parsed = parseInput(saveTournamentInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(
      await startOneOffTournamentCheckout(claims.uid, parsed.data),
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not start checkout");
  }
}

export async function oneOffTournamentResultAction(
  paymentId: string,
): Promise<ActionResult<{ status: string; tournamentId: string }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    return ok(await oneOffResult(claims.uid, paymentId));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not check that payment");
  }
}
