import type { Metadata } from "next";
import Link from "next/link";
import { getAdminStats } from "@/server/services/adminService";
import { pageMeta } from "@/lib/seo";
import { UploadCatalogButton } from "@/components/admin/UploadCatalogButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Dashboard · Admin",
  description: "Gamelyd administration overview.",
  path: "/admin",
  noIndex: true,
  absoluteTitle: true,
});

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();

  const cards: { label: string; value: number; href?: string }[] = [
    { label: "Users", value: stats.users, href: "/admin/users" },
    { label: "Tournaments", value: stats.tournaments, href: "/admin/tournaments" },
    { label: "Registrations", value: stats.registrations },
    { label: "Organizations", value: stats.orgs, href: "/admin/orgs" },
    { label: "Games", value: stats.games, href: "/admin/games" },
    { label: "Active games", value: stats.activeGames, href: "/admin/games" },
  ];

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl text-white">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const inner = (
            <div className="arena-panel arena-hud-corners p-6 hover:border-primary">
              <p className="text-sm text-body">{card.label}</p>
              <p className="mt-2 font-display text-4xl text-white">
                {card.value.toLocaleString()}
              </p>
            </div>
          );
          return card.href ? (
            <Link key={card.label} href={card.href}>
              {inner}
            </Link>
          ) : (
            <div key={card.label}>{inner}</div>
          );
        })}
      </div>

      <div className="mt-10 flex flex-wrap items-start gap-3">
        <UploadCatalogButton />
        <Link
          href="/admin/images"
          className="rounded-lg bg-surface-3 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-surface-2"
        >
          Manage images
        </Link>
        <Link
          href="/admin/games"
          className="rounded-lg bg-surface-3 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-surface-2"
        >
          Manage games
        </Link>
        <Link
          href="/admin/platforms"
          className="rounded-lg bg-surface-3 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-surface-2"
        >
          Manage platforms
        </Link>
        <Link
          href="/admin/users"
          className="rounded-lg bg-surface-3 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-surface-2"
        >
          Manage users
        </Link>
        <Link
          href="/admin/orgs"
          className="rounded-lg bg-surface-3 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-surface-2"
        >
          Manage organizations
        </Link>
        <Link
          href="/admin/tournaments"
          className="rounded-lg bg-surface-3 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-surface-2"
        >
          Manage tournaments
        </Link>
      </div>
    </div>
  );
}
