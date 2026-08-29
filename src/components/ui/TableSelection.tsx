"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";

/**
 * Row selection for admin tables. Keeps the selected ids as a set and exposes
 * the header checkbox's indeterminate state, so every table shares one
 * behaviour instead of reimplementing it.
 */
export function useRowSelection<T extends string>(visibleIds: T[]) {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      const everySelected =
        visibleIds.length > 0 && visibleIds.every((id) => next.has(id));
      for (const id of visibleIds) {
        if (everySelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, [visibleIds]);

  // Ids can disappear between refreshes; never act on a row that is gone.
  const ids = useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [visibleIds, selected],
  );

  return {
    selected,
    ids,
    count: ids.length,
    isSelected: (id: T) => selected.has(id),
    toggle,
    toggleAll,
    clear,
    allVisibleSelected,
    someVisibleSelected: !allVisibleSelected && ids.length > 0,
  };
}

export function SelectCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={onChange}
      className="h-4 w-4 cursor-pointer accent-primary"
    />
  );
}

/** Sticky bar that appears once rows are selected, holding the bulk actions. */
export function BulkActionBar({
  count,
  noun = "row",
  onClear,
  children,
}: {
  count: number;
  noun?: string;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="sticky bottom-4 z-40 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary-panel px-4 py-3 shadow-2xl">
      <span className="text-sm font-semibold text-white">
        {count} {noun}
        {count === 1 ? "" : "s"} selected
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {children}
        <button
          type="button"
          onClick={onClear}
          className="cursor-pointer px-2 text-sm text-body transition-colors hover:text-white"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
