import "server-only";
import { createRateLimiter } from "@/lib/whisperly/rateLimit";
import { WlError } from "./http";

const TEN_MIN = 10 * 60 * 1000;

// Per process (each pod has its own counters) - enough to slow down guessing and email spam.
const byIp = createRateLimiter({ max: 40, windowMs: TEN_MIN });
// Per email, only FAILED attempts count (wrong password / wrong code), so normal use never trips it.
const failuresByEmail = createRateLimiter({ max: 10, windowMs: TEN_MIN });
const emailsSent = createRateLimiter({ max: 3, windowMs: 15 * 60 * 1000 });

export function limitAuth(ip: string, email?: string): void {
  if (!byIp.hit(`ip:${ip}`) || (email && failuresByEmail.blocked(`em:${email}`))) {
    throw new WlError("RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.", 429);
  }
}

/** Call after a wrong password or wrong reset code. */
export function recordFailure(email: string): void {
  failuresByEmail.hit(`em:${email}`);
}

/** Separate, stricter limit for anything that sends an email (reset codes). */
export function limitEmails(email: string): boolean {
  return emailsSent.hit(`mail:${email}`);
}
