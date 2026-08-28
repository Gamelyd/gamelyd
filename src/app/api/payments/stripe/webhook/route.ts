import { apiFail, apiOk } from "@/lib/apiJson";
import { constructStripeEvent } from "@/server/payments/stripe";
import { fulfillPayment } from "@/server/services/paymentService";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = constructStripeEvent(raw, signature);
  } catch (error) {
    console.error(error);
    return apiFail("Invalid Stripe signature", 400);
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid" && event.type === "checkout.session.completed") {
      if (session.payment_status !== "no_payment_required") {
        return apiOk({ received: true });
      }
    }
    const paymentId =
      session.metadata?.payment_id || session.client_reference_id || "";
    if (!paymentId) return apiOk({ received: true });
    try {
      await fulfillPayment(paymentId);
    } catch (error) {
      console.error(error);
      return apiFail("Fulfillment failed", 500);
    }
  }

  return apiOk({ received: true });
}
