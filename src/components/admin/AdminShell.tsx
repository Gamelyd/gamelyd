"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/orgs", label: "Organizations" },
  { href: "/admin/tournaments", label: "Tournaments" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/games", label: "Catalog" },
  { href: "/admin/images", label: "Images" },
  { href: "/admin/platforms", label: "Platforms" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-page gap-8 px-page py-10 md:flex">
      <aside className="mb-6 shrink-0 md:mb-0 md:w-56">
        <h2 className="mb-4 font-display text-2xl text-white">Admin</h2>
        {/* On mobile the tabs are a single scrollable strip instead of
            wrapping into several rows that push the page around. */}
        <nav className="-mx-page flex gap-2 overflow-x-auto px-page pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
          {navItems.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors md:shrink ${
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
