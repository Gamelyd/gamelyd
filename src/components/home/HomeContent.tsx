import Link from "next/link";
import type { ReactNode } from "react";
import type { Game } from "@/lib/schemas/game";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { GamesCarousel } from "@/components/home/GamesCarousel";
import { helpTarget } from "@/lib/help";

export function SectionHead({
  kicker,
  title,
  description,
}: {
  kicker?: string;
  title: string;
  description?: ReactNode;
}) {
  return (
    <div>
      {kicker ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
          {kicker}
        </p>
      ) : null}
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
      body: "Pick a game or sport, then the format. Registration stays open until you start.",
    },
    {
      n: "02",
      title: "Players register",
      body: "Solo, duo, or squad. Every event shows on the tournament list, invite-only included.",
    },
    {
      n: "03",
      title: "Draw fixtures",
      body: "Knockouts pair teams, groups play a round-robin, leagues generate every matchday.",
    },
    {
      n: "04",
      title: "Record results",
      body: "Enter scores and the table and the knockout tree update from them.",
    },
  ];

  return (
    <section className="border-t border-white/8">
      <div className="mx-auto max-w-page px-page py-16">
        <Reveal>
          <div {...helpTarget("home-how")}>
            <SectionHead
              title="From lobby to final"
              description="Gamelyd is the operations layer for a tournament: signup, draws, scores, and a public page players can follow."
            />
            {/* A numbered rail rather than four bordered cards - the steps are
                one sequence, so they should read as one object. */}
            <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {steps.map((step) => (
                <li key={step.n} className="lg:border-t lg:border-white/10 lg:pt-5">
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
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const FORMATS: {
  title: string;
  body: string;
  glyph: "knockout" | "groups" | "league" | "br";
}[] = [
  {
    title: "Knockout",
    glyph: "knockout",
    body: "Single-elimination tree. Byes handled when the field is odd.",
  },
  {
    title: "Groups",
    glyph: "groups",
    body: "Round-robin pools, then a seeded bracket for the teams that advance.",
  },
  {
    title: "League",
    glyph: "league",
    body: "Everyone plays everyone, with an optional return leg. The table decides it.",
  },
  {
    title: "Battle royale",
    glyph: "br",
    body: "One lobby, many teams. Record placements, kills, and wins on a single draw.",
  },
];

/**
 * Formats and the catalogue answer the same question - "will it run my
 * competition?" - so they share one section instead of three.
 */
export function FormatsAndGames({
  games,
  sports,
}: {
  games: Game[];
  sports: Game[];
}) {
  return (
    <section className="border-t border-white/8 bg-primary-panel">
      <div className="mx-auto max-w-page px-page py-16">
        <Reveal>
          <SectionHead
            title="Run the structure the game needs"
            description="FIFA cups, Warzone lobbies, and club leagues do not share a bracket. Choose the mode when you create the event, and the draw engine follows."
          />

          <div className="mt-10 grid gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
            {FORMATS.map((item) => (
              <article key={item.title}>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
                  <FormatGlyph kind={item.glyph} />
                </span>
                <h3 className="mt-3 font-display text-xl text-white">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-body">
                  {item.body}
                </p>
              </article>
            ))}
          </div>

          <p className="mt-7 border-t border-white/10 pt-6 text-sm text-body">
            Rosters can be solo, duo, or squad. Draws can be automatic or kept
            in registration order.
          </p>

          <GameRow
            games={games}
            title="Games you can host"
            description="Pick a title, then the platforms it supports: Crossplay, PlayStation, Xbox, or PC."
            href="/games"
          />
          <GameRow
            games={sports}
            title="Sports you can host"
            description="Football, basketball, and any sport you add. Pick a format like 5-a-side, then run knockout, groups, or a league."
            href="/games?kind=sports"
          />
        </Reveal>
      </div>
    </section>
  );
}

function GameRow({
  games,
  title,
  description,
  href,
}: {
  games: Game[];
  title: string;
  description: string;
  href: string;
}) {
  if (games.length === 0) return null;

  return (
    <div className="mt-12">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-white">{title}</h3>
          <p className="mt-1 max-w-xl text-sm text-body">{description}</p>
        </div>
        <Link
          href={href}
          className="text-sm font-semibold text-primary hover:underline"
        >
          View all
        </Link>
      </div>
      <GamesCarousel games={games} />
    </div>
  );
}

const PRICING = [
  ["Free to run", "Create, invite, draw, and record results at no cost."],
  ["Pay only to scale", "Bigger lobbies, leagues, or several at once need a plan."],
  ["Players never pay", "Joining a tournament is always free."],
];

export function PlayersAndHosts() {
  return (
    <section className="border-t border-white/8">
      <div className="mx-auto max-w-page px-page py-16">
        <Reveal>
          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-primary-panel p-6 sm:p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                Players
              </p>
              <h2 className="mt-2 font-display text-3xl text-white">
                Find a lobby and show up
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-body">
                Browse tournaments by mode and type. Open an event to see the
                roster, group tables, fixtures, and the knockout tree, then
                register with the team size the host set. Invite-only events
                still show on the list, you just need the invite first.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-body">
                Only join hosts you trust, and keep screenshots of your matches
                in case a result is disputed.
              </p>
              <Link
                href="/tournament/all/ALL/ALL"
                className="mt-6 inline-block"
              >
                <Button>Browse tournaments</Button>
              </Link>
            </article>

            <article className="rounded-2xl border border-white/10 bg-primary-panel p-6 sm:p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                Hosts
              </p>
              <h2 className="mt-2 font-display text-3xl text-white">
                Run the event without a side spreadsheet
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-body">
                Create the tournament, share one URL for the roster, fixtures,
                tables, and the bracket, and close registration when you start.
                Group hosts can rearrange teams before the first draw.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-body">
                Clubs can wrap events in an organization so co-managers record
                scores under a shared name and logo.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/tournament/new">
                  <Button>Create tournament</Button>
                </Link>
                <Link href="/org/new">
                  <Button variant="outline">Create organization</Button>
                </Link>
              </div>
            </article>
          </div>

          <dl className="mt-5 grid gap-x-8 gap-y-5 rounded-2xl border border-white/10 px-6 py-6 sm:grid-cols-3">
            {PRICING.map(([label, line]) => (
              <div key={label}>
                <dt className="font-display text-lg text-secondary">{label}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-body">
                  {line}
                </dd>
              </div>
            ))}
          </dl>
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
      a: "Draw order, who can register, and size can change before the event starts. Changing who can register asks for confirmation. After fixtures exist, groups cannot be shuffled.",
    },
    {
      q: "Are invite-only events hidden?",
      a: "No. Every event shows on the tournament list, home, and banner. Invite-only only means players cannot register until the host invites them and they accept.",
    },
    {
      q: "What does it cost?",
      a: "Nothing to play, and nothing to run a normal tournament. A knockout of up to 8 teams is free forever. You only pay if you organise at a larger scale: bigger lobbies, leagues, groups, or several competitions at once.",
    },
    {
      q: "How do I run a bigger tournament?",
      a: "Two ways. Subscribe to a plan (Club or League) if you run competitions regularly, or pay once for a single larger event without subscribing. Either way, the players who join never pay you anything.",
    },
    {
      q: "Do players ever pay?",
      a: "No. Plans and one-off payments are charged to the organiser, for running the competition. Joining a tournament is always free.",
    },
    {
      q: "What does the verified badge mean?",
      a: "We checked that account's details and confirmed they are correct and that the person is reachable on them. It is not a rating of how good a host or player is. Verified accounts cannot change their own email or phone, so the badge keeps meaning something: a change has to be requested and checked by us first.",
    },
    {
      q: "Something went wrong in a tournament. What do I do?",
      a: "Open the tournament and use Report this tournament at the bottom of the details tab. Pick what it is about, tell us what happened, and it goes straight to our team. The host is not told who reported them.",
    },
    {
      q: "What proof should I keep?",
      a: "Screenshots, recordings, and match IDs of your games and wins. If a result is disputed, that is what you show the host. Do not rely on a chat that can be deleted.",
    },
  ];

  return (
    <section className="border-t border-white/8">
      <div className="mx-auto max-w-page px-page py-16">
        <Reveal>
          <SectionHead title="Before you create or join" />
          {/* Collapsed by default: ten open answers made this the tallest
              block on the page, below everything people came for. The two
              halves are separate stacks, so opening one answer does not
              shunt the rows in the other column. */}
          <div className="mt-8 grid gap-x-10 md:grid-cols-2">
            {[items.slice(0, 5), items.slice(5)].map((column, col) => (
              <div key={col}>
                {column.map((item, i) => (
                  <details
                    key={item.q}
                    open={col === 0 && i === 0}
                    className="group border-b border-white/10"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-lg text-white hover:text-primary [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <span
                        className="shrink-0 text-lg leading-none text-primary transition-transform duration-200 group-open:rotate-45"
                        aria-hidden
                      >
                        +
                      </span>
                    </summary>
                    <p className="pb-4 text-sm leading-relaxed text-body">
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            ))}
          </div>
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
  const cls = "h-5 w-5";
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
