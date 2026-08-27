"use client";

import { useMemo, useState } from "react";
import type { AppIcon } from "@/lib/icons";
import { iconLabel, rewriteCatalogPath } from "@/lib/icons";
import { Input } from "@/components/ui/Input";

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
  const selected = iconLabel(icons, value);
  const thumb =
    size === "sm" ? "h-10 sm:h-11" : "h-16 sm:h-[72px]";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return icons;
    return icons.filter((icon) => icon.label.toLowerCase().includes(q));
  }, [icons, query]);

  return (
    <div>
      <p className="mb-2 text-sm text-label">{label}</p>
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
        <p className="text-sm text-body">Loading images…</p>
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
            const active = value === icon.url;
            return (
              <button
                key={icon.id}
                type="button"
                title={icon.label}
                onClick={() => onChange(icon.url)}
                className={`overflow-hidden rounded-lg border-2 bg-primary transition-colors ${
                  active
                    ? "border-primary ring-2 ring-primary/40"
                    : "border-transparent hover:border-primary/50"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={rewriteCatalogPath(icon.url)}
                  alt={icon.label}
                  className={`aspect-square w-full object-cover ${thumb}`}
                />
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-2 truncate text-xs text-body">
        {selected
          ? `Selected: ${selected}`
          : "Tap an image to select it"}
      </p>
    </div>
  );
}
