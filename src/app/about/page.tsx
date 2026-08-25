import type { Metadata } from "next";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "About",
  description:
    "A tool for running game tournaments. You set up the event, people register as teams or solo, and you manage fixtures and scores from one page.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <SiteLayout>
      <PageHeader
        kicker="Gamelyd"
        title="About"
        description="A tool for running game tournaments. You set up the event, people register as teams or solo, and you manage fixtures and scores from one page."
        width="max-w-4xl"
      />

      <section className="mx-auto max-w-4xl space-y-8 px-5 py-16 text-body">
        <div>
          <h2 className="mb-3 text-2xl font-semibold text-white">What we do</h2>
          <p>
            Hosts pick a game, team size, and platforms, then publish a
            tournament. Players sign up, get drawn into matches, and see dates,
            links, and results as the host updates them. Organizations can host
            under a shared name so a club or group can run events together.
          </p>
        </div>
        <div>
          <h2 className="mb-3 text-2xl font-semibold text-white">
            What you can run
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Head-to-head, battle royale, and group-stage formats</li>
            <li>Solo, duo, or squad rosters</li>
            <li>Automatic or manual draws</li>
            <li>Free, paid, or sponsored events</li>
          </ul>
        </div>
      </section>
    </SiteLayout>
  );
}
