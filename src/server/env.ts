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

export const env = {
  mongodbUrl: required("MONGODB_URL"),
  dbName: optional("DB_NAME", "cluster0"),
  secretKey: required("SECRET_KEY"),
  smtp: {
    host: optional("SMTP_HOST", "gamelyd.co"),
    port: Number(optional("SMTP_PORT", "587")),
    user: optional("SMTP_USER", "no-reply@gamelyd.co"),
    pass: optional("SMTP_PASS", ""),
    from: optional("MAIL_FROM", "no-reply@gamelyd.co"),
    adminEmail: optional("ADMIN_EMAIL", "madumcbobby@yahoo.com"),
  },
  appUrl: optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
} as const;
