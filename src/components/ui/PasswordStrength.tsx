"use client";

import { passwordRules, passwordStrength } from "@/lib/password";

const barColors = [
  "bg-lose",
  "bg-lose",
  "bg-yellow",
  "bg-yellow",
  "bg-win",
  "bg-win",
];

export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const { score, label } = passwordStrength(value);
  const pct = (score / passwordRules.length) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full transition-all ${barColors[score]}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-16 text-right text-xs text-body">{label}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {passwordRules.map((rule) => {
          const met = rule.test(value);
          return (
            <li
              key={rule.id}
              className={`flex items-center gap-1.5 text-xs ${met ? "text-win" : "text-body"}`}
            >
              <span aria-hidden="true">{met ? "✓" : "○"}</span>
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
