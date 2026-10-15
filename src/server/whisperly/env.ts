import "server-only";

/**
 * Whisperly settings. Separate from gamelyd's env.ts on purpose - Whisperly
 * shares only the MongoDB server (MONGODB_URL) and the SMTP server (SMTP_*).
 * Getters, so nothing is validated until it's actually used at runtime.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

export const wlEnv = {
  get mongodbUrl(): string {
    return required("MONGODB_URL");
  },
  /** Whisperly's collections live here (defaults to gamelyd's DB_NAME, with whisperly_* collection names). */
  get dbName(): string {
    return optional("WHISPERLY_DB_NAME", optional("DB_NAME", "cluster0"));
  },
  get secretKey(): string {
    return required("WHISPERLY_SECRET_KEY");
  },
  get smtp() {
    return {
      host: optional("SMTP_HOST", "gamelyd.com"),
      port: Number(optional("SMTP_PORT", "587")),
      user: optional("SMTP_USER", ""),
      pass: optional("SMTP_PASS", ""),
      from: optional("WHISPERLY_MAIL_FROM", optional("MAIL_FROM", "no-reply@gamelyd.com")),
    };
  },
  get adminNotifyEmail(): string {
    return optional("WHISPERLY_ADMIN_NOTIFY_EMAIL", "");
  },
  /** Emails that are always admin (comma-separated). They're also given access automatically. */
  get adminEmails(): string[] {
    return optional("WHISPERLY_ADMIN_EMAILS", "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },
  get minAppVersion(): string {
    return optional("WHISPERLY_MIN_APP_VERSION", "0.0.0");
  },
  get moveCooldownDays(): number {
    const n = Number(optional("WHISPERLY_MOVE_COOLDOWN_DAYS", "30"));
    return Number.isFinite(n) && n >= 0 ? n : 30;
  },
  get paymentsEnabled(): boolean {
    return optional("WHISPERLY_PAYMENTS_ENABLED", "false") === "true";
  },
  get stripeSecretKey(): string {
    return optional("WHISPERLY_STRIPE_SECRET_KEY", "");
  },
  get stripePriceId(): string {
    return optional("WHISPERLY_STRIPE_PRICE_ID", "");
  },
  get stripeWebhookSecret(): string {
    return optional("WHISPERLY_STRIPE_WEBHOOK_SECRET", "");
  },
  /** Public base URL of this API (for Stripe return pages). */
  get publicUrl(): string {
    return optional("WHISPERLY_PUBLIC_URL", optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"));
  },
} as const;
