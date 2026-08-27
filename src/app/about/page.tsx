import type { Metadata } from "next";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "About",
  description:
    "Gamelyd is the operations layer for game tournaments: one page for signup, draws, fixtures, tables, and the bracket.",
  path: "/about",
});

const STEPS = [
  {
    n: "01",
    title: "Lock the lobby",
    body: "Pick a title, format, roster size, and date. Public cups show on the list. Private ones stay invite-only.",
  },
  {
    n: "02",
    title: "Fill the roster",
    body: "Players register as solo, duo, or squad. The event page is the source of truth. No second chat for who is in.",
  },
  {
    n: "03",
    title: "Draw and play",
    body: "Start when the field is set. Knockouts pair, groups run round-robin then a bracket, leagues get matchdays, battle royale uses one lobby.",
  },
  {
    n: "04",
    title: "Post the scores",
    body: "Hosts record results. Tables and the tree update from those scores. Unplayed matches hold the next round so nothing skips ahead.",
  },
];

const FORMATS = [
  {
    title: "Knockout",
    body: "Single elimination. Win or go home. Byes land when the field is odd.",
  },
  {
    title: "Groups",
    body: "Pools first, then a seeded knockout. You choose how many from each group go through.",
  },
  {
    title: "League",
    body: "Everyone plays everyone. Optional return leg. First place is the table, not a final.",
  },
  {
    title: "Battle royale",
    body: "One lobby, many teams. Record placements and the rest on a single draw instead of a 1v1 tree.",
  },
];

export default function AboutPage() {
  return (
    <SiteLayout>
      <PageHeader
        kicker="The lobby"
        title="Built for the night you are already running"
        description="Gamelyd is the page a cup lives on: registration, draws, fixtures, tables, and the bracket. Hosts stop juggling a sheet, a group chat, and a graphics pack. Players stop asking where the next match is."
        width="max-w-5xl"
      />

      <section className="mx-auto max-w-5xl space-y-4 px-5 py-16">
        <Reveal>
          <article className="arena-panel arena-hud-corners p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
            Why it exists
          </p>
          <h2 className="mt-2 font-display text-3xl text-white">
            The cup deserves a real event page
          </h2>
          <p className="mt-3 max-w-3xl text-body">
            Weekend FIFA brackets, Warzone lobbies, and club leagues all fail
            the same way: the rules live in a message, the draw lives in a
            spreadsheet, and the scores live in someone&apos;s notes. Gamelyd
            puts that in one URL. Create the tournament, share it, start when
            the lobby is full, and keep every result on the same page until
            someone lifts the crown.
          </p>
        </article>
        </Reveal>

        <Reveal>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="arena-panel arena-hud-corners p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
              Players
            </p>
            <h2 className="mt-2 font-display text-2xl text-white">
              Find a lobby. Show up. Follow the tree.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-body">
              Browse public events by format. Open a cup and you see the roster,
              group tables, fixtures, and knockout. Register with the team size
              the host set. After it starts, results land on that same page.
              You do not need a separate results thread.
            </p>
          </article>
          <article className="arena-panel arena-hud-corners p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
              Hosts
            </p>
            <h2 className="mt-2 font-display text-2xl text-white">
              Run the night without a side spreadsheet
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-body">
              Lock the game, format, and rules, then open registration. Clubs
              can host under an organization so managers share the event.
              Co-managers can record scores. Visibility stays public or private.
              Once you draw, the fixtures stay put until the last match is
              played.
            </p>
          </article>
        </div>
        </Reveal>

        <Reveal>
        <div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
            From lobby to final
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {STEPS.map((step) => (
              <article
                key={step.n}
                className="arena-panel arena-hud-corners p-5 sm:p-6"
              >
                <p className="grid h-10 w-10 place-items-center rounded-lg bg-primary font-display text-lg text-[#04201e]">
                  {step.n}
                </p>
                <h3 className="mt-4 font-display text-xl text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-body">
                  {step.body}
                </p>
              </article>
            ))}
          </div>
        </div>
        </Reveal>

        <Reveal>
        <div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
            Formats
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {FORMATS.map((item) => (
              <article
                key={item.title}
                className="arena-panel arena-hud-corners p-5 sm:p-6"
              >
                <h3 className="font-display text-2xl text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-body">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-4 text-sm text-body">
            Rosters can be solo, duo, or squad. Events can be free or sponsored.
            Draws can be automatic or kept in registration order.
          </p>
        </div>
        </Reveal>

        <Reveal>
        <article className="arena-panel arena-hud-corners flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
              Ready up
            </p>
            <h2 className="mt-2 font-display text-3xl text-white">
              Put the next cup on a real page
            </h2>
            <p className="mt-2 max-w-xl text-sm text-body">
              Browse what is live, or lock a game and launch a lobby of your
              own.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/tournament/all/ALL/ALL">
              <Button>Browse tournaments</Button>
            </Link>
            <Link href="/tournament/new">
              <Button variant="outline">Create tournament</Button>
            </Link>
          </div>
        </article>
        </Reveal>
      </section>
    </SiteLayout>
  );
}
