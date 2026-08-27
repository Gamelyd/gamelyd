"use client";

import Link from "next/link";
import type { User } from "@/lib/schemas/user";
import type { Tournament } from "@/lib/schemas/tournament";
import type { RegisterTournament } from "@/lib/schemas/register";
import { Button } from "@/components/ui/Button";
import {
  TournamentCard,
  EmptyTournaments,
} from "@/components/tournament/TournamentCard";
import { CatalogAvatar } from "@/components/ui/CatalogAvatar";

export function DashboardView({
  profile,
  created,
  registered,
}: {
  profile: User;
  created: Tournament[];
  registered: RegisterTournament[];
}) {
  return (
    <div>
      <section className="border-b border-primary/20 bg-primary-panel">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 lg:py-12 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <CatalogAvatar
              userId={profile.user_id}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/40"
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                Dashboard
              </p>
              <h1 className="mt-1 font-display text-4xl text-white">
                {profile.first_name} {profile.last_name}
              </h1>
              <p className="text-body">@{profile.user_name}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/profile/${profile.user_id}`}>
              <Button variant="outline">View profile</Button>
            </Link>
            <Link href="/tournament/new">
              <Button>Create tournament</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-10 sm:grid-cols-3">
        <Stat label="Tournaments created" value={created.length} />
        <Stat label="Tournaments joined" value={registered.length} />
        <Stat label="Country" value={profile.country || "—"} />
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl text-white">
            Tournaments you created
          </h2>
          <Link
            href="/tournament/all/ALL/ALL"
            className="text-sm text-primary hover:underline"
          >
            Browse all
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {created.length === 0 ? (
            <EmptyTournaments message="You have not created a tournament yet." />
          ) : (
            created.map((t) => (
              <TournamentCard
                key={`${t._id}:${t.TournamentId}`}
                tournament={t}
              />
            ))
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16">
        <h2 className="mb-6 font-display text-2xl text-white">
          Tournaments you joined
        </h2>
        {registered.length === 0 ? (
          <p className="text-body">You have not joined a tournament yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {registered.map((reg) => (
              <Link
                key={reg.RegisterTournamentId || reg._id}
                href={`/tournament/${reg.TournamentId}`}
                className="arena-panel arena-hud-corners p-4 transition-colors hover:border-primary"
              >
                <h3 className="font-semibold text-white">
                  {reg.TournamentName || "Tournament"}
                </h3>
                <p className="text-sm text-body">Team: {reg.TeamName}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="arena-panel arena-hud-corners p-5">
      <p className="font-display text-3xl text-primary">{value}</p>
      <p className="mt-1 text-sm text-body">{label}</p>
    </div>
  );
}
