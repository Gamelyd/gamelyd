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
    body: "Pick a title, format, roster size, and date. Invite-only is the default: everyone can see the event, but they need an invite to register.",
  },
  {
    n: "02",
    title: "Fill the roster",
    body: "Players register as captain, then invite teammates. Teammates are not on the roster until they accept. A player can only be on one team.",
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
        title="Built for the night you are already running"
        description="Gamelyd is the page a cup lives on: registration, draws, fixtures, tables, and the bracket. Hosts stop juggling a sheet, a group chat, and a graphics pack. Players stop asking where the next match is."
        width="max-w-5xl"
      />

      <section className="border-t border-white/8">
        <div className="mx-auto max-w-5xl px-page py-16">
          <Reveal>
            <h2 className="font-display text-3xl text-white sm:text-4xl">
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
          </Reveal>
        </div>
      </section>

      <section className="border-t border-white/8 bg-primary-panel">
        <div className="mx-auto max-w-5xl px-page py-16">
          <Reveal>
            <div className="grid gap-5 lg:grid-cols-2">
              <article className="rounded-2xl border border-white/10 bg-black/20 p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                  Players
                </p>
                <h2 className="mt-2 font-display text-2xl text-white">
                  Find a lobby. Show up. Follow the tree.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-body">
                  Browse events by format. Open a cup and you see the roster,
                  group tables, fixtures, and knockout. Invite-only events still
                  show; you need an invite to register. After it starts, results
                  land on that same page. You do not need a separate results
                  thread.
                </p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-black/20 p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                  Hosts
                </p>
                <h2 className="mt-2 font-display text-2xl text-white">
                  Run the night without a side spreadsheet
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-body">
                  Lock the game, format, and rules, then share the page. Clubs
                  can host under an organization so managers share the event.
                  Co-managers can record scores. Invite-only is the default:
                  everyone can see the event, but they need an invite to
                  register. Once you draw, the fixtures stay put until the last
                  match is played.
                </p>
              </article>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-white/8">
        <div className="mx-auto max-w-5xl px-page py-16">
          <Reveal>
            <h2 className="font-display text-3xl text-white sm:text-4xl">
              From lobby to final
            </h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {STEPS.map((step) => (
                <li
                  key={step.n}
                  className="lg:border-t lg:border-white/10 lg:pt-5"
                >
                  <p className="font-display text-2xl leading-none text-primary">
                    {step.n}
                  </p>
                  <h3 className="mt-3 font-display text-xl text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-body">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-white/8 bg-primary-panel">
        <div className="mx-auto max-w-5xl px-page py-16">
          <Reveal>
            <h2 className="font-display text-3xl text-white sm:text-4xl">
              Formats
            </h2>
            <div className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
              {FORMATS.map((item) => (
                <article key={item.title}>
                  <h3 className="font-display text-xl text-white">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-body">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
            <p className="mt-8 border-t border-white/10 pt-6 text-sm text-body">
              Rosters can be solo, duo, or squad. Tournaments are free to run
              and free to join, with paid plans for organisers running at scale.
              Draws can be automatic or kept in registration order.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-white/8">
        <div className="mx-auto max-w-5xl px-page py-16">
          <Reveal>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-3xl text-white sm:text-4xl">
                  Put the next cup on a real page
                </h2>
                <p className="mt-2 max-w-xl text-body">
                  Browse what is live, or lock a game and launch a lobby of your
                  own.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Link href="/tournament/all/ALL/ALL">
                  <Button>Browse tournaments</Button>
                </Link>
                <Link href="/tournament/new">
                  <Button variant="outline">Create tournament</Button>
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}
