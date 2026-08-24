import { SiteLayout } from "@/components/layout/SiteLayout";

export default function AboutPage() {
  return (
    <SiteLayout>
      <section className="gradient-brand-page">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center">
          <h1 className="font-display text-5xl text-white">About Gamelyd</h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/80">
            Gamelyd is the home of competitive gaming — where anyone can create,
            host, and join tournaments across their favourite titles.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl space-y-8 px-5 py-16 text-body">
        <div>
          <h2 className="mb-3 text-2xl font-semibold text-white">Our mission</h2>
          <p>
            We believe every gamer deserves a stage. Gamelyd removes the friction
            of organizing tournaments — from registration and fixtures to scoring
            and payouts — so players can focus on winning.
          </p>
        </div>
        <div>
          <h2 className="mb-3 text-2xl font-semibold text-white">What we offer</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Multiplayer, battle royale and group-stage formats</li>
            <li>Automatic or manual draws and fixtures</li>
            <li>Real-time scoring and leaderboards</li>
            <li>Free, paid and sponsored tournaments</li>
          </ul>
        </div>
      </section>
    </SiteLayout>
  );
}
