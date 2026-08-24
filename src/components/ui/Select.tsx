"use client";

import type { SelectHTMLAttributes } from "react";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
}

export function Select({
  label,
  options,
  error,
  className = "",
  ...rest
}: SelectProps) {
  return (
    <label className="block w-full">
      {label && (
        <span className="mb-1.5 block text-sm text-label">{label}</span>
      )}
      <select
        {...rest}
        className={`w-full rounded-lg border border-transparent bg-input px-4 py-3 text-sm text-white outline-none transition-colors focus:border-primary ${error ? "border-lose" : ""} ${className}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-input">
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 block text-xs text-lose">{error}</span>}
    </label>
  );
}
