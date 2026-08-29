"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { createPortal } from "react-dom";

export interface RowAction {
  label: string;
  onSelect: () => void;
  /** Renders in the destructive colour and sits below a divider. */
  danger?: boolean;
  disabled?: boolean;
  /** Shown under the label - use it to say why an action is unavailable. */
  hint?: string;
}

/**
 * The overflow menu that replaces a row of buttons in every admin table. Opens
 * in a portal so it is never clipped by the table's overflow container.
 */
export function RowMenu({
  actions,
  label = "Row actions",
  trigger,
}: {
  actions: RowAction[];
  label?: string;
  trigger?: ReactNode;
}) {
  // No `mounted` guard is needed: the portal only renders once `open` is true,
  // and that can only happen from a click, which is always post-hydration.
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = buttonRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const width = 224;
    const height = menuRef.current?.offsetHeight ?? 0;
    const left = Math.min(
      Math.max(anchor.right - width, 8),
      window.innerWidth - width - 8,
    );
    const below = anchor.bottom + 6;
    const flip = height > 0 && below + height > window.innerHeight - 8;
    setPosition({ top: flip ? anchor.top - height - 6 : below, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", () => setOpen(false));
    window.addEventListener("scroll", () => setOpen(false), true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const usable = actions.filter((action) => action.label);
  if (usable.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border text-body transition-colors hover:text-white ${
          open
            ? "border-primary/40 bg-primary/15 text-white"
            : "border-transparent hover:border-primary/20 hover:bg-primary-panel"
        }`}
      >
        {trigger ?? <span className="text-lg leading-none">⋯</span>}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              style={{ top: position.top, left: position.left, width: 224 }}
              className="fixed z-200 overflow-hidden rounded-xl border border-surface-2 bg-surface py-1 shadow-2xl"
            >
              {usable.map((action, index) => {
                const firstDanger =
                  action.danger && !usable[index - 1]?.danger && index > 0;
                return (
                  <div key={action.label}>
                    {firstDanger ? (
                      <div className="my-1 border-t border-surface-2" />
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      disabled={action.disabled}
                      onClick={() => {
                        setOpen(false);
                        action.onSelect();
                      }}
                      className={`block w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                        action.danger
                          ? "text-lose hover:bg-lose/10"
                          : "text-white hover:bg-primary-panel"
                      }`}
                    >
                      {action.label}
                      {action.hint ? (
                        <span className="mt-0.5 block text-xs text-body">
                          {action.hint}
                        </span>
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
