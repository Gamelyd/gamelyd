export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Where Stripe Checkout sends the browser back to. Whisperly picks up the new plan at its next licence check. */
export async function GET(req: Request) {
  const ok = new URL(req.url).searchParams.get("status") === "success";
  const title = ok ? "Payment complete" : "Payment cancelled";
  const text = ok ? "You can close this tab and go back to Whisperly." : "No payment was taken. You can close this tab.";
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font-family:-apple-system,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#15161a;color:#ececf1"><div style="text-align:center"><h1>${title}</h1><p>${text}</p></div></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}
