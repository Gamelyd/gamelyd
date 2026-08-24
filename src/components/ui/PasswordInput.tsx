"use client";

import { useState, type InputHTMLAttributes } from "react";

interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a17.3 17.3 0 0 1-3.2 4.19" />
      <path d="M6.6 6.6A17.3 17.3 0 0 0 2 12s3.5 7 10 7a9.12 9.12 0 0 0 4.32-1.06" />
      <path d="M9.5 9.5a3 3 0 0 0 4.2 4.2" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function PasswordInput({
  label,
  error,
  className = "",
  id,
  ...rest
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <label className="block w-full">
      {label && (
        <span className="mb-1.5 block text-sm text-label">{label}</span>
      )}
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          {...rest}
          className={`w-full rounded-lg border border-transparent bg-input px-4 py-3 pr-11 text-sm text-white outline-none transition-colors placeholder:text-body/50 focus:border-primary ${error ? "border-lose" : ""} ${className}`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-body transition-colors hover:text-primary"
        >
          <EyeIcon open={show} />
        </button>
      </div>
      {error && <span className="mt-1 block text-xs text-lose">{error}</span>}
    </label>
  );
}
