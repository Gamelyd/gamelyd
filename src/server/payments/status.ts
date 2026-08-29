import "server-only";
import { CURRENCY_CODES } from "@/lib/schemas/common";
import type { PaymentsStatus } from "@/lib/schemas/payment";
import { processorForCurrency } from "@/lib/fees";
import { stripeEnabled } from "./stripe";
import { paystackEnabled } from "./paystack";
import {
  getEnabledEventTypes,
  getPlatformFeeBps,
} from "@/server/services/settingsService";

/**
 * Which money options this deployment can honour, derived purely from which
 * processor keys are present.
 *
 * Lives in its own module rather than in `paymentService` because
 * `tournamentService` needs it at create time, and `paymentService` already
 * imports `tournamentService`; putting it there would close an import cycle.
 */
export async function paymentsStatus(): Promise<PaymentsStatus> {
  const stripe = stripeEnabled();
  const paystack = paystackEnabled();
  const [feeBps, types] = await Promise.all([
    getPlatformFeeBps(),
    getEnabledEventTypes(),
  ]);
  return {
    stripe,
    paystack,
    currencies: CURRENCY_CODES.filter((code) =>
      processorForCurrency(code) === "STRIPE" ? stripe : paystack,
    ),
    feeBps,
    paidEnabled: types.paid,
    sponsoredEnabled: types.sponsored,
  };
}
