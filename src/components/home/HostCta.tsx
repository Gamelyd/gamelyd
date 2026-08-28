import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SectionHead } from "@/components/home/HomeContent";
import { Reveal } from "@/components/ui/Reveal";

export function HostCta() {
  return (
    <section className="create-hud-head border-y border-primary/20 bg-primary-panel">
      <div className="mx-auto max-w-page px-page py-16">
        <Reveal>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <SectionHead
                kicker="Host terminal"
                title="Put the next cup on a real event page"
                description={
                  <>
                    <p>
                      Pick a game from the catalogue, choose knockout, groups,
                      league, or battle royale, then share the page. Players
                      use one URL for the roster, fixtures, tables, and the
                      bracket.
                    </p>
                    <p className="mt-3">
                      Clubs can wrap events in an organization so managers share
                      access. Need the banner slot on the home page? Contact us
                      after the tournament is live.
                    </p>
                  </>
                }
              />
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
                ["Access", "Invite only or open join"],
                ["Roster", "Solo, duo, and squad"],
                ["Seed", "Automatic or manual"],
                ["Draw", "Group tables and knockout tree"],
                ["Crew", "Co-managers from your org"],
              ].map(([label, line]) => (
                <li
                  key={line}
                  className="flex items-baseline justify-between gap-3 rounded-xl border border-primary/25 bg-black/25 px-4 py-3"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    {label}
                  </span>
                  <span className="truncate text-right text-white">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
