import Image from "next/image";
import Link from "next/link";
import type { Game } from "@/lib/schemas/game";
import { Button } from "@/components/ui/Button";

const card =
  "rounded-xl border border-white/20 bg-surface p-5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)] sm:p-6";

export function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Create the event",
      body: "Pick a game, platform, team size, and format. Set the date, prize or entry fee, and how many teams can join. Publishing closes nothing — registration stays open until you start.",
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
    <section className="border-t border-surface-2 bg-bg">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          How it works
        </p>
        <h2 className="mt-1 font-display text-3xl text-white sm:text-4xl">
          From lobby to final
        </h2>
        <p className="mt-3 max-w-2xl text-body">
          Gamelyd is the operations layer for a tournament: signup, draws,
          scores, and a public page players can follow. You do not need a
          spreadsheet or a second chat for fixtures.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <article key={step.n} className={card}>
              <p className="font-display text-3xl text-primary">{step.n}</p>
              <h3 className="mt-3 font-display text-xl text-white">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-body">
                {step.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Formats() {
  const formats = [
    {
      title: "Knockout",
      body: "Single-elimination tree. Winners move toward the final. Byes are handled when the field is odd. The bracket fills as rounds are drawn.",
    },
    {
      title: "Groups",
      body: "Round-robin inside each group, then a knockout. Top teams advance (you choose how many). Tables show points, and the bracket uses group-winner placeholders until qualification.",
    },
    {
      title: "League",
      body: "Everyone plays everyone. Matchdays are generated up front, including a return leg if you want home and away. First place is decided by the points system you set.",
    },
    {
      title: "Battle royale",
      body: "One lobby, many teams. Record placements, kills, and wins on a single draw instead of a pairwise tree. Built for titles that do not play as 1v1 fixtures.",
    },
  ];

  return (
    <section className="border-t border-surface-2 bg-bg">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Formats
        </p>
        <h2 className="mt-1 font-display text-3xl text-white sm:text-4xl">
          Run the structure the game needs
        </h2>
        <p className="mt-3 max-w-2xl text-body">
          FIFA cups, Warzone lobbies, and club leagues do not share a bracket.
          Choose the mode when you create the event — the draw engine and the
          public page follow that choice.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {formats.map((item) => (
            <article key={item.title} className={card}>
              <h3 className="font-display text-2xl text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-body">
                {item.body}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-6 text-sm text-body">
          Rosters can be solo, duo, or squad. Events can be free, sponsored, or
          listed with an entry fee. Draws can be automatic or kept in
          registration order.
        </p>
      </div>
    </section>
  );
}

export function GamesStrip({ games }: { games: Game[] }) {
  if (games.length === 0) return null;

  return (
    <section className="border-t border-surface-2 bg-surface">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Titles
        </p>
        <h2 className="mt-1 font-display text-3xl text-white sm:text-4xl">
          Games you can host
        </h2>
        <p className="mt-3 max-w-2xl text-body">
          Pick a title when you create a tournament, then choose the platforms
          it supports — Crossplay, PlayStation, Xbox, or PC.
        </p>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {games.map((game) => (
            <li
              key={game.game_id}
              className="overflow-hidden rounded-xl border border-white/20 bg-bg shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]"
            >
              <div className="relative aspect-4/3 bg-surface-4">
                {game.image ? (
                  <Image
                    src={game.image}
                    alt=""
                    fill
                    sizes="200px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <p className="truncate px-3 py-2 text-sm font-medium text-white">
                {game.name}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Audience() {
  return (
    <section className="border-t border-surface-2 bg-bg">
      <div className="mx-auto grid max-w-7xl gap-4 px-5 py-16 lg:grid-cols-2">
        <article className={card}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Players
          </p>
          <h2 className="mt-2 font-display text-3xl text-white">
            Find a lobby and show up
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-body">
            Browse public tournaments by mode and type. Open an event to see
            the roster, group tables, fixtures, and the knockout tree. Register
            with the team size the host set. After it starts, follow results on
            the same page — you do not need a separate results thread.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-body">
            Private events stay off the public list. If you were invited, use
            the link the host sent. Create an account so your registrations and
            hosted events sit on your dashboard.
          </p>
          <Link href="/tournament/all/ALL/ALL" className="mt-6 inline-block">
            <Button>Browse tournaments</Button>
          </Link>
        </article>
        <article className={card}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Hosts
          </p>
          <h2 className="mt-2 font-display text-3xl text-white">
            Run the event without a side spreadsheet
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-body">
            Create the tournament, share the page, and close registration when
            you start. Group hosts can rearrange teams before the first draw.
            Co-managers from your organization can record scores if you add
            them in settings.
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
      a: "When the host starts the tournament or creates groups. After that, new teams cannot join. Confirm before you draw — starting is the lock.",
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
    <section className="border-t border-surface-2 bg-bg">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Questions
        </p>
        <h2 className="mt-1 font-display text-3xl text-white sm:text-4xl">
          Before you create or join
        </h2>
        <dl className="mt-10 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.q} className={card}>
              <dt className="font-display text-xl text-white">{item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-body">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
