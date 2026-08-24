/**
 * Shared password strength rules used by both client-side form validation and
 * the server-side Zod schemas so the two never drift apart.
 */

export interface PasswordRule {
  id: string;
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_MIN_LENGTH = 8;

export const passwordRules: PasswordRule[] = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (v) => v.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "lowercase",
    label: "A lowercase letter",
    test: (v) => /[a-z]/.test(v),
  },
  {
    id: "uppercase",
    label: "An uppercase letter",
    test: (v) => /[A-Z]/.test(v),
  },
  {
    id: "number",
    label: "A number",
    test: (v) => /[0-9]/.test(v),
  },
  {
    id: "symbol",
    label: "A symbol (e.g. !?@#$)",
    test: (v) => /[^A-Za-z0-9]/.test(v),
  },
];

/** True only when every rule passes. */
export function isStrongPassword(value: string): boolean {
  return passwordRules.every((rule) => rule.test(value));
}

/** First unmet rule's label, or null when the password is strong. */
export function firstPasswordError(value: string): string | null {
  const failed = passwordRules.find((rule) => !rule.test(value));
  return failed ? failed.label : null;
}

/** 0-4 strength score based on how many rules (beyond length) are met. */
export function passwordStrength(value: string): {
  score: number;
  label: string;
} {
  if (!value) return { score: 0, label: "" };
  const passed = passwordRules.filter((rule) => rule.test(value)).length;
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong", "Strong"];
  return { score: passed, label: labels[passed] ?? "Strong" };
}
