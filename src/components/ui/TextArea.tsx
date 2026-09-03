"use client";

import type { TextareaHTMLAttributes } from "react";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  /** Set false to keep the limit enforced but hide the running count. */
  showCount?: boolean;
}

export function TextArea({
  label,
  error,
  className = "",
  showCount = true,
  ...rest
}: TextAreaProps) {
  /*
   * A counter only makes sense for a controlled field, where the value is
   * known on render. Uncontrolled ones still get the maxLength.
   */
  const limit =
    typeof rest.maxLength === "number" && rest.maxLength > 0
      ? rest.maxLength
      : null;
  const used = typeof rest.value === "string" ? rest.value.length : null;
  const counted = showCount && limit !== null && used !== null;
  const nearLimit = counted && used > limit * 0.9;

  return (
    <label className="block w-full">
      {label && (
        <span className="mb-1.5 block text-sm text-label">{label}</span>
      )}
      <textarea
        {...rest}
        className={`w-full rounded-lg border border-primary/25 bg-input px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-body/50 focus:border-primary ${error ? "border-lose" : ""} ${className}`}
      />
      <span className="mt-1 flex items-start justify-between gap-3">
        {error ? (
          <span className="text-xs text-lose">{error}</span>
        ) : (
          <span />
        )}
        {counted ? (
          <span
            className={`shrink-0 text-xs tabular-nums ${
              nearLimit ? "text-yellow" : "text-body/60"
            }`}
          >
            {used} / {limit}
          </span>
        ) : null}
      </span>
    </label>
  );
}
