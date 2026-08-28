import { apiFail, apiOk } from "@/lib/apiJson";
import { verifyPaystackSignature } from "@/server/payments/paystack";
import { fulfillByProcessorRef } from "@/server/services/paymentService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  if (!verifyPaystackSignature(raw, signature)) {
    return apiFail("Invalid Paystack signature", 400);
  }
  let payload: { event?: string; data?: { reference?: string } };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    return apiFail("Invalid JSON", 400);
  }
  if (payload.event === "charge.success" && payload.data?.reference) {
    try {
      await fulfillByProcessorRef(payload.data.reference);
    } catch (error) {
      console.error(error);
      return apiFail("Fulfillment failed", 500);
    }
  }
  return apiOk({ received: true });
}
