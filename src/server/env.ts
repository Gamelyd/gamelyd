import "server-only";

/** Reads a required server env var, throwing a clear error if missing. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

/**
 * Env is exposed via getters so required variables are only validated when
 * they are actually read at runtime — not when this module is imported. This
 * lets `next build` collect page data without secrets present (they are
 * injected at runtime from Infisical / the container environment).
 */
export const env = {
  get mongodbUrl(): string {
    return required("MONGODB_URL");
  },
  get dbName(): string {
    return optional("DB_NAME", "cluster0");
  },
  get secretKey(): string {
    return required("SECRET_KEY");
  },
  get smtp() {
    return {
      host: optional("SMTP_HOST", "gamelyd.co"),
      port: Number(optional("SMTP_PORT", "587")),
      user: optional("SMTP_USER", "no-reply@gamelyd.co"),
      pass: optional("SMTP_PASS", ""),
      from: optional("MAIL_FROM", "no-reply@gamelyd.co"),
      adminEmail: optional("ADMIN_EMAIL", "madumcbobby@yahoo.com"),
    };
  },
  get appUrl(): string {
    return optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  },
} as const;
