"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const styles: Record<ToastType, string> = {
  success: "border-primary bg-nav text-white",
  error: "border-lose bg-nav text-white",
  info: "border-yellow bg-nav text-white",
};

const accents: Record<ToastType, string> = {
  success: "bg-primary",
  error: "bg-lose",
  info: "bg-yellow",
};

/** Never let toasts cover the screen, however they were triggered. */
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }].slice(-MAX_VISIBLE));
    const ms = type === "error" && message.length > 80 ? 9000 : 5000;
    timers.current.push(
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, ms),
    );
  }, []);

  /**
   * Memoised so `toast` keeps a stable identity. A fresh object here would
   * change on every render, and any effect listing `toast` in its dependencies
   * would re-run, toast again, and re-render, an infinite loop.
   */
  const value = useMemo<ToastContextValue>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed top-20 right-4 z-200 flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-2 sm:right-5"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex overflow-hidden rounded-xl border shadow-[0_12px_40px_-12px_rgba(0,0,0,0.85)] ${styles[t.type]}`}
          >
            <span className={`w-1.5 shrink-0 ${accents[t.type]}`} />
            <p className="min-w-0 flex-1 px-4 py-3 text-sm font-medium leading-snug whitespace-pre-wrap">
              {t.message}
            </p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 px-3 text-body hover:text-white"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
