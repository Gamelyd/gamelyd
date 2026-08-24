"use client";

import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
}: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${width} rounded-2xl border border-surface-2 bg-surface p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="text-body transition-colors hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
