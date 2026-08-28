import Link from "next/link";
import type { ReactNode } from "react";
import type { Game } from "@/lib/schemas/game";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { GamesCarousel } from "@/components/home/GamesCarousel";

export function SectionHead({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description?: ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
        {kicker}
      </p>
      <h2 className="mt-1 font-display text-3xl text-white sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <div className="mt-3 max-w-2xl text-body">{description}</div>
      ) : null}
    </div>
  );
}

export function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Create the event",
      body: "Pick a game, platform, team size, and format. Set the date, prize, and how many teams can join. Publishing closes nothing. Registration stays open until you start.",
    },
    {
      n: "02",
      title: "Players register",
      body: "Solo, duo, or squad. Public events show on the tournament list. Private ones stay invite-only. Organizations can run events under one club name with extra managers.",
    },
    {
      n: "03",
      title: "Draw fixtures",
      body: "Start the tournament when the lobby is full. Knockouts pair teams. Groups get a round-robin inside each pool, then a seeded bracket. Leagues generate every matchday. Battle royale uses a single lobby.",
    },
    {
      n: "04",
      title: "Record results",
      body: "Hosts enter scores from the fixtures tab. Tables and the knockout tree update from those results. Unplayed matches block the next draw so a round cannot skip ahead.",
    },
  ];

  return (
    <section className="border-t border-primary/20">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <Reveal>
          <SectionHead
            kicker="How it works"
            title="From lobby to final"
            description="Gamelyd is the operations layer for a tournament: signup, draws, scores, and a public page players can follow. You do not need a spreadsheet or a second chat for fixtures."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
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
        </Reveal>
      </div>
    </section>
  );
}

export function Formats() {
  const formats: {
    title: string;
    body: string;
    glyph: "knockout" | "groups" | "league" | "br";
  }[] = [
    {
      title: "Knockout",
      glyph: "knockout",
      body: "Single-elimination tree. Winners move toward the final. Byes are handled when the field is odd. The bracket fills as rounds are drawn.",
    },
    {
      title: "Groups",
      glyph: "groups",
      body: "Round-robin inside each group, then a knockout. Top teams advance (you choose how many). Tables show points, and the bracket uses group-winner placeholders until qualification.",
    },
    {
      title: "League",
      glyph: "league",
      body: "Everyone plays everyone. Matchdays are generated up front, including a return leg if you want home and away. First place is decided by the points system you set.",
    },
    {
      title: "Battle royale",
      glyph: "br",
      body: "One lobby, many teams. Record placements, kills, and wins on a single draw instead of a pairwise tree. Built for titles that do not play as 1v1 fixtures.",
    },
  ];

  return (
    <section className="border-t border-primary/20">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <Reveal>
          <SectionHead
            kicker="Formats"
            title="Run the structure the game needs"
            description="FIFA cups, Warzone lobbies, and club leagues do not share a bracket. Choose the mode when you create the event. The draw engine and the public page follow that choice."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {formats.map((item) => (
              <article
                key={item.title}
                className="arena-panel arena-hud-corners p-5 sm:p-6"
              >
                <span className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-primary text-[#04201e]">
                  <FormatGlyph kind={item.glyph} />
                </span>
                <h3 className="font-display text-2xl text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-body">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm text-body">
            Rosters can be solo, duo, or squad. Events can be free or sponsored.
            Draws can be automatic or kept in registration order.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function GamesStrip({ games }: { games: Game[] }) {
  if (games.length === 0) return null;

  return (
    <section className="border-t border-primary/20">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <Reveal>
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <SectionHead
              kicker="Titles"
              title="Games you can host"
              description="Pick a title when you create a tournament, then choose the platforms it supports: Crossplay, PlayStation, Xbox, or PC."
            />
            <Link href="/games">
              <Button variant="outline">View more</Button>
            </Link>
          </div>
          <GamesCarousel games={games} />
        </Reveal>
      </div>
    </section>
  );
}

export function Audience() {
  return (
    <section className="border-t border-primary/20">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <Reveal>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="arena-panel arena-hud-corners p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                Players
              </p>
              <h2 className="mt-2 font-display text-3xl text-white">
                Find a lobby and show up
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-body">
                Browse public tournaments by mode and type. Open an event to see
                the roster, group tables, fixtures, and the knockout tree.
                Register with the team size the host set. After it starts,
                follow results on the same page. You do not need a separate
                results thread.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-body">
                Private events stay off the public list. If you were invited,
                use the link the host sent. Create an account so your
                registrations and hosted events sit on your dashboard.
              </p>
              <Link href="/tournament/all/ALL/ALL" className="mt-6 inline-block">
                <Button>Browse tournaments</Button>
              </Link>
            </article>
            <article className="arena-panel arena-hud-corners p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                Hosts
              </p>
              <h2 className="mt-2 font-display text-3xl text-white">
                Run the event without a side spreadsheet
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-body">
                Create the tournament, share the page, and close registration
                when you start. Group hosts can rearrange teams before the first
                draw. Co-managers from your organization can record scores if
                you add them in settings.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-body">
                Visibility can stay public or private. Tournament size can grow
                before the event starts. Once you draw, fixtures stay on the
                tournament page until the last match is played.
              </p>
              <Link href="/tournament/new" className="mt-6 inline-block">
                <Button variant="outline">Create tournament</Button>
              </Link>
            </article>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function HomeFaq() {
  const items = [
    {
      q: "Do I need an organization to host?",
      a: "No. Anyone with an account can create a tournament. Organizations are for clubs that want a shared name, logo, and extra managers on the same events.",
    },
    {
      q: "When does registration close?",
      a: "When the host starts the tournament or creates groups. After that, new teams cannot join. Confirm before you draw. Starting is the lock.",
    },
    {
      q: "Can I change settings after teams sign up?",
      a: "Draw order, visibility, and size can change before the event starts. Visibility changes ask for confirmation. After fixtures exist, groups cannot be shuffled.",
    },
    {
      q: "How do sponsored events work?",
      a: "Mark the tournament as sponsored when you create it and set a prize pool. Sponsored events carry a yellow frame on listings so they stand apart from free lobbies.",
    },
  ];

  return (
    <section className="border-t border-primary/20">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <Reveal>
          <SectionHead kicker="Questions" title="Before you create or join" />
          <dl className="mt-10 grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.q}
                className="arena-panel arena-hud-corners p-5 sm:p-6"
              >
                <dt className="font-display text-xl text-white">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-body">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

function FormatGlyph({
  kind,
}: {
  kind: "knockout" | "groups" | "league" | "br";
}) {
  const cls = "h-6 w-6";
  if (kind === "knockout") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cls}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M4 5h6v4H4zM14 5h6v4h-6zM9 15h6v4H9z" />
        <path d="M7 9v2h10V9M12 11v4" />
      </svg>
    );
  }
  if (kind === "groups") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cls}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="8" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
        <rect x="13" y="13" width="8" height="8" rx="1.5" />
      </svg>
    );
  }
  if (kind === "league") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cls}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M5 6h14M5 12h14M5 18h10" />
        <circle cx="5" cy="6" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="5" cy="18" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className={cls}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="7" cy="9" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="16" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
