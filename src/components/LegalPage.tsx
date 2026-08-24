import { SiteLayout } from "@/components/layout/SiteLayout";

export interface LegalSection {
  heading: string;
  body: string;
}

export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <SiteLayout>
      <section className="gradient-brand-page">
        <div className="mx-auto max-w-4xl px-5 py-16">
          <h1 className="font-display text-4xl text-white md:text-5xl">
            {title}
          </h1>
          <p className="mt-2 text-white/70">Last updated: {updated}</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl space-y-8 px-5 py-16">
        {sections.map((s, i) => (
          <div key={i}>
            <h2 className="mb-2 text-xl font-semibold text-white">
              {i + 1}. {s.heading}
            </h2>
            <p className="text-body">{s.body}</p>
          </div>
        ))}
      </section>
    </SiteLayout>
  );
}
