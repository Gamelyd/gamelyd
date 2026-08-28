import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { payments } from "@/server/db";
import { fulfillByProcessorRef } from "@/server/services/paymentService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const reference =
    url.searchParams.get("reference") || url.searchParams.get("trxref") || "";
  const fallback = `${env.appUrl.replace(/\/$/, "")}/`;
  if (!reference) return NextResponse.redirect(fallback);
  try {
    await fulfillByProcessorRef(reference);
  } catch (error) {
    console.error(error);
  }
  const doc =
    (await (await payments()).findOne({ processorRef: reference })) ??
    (await (await payments()).findOne({ payment_id: reference }));
  const dest = doc
    ? `${env.appUrl.replace(/\/$/, "")}/tournament/${doc.tournamentId}?checkout=success`
    : `${fallback}?checkout=unknown`;
  return NextResponse.redirect(dest);
}
