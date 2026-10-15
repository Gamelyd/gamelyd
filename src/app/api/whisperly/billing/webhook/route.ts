import { handle } from "@/server/whisperly/http";
import { billingWebhook } from "@/server/whisperly/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe expects a plain 2xx JSON acknowledgement.
export const POST = handle(async (req) => Response.json(await billingWebhook(req)));
