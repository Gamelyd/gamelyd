"use client";

import { useMemo, useState } from "react";
import type { AppIcon } from "@/lib/icons";
import { iconLabel } from "@/lib/icons";
import { Input } from "@/components/ui/Input";
import { Loader } from "@/components/ui/Loader";

function iconKey(url: string): string {
  return (
    url.split("/").pop()?.split("?")[0]?.replace(/\.(png|jpe?g|webp|gif|svg)$/i, "") ??
    url
  );
}

function sameIcon(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const left = iconKey(a);
  const right = iconKey(b);
  return Boolean(left) && left === right;
}

export function IconPicker({
  label,
  icons,
  value,
  onChange,
  size = "md",
  searchable = true,
  loading = false,
  emptyHint,
}: {
  label: string;
  icons: AppIcon[];
  value: string;
  onChange: (url: string) => void;
  size?: "md" | "sm";
  searchable?: boolean;
  loading?: boolean;
  emptyHint?: string;
}) {
  const [query, setQuery] = useState("");
  const selectedIcon = useMemo(
    () => icons.find((icon) => sameIcon(icon.url, value)),
    [icons, value],
  );
  const selectedLabel = selectedIcon?.label ?? iconLabel(icons, value);
  const selectedSrc = selectedIcon?.url || value;
  const thumb = size === "sm" ? "h-10 sm:h-11" : "h-16 sm:h-[72px]";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return icons;
    return icons.filter((icon) => icon.label.toLowerCase().includes(q));
  }, [icons, query]);

  return (
    <div>
      <p className="mb-2 text-sm text-label">{label}</p>
      {selectedSrc ? (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-yellow/40 bg-yellow/10 p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedSrc}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg object-cover ring-2 ring-yellow"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-yellow">
              Selected
            </p>
            <p className="truncate text-sm font-medium text-white">
              {selectedLabel || "Chosen image"}
            </p>
          </div>
        </div>
      ) : null}
      {searchable && icons.length > 8 ? (
        <div className="mb-2">
          <Input
            placeholder="Search by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      ) : null}
      {loading ? (
        <Loader variant="compact" label="Loading images" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-body">
          {emptyHint ||
            (query
              ? "No images match that name"
              : "No images in the catalog yet")}
        </p>
      ) : (
        <div
          className={`grid max-h-64 gap-2 overflow-y-auto pr-1 ${
            size === "sm"
              ? "grid-cols-6 sm:grid-cols-7"
              : "grid-cols-4 sm:grid-cols-6"
          }`}
        >
          {filtered.map((icon) => {
            const active = sameIcon(value, icon.url);
            return (
              <button
                key={icon.id}
                type="button"
                title={icon.label}
                aria-pressed={active}
                onClick={() => onChange(icon.url)}
                className={`relative rounded-lg p-0.5 transition-colors ${
                  active
                    ? "bg-yellow ring-2 ring-yellow"
                    : "ring-1 ring-white/10 hover:ring-primary/60"
                }`}
              >
                <span className="block overflow-hidden rounded-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={icon.url}
                    alt={icon.label}
                    className={`aspect-square w-full object-cover ${thumb}`}
                  />
                </span>
                {active ? (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-yellow text-[10px] font-bold text-on-primary shadow">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
