import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env";
import type { EmailContent } from "./templates";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user
        ? { user: env.smtp.user, pass: env.smtp.pass }
        : undefined,
    });
  }
  return transporter;
}

/**
 * Sends an email but never throws into request handling — email delivery is a
 * side effect and must not fail the primary action. Failures are logged.
 */
export async function sendEmail(
  to: string,
  content: EmailContent,
): Promise<boolean> {
  try {
    await getTransporter().sendMail({
      from: env.smtp.from,
      to,
      subject: content.subject,
      html: content.html,
    });
    return true;
  } catch (error) {
    console.error("[email] failed to send:", error);
    return false;
  }
}

export function adminEmail(): string {
  return env.smtp.adminEmail;
}
