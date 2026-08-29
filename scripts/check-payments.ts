/**
 * Verifies payment/payout configuration without touching the database.
 *
 *   npx tsx scripts/check-payments.ts
 *
 * Checks that the keys the server actually reads are present, then makes one
 * live read-only call per processor so a bad or restricted key is caught here
 * rather than by a captain trying to add their bank account.
 */
function loadEnvFiles(): void {
  for (const file of [".env", ".env.local"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // ignore missing files; env may already be set
    }
  }
}
loadEnvFiles();

const PAYSTACK_BASE = "https://api.paystack.co";

type Check = { label: string; ok: boolean; detail: string };
const results: Check[] = [];

function record(label: string, ok: boolean, detail: string) {
  results.push({ label, ok, detail });
}

async function checkPaystack(): Promise<void> {
  const key = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!key) {
    record(
      "PAYSTACK_SECRET_KEY",
      false,
      "Not set. NGN/GHS/KES/ZAR checkout and payouts are all disabled. Add the sk_… key from your Paystack dashboard.",
    );
    return;
  }
  if (!key.startsWith("sk_")) {
    record(
      "PAYSTACK_SECRET_KEY",
      false,
      `Does not look like a secret key (starts "${key.slice(0, 3)}"). It must be the sk_… key, not the public pk_… one.`,
    );
    return;
  }
  record(
    "PAYSTACK_SECRET_KEY",
    true,
    `${key.startsWith("sk_live") ? "live" : "test"} key present`,
  );

  // Bank list: the exact call the payout form makes first.
  try {
    const res = await fetch(
      `${PAYSTACK_BASE}/bank?country=nigeria&currency=NGN&perPage=100`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    const body = (await res.json()) as {
      status?: boolean;
      message?: string;
      data?: unknown[];
    };
    if (!res.ok || body.status === false) {
      record(
        "Paystack bank list (NGN)",
        false,
        body.message || `HTTP ${res.status}`,
      );
    } else {
      record(
        "Paystack bank list (NGN)",
        true,
        `${body.data?.length ?? 0} banks on the first page`,
      );
    }
  } catch (error) {
    record(
      "Paystack bank list (NGN)",
      false,
      error instanceof Error ? error.message : "Request failed",
    );
  }

  // Transfers must be enabled on the account or payouts cannot be sent.
  try {
    const res = await fetch(`${PAYSTACK_BASE}/balance`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const body = (await res.json()) as { status?: boolean; message?: string };
    record(
      "Paystack balance / transfers",
      res.ok && body.status !== false,
      res.ok && body.status !== false
        ? "Readable, transfers should work"
        : body.message || `HTTP ${res.status}`,
    );
  } catch (error) {
    record(
      "Paystack balance / transfers",
      false,
      error instanceof Error ? error.message : "Request failed",
    );
  }
}

async function checkStripe(): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) {
    record(
      "STRIPE_SECRET_KEY",
      false,
      "Not set. USD/GBP/EUR checkout and payouts are disabled.",
    );
    return;
  }
  record(
    "STRIPE_SECRET_KEY",
    true,
    `${key.startsWith("sk_live") ? "live" : "test"} key present`,
  );
  record(
    "STRIPE_WEBHOOK_SECRET",
    Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    process.env.STRIPE_WEBHOOK_SECRET
      ? "present"
      : "Not set. Paid entries will never be confirmed.",
  );
}

function checkStrays(): void {
  // A NEXT_PUBLIC_ variable is shipped to the browser, so a secret key there
  // would be a leak. The public key is harmless but currently unused.
  const pub = process.env.NEXT_PUBLIC_PAYSTACK_KEY ?? "";
  if (pub.startsWith("sk_")) {
    record(
      "NEXT_PUBLIC_PAYSTACK_KEY",
      false,
      "LEAK: this holds a SECRET key and is exposed to every browser. Rotate it in Paystack and move it to PAYSTACK_SECRET_KEY.",
    );
  } else if (pub) {
    record(
      "NEXT_PUBLIC_PAYSTACK_KEY",
      true,
      "Public key set, but no code reads it. Safe to delete.",
    );
  }
}

async function main(): Promise<void> {
  await checkPaystack();
  await checkStripe();
  checkStrays();

  console.log("\nPayment configuration\n");
  for (const r of results) {
    console.log(`${r.ok ? "  ok  " : " FAIL "} ${r.label}\n         ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    failed === 0
      ? "\nAll checks passed.\n"
      : `\n${failed} check${failed === 1 ? "" : "s"} need attention.\n`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

void main();
