"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant =
  | "default"
  | "dark"
  | "pink"
  | "green"
  | "active"
  | "danger"
  | "outline";

const variants: Record<Variant, string> = {
  default:
    "bg-primary text-[#04201e] hover:bg-primary-dark disabled:opacity-60",
  dark: "bg-surface-3 text-white hover:bg-surface-2 disabled:opacity-60",
  pink: "bg-pink text-white hover:bg-pink-deep disabled:opacity-60",
  green: "bg-win-deep text-white hover:bg-win disabled:opacity-60",
  active: "bg-primary-deep text-white hover:bg-primary-dark disabled:opacity-60",
  danger: "bg-lose text-white hover:bg-lose-deep disabled:opacity-60",
  outline:
    "border border-primary text-primary hover:bg-primary hover:text-[#04201e] disabled:opacity-60",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "default",
  fullWidth = false,
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {loading && (
        <span className="h-4 w-4 animate-[gamelyd-spin_0.7s_linear_infinite] rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
