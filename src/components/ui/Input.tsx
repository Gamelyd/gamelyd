"use client";

import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", id, ...rest }: InputProps) {
  return (
    <label className="block w-full">
      {label && (
        <span className="mb-1.5 block text-sm text-label">{label}</span>
      )}
      <input
        id={id}
        {...rest}
        className={`w-full rounded-lg border border-transparent bg-input px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-body/50 focus:border-primary ${error ? "border-lose" : ""} ${className}`}
      />
      {error && <span className="mt-1 block text-xs text-lose">{error}</span>}
    </label>
  );
}
