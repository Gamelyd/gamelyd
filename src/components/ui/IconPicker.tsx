"use client";

import type { AppIcon } from "@/lib/icons";
import { iconLabel } from "@/lib/icons";

export function IconPicker({
  label,
  icons,
  value,
  onChange,
  size = "md",
}: {
  label: string;
  icons: AppIcon[];
  value: string;
  onChange: (url: string) => void;
  size?: "md" | "sm";
}) {
  const selected = iconLabel(icons, value);
  const thumb =
    size === "sm"
      ? "h-10 sm:h-11"
      : "h-16 sm:h-[72px]";

  return (
    <div>
      <p className="mb-2 text-sm text-label">{label}</p>
      <div
        className={`grid gap-2 ${
          size === "sm" ? "grid-cols-6 sm:grid-cols-7" : "grid-cols-4 sm:grid-cols-6"
        }`}
      >
        {icons.map((icon) => {
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
                src={icon.url}
                alt={icon.label}
                className={`aspect-square w-full object-cover ${thumb}`}
              />
            </button>
          );
        })}
      </div>
      <p className="mt-2 truncate text-xs text-body">
        {selected ? `Selected: ${selected}` : "Tap an icon to select it"}
      </p>
    </div>
  );
}
