import { apiFail, apiOk } from "@/lib/apiJson";
import { verifyPaystackSignature } from "@/server/payments/paystack";
import { fulfillByProcessorRef } from "@/server/services/paymentService";
import { resolveTransferOutcome } from "@/server/services/payoutService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  if (!verifyPaystackSignature(raw, signature)) {
    return apiFail("Invalid Paystack signature", 400);
  }
  let payload: {
    event?: string;
    data?: { reference?: string; transfer_code?: string; reason?: string };
  };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    return apiFail("Invalid JSON", 400);
  }

  try {
    if (payload.event === "charge.success" && payload.data?.reference) {
      await fulfillByProcessorRef(payload.data.reference);
    }
    // Paystack transfers settle asynchronously; these events are what actually
    // decide whether a winner got paid.
    if (payload.event === "transfer.success" && payload.data?.reference) {
      await resolveTransferOutcome(payload.data.reference, "PAID", "");
    }
    if (
      (payload.event === "transfer.failed" ||
        payload.event === "transfer.reversed") &&
      payload.data?.reference
    ) {
      await resolveTransferOutcome(
        payload.data.reference,
        "FAILED",
        payload.data.reason || "Paystack reported the transfer failed",
      );
    }
  } catch (error) {
    console.error(error);
    return apiFail("Webhook handling failed", 500);
  }
  return apiOk({ received: true });
}
