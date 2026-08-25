import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function HostCta() {
  return (
    <section className="border-y border-surface-2 bg-surface">
      <div className="mx-auto max-w-7xl px-5 py-14">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Host
            </p>
            <h2 className="mt-1 font-display text-3xl text-white sm:text-4xl">
              Put the next cup on a real event page
            </h2>
            <p className="mt-3 text-body">
              Pick a game from the catalogue, choose knockout, groups, league,
              or battle royale, then open registration. Players use one URL for
              the roster, fixtures, tables, and the bracket.
            </p>
            <p className="mt-3 text-body">
              Clubs can wrap events in an organization so managers share access.
              Need the banner slot on the home page? Contact us after the
              tournament is live.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/tournament/new">
                <Button>New tournament</Button>
              </Link>
              <Link href="/org/new">
                <Button variant="outline">Create organization</Button>
              </Link>
            </div>
          </div>
          <ul className="grid max-w-md gap-3 text-sm">
            {[
              "Public or private listing",
              "Solo, duo, and squad rosters",
              "Automatic or manual seeding",
              "Group tables and knockout tree",
              "Co-managers from your org",
            ].map((line) => (
              <li
                key={line}
                className="rounded-xl border border-white/20 bg-bg px-4 py-3 text-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
