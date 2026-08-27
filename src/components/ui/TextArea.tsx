"use client";

import type { TextareaHTMLAttributes } from "react";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function TextArea({
  label,
  error,
  className = "",
  ...rest
}: TextAreaProps) {
  return (
    <label className="block w-full">
      {label && (
        <span className="mb-1.5 block text-sm text-label">{label}</span>
      )}
      <textarea
        {...rest}
        className={`w-full rounded-lg border border-primary/25 bg-input px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-body/50 focus:border-primary ${error ? "border-lose" : ""} ${className}`}
      />
      {error && <span className="mt-1 block text-xs text-lose">{error}</span>}
    </label>
  );
}
