import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { wlEnv } from "./env";

// Whisperly's own mailer and templates (uses the same SMTP server settings as gamelyd).
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const s = wlEnv.smtp;
    transporter = nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.port === 465,
      auth: s.user ? { user: s.user, pass: s.pass } : undefined,
    });
  }
  return transporter;
}

/** Never throws into request handling - email is a side effect. */
async function send(to: string, subject: string, body: string): Promise<boolean> {
  try {
    await getTransporter().sendMail({ from: wlEnv.smtp.from, to, subject, html: layout(subject, body) });
    return true;
  } catch (error) {
    console.error("[whisperly] email failed:", error);
    return false;
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f5fb;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:520px;background:#fff;border-radius:14px;padding:28px" cellpadding="0" cellspacing="0"><tr><td>
<div style="font-weight:700;font-size:18px;color:#5b5bd6;margin-bottom:16px">Whisperly</div>
<h1 style="font-size:20px;margin:0 0 12px;color:#111">${esc(title)}</h1>
<div style="font-size:15px;line-height:1.6;color:#333">${body}</div>
</td></tr></table></td></tr></table></body></html>`;
}

export function sendWelcome(to: string, name: string): Promise<boolean> {
  return send(
    to,
    "Your Whisperly account is waiting for approval",
    `<p>Hi ${esc(name)},</p><p>Thanks for creating your Whisperly account. An admin will review it shortly - you'll get an email when your access is ready.</p>`,
  );
}

export function sendAccessGranted(to: string, name: string): Promise<boolean> {
  return send(
    to,
    "Your Whisperly access is ready",
    `<p>Hi ${esc(name)},</p><p>Your account has been approved. Open Whisperly and you're good to go.</p>`,
  );
}

export function sendResetCode(to: string, name: string, code: string): Promise<boolean> {
  return send(
    to,
    "Your Whisperly reset code",
    `<p>Hi ${esc(name)},</p><p>Enter this code in Whisperly to reset your password:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">${esc(code)}</p>
<p>It expires in 15 minutes. If you didn't ask for this, you can ignore this email.</p>`,
  );
}

export function notifyAdminNewSignup(name: string, email: string): Promise<boolean> {
  const to = wlEnv.adminNotifyEmail;
  if (!to) return Promise.resolve(false);
  return send(
    to,
    "New Whisperly account waiting for approval",
    `<p>${esc(name)} (${esc(email)}) just created an account. Open Whisperly → Admin to approve it.</p>`,
  );
}
