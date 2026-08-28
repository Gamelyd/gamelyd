"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/orgs", label: "Organizations" },
  { href: "/admin/tournaments", label: "Tournaments" },
  { href: "/admin/games", label: "Catalog" },
  { href: "/admin/images", label: "Images" },
  { href: "/admin/platforms", label: "Platforms" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-page gap-8 px-page py-10 md:flex">
      <aside className="mb-6 shrink-0 md:mb-0 md:w-56">
        <h2 className="mb-4 font-display text-2xl text-white">Admin</h2>
        <nav className="flex gap-2 md:flex-col">
          {navItems.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "border border-primary/40 bg-primary/15 text-primary"
                    : "border border-transparent text-body hover:border-primary/20 hover:bg-primary-panel hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
