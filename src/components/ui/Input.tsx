"use client";

import type { ChangeEvent, FocusEvent, InputHTMLAttributes } from "react";
import {
  DateInput,
  DateTimeInput,
  TimeInput,
} from "@/components/ui/DateTimePicker";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", id, ...rest }: InputProps) {
  if (
    rest.type === "date" ||
    rest.type === "time" ||
    rest.type === "datetime-local"
  ) {
    const Picker =
      rest.type === "time"
        ? TimeInput
        : rest.type === "datetime-local"
          ? DateTimeInput
          : DateInput;
    return (
      <Picker
        label={label}
        error={error}
        className={className}
        id={id}
        name={rest.name}
        value={String(rest.value ?? "")}
        disabled={rest.disabled}
        required={rest.required}
        min={typeof rest.min === "string" ? rest.min : undefined}
        max={typeof rest.max === "string" ? rest.max : undefined}
        placeholder={rest.placeholder}
        onChange={(event) =>
          rest.onChange?.(event as ChangeEvent<HTMLInputElement>)
        }
        onBlur={() => rest.onBlur?.({} as FocusEvent<HTMLInputElement>)}
      />
    );
  }

  return (
    <label className="block w-full">
      {label && (
        <span className="mb-1.5 block text-sm text-label">{label}</span>
      )}
      <input
        id={id}
        {...rest}
        className={`w-full rounded-lg border border-primary/25 bg-input px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-body/50 focus:border-primary ${error ? "border-lose" : ""} ${className}`}
      />
      {error && <span className="mt-1 block text-xs text-lose">{error}</span>}
    </label>
  );
}
