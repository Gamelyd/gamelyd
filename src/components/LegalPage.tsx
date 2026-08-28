import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reveal } from "@/components/ui/Reveal";

export interface LegalSection {
  heading: string;
  body: string | string[];
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
      <PageHeader
        kicker="Legal"
        title={title}
        description={`Last updated: ${updated}`}
        width="max-w-4xl"
      />

      <section className="mx-auto max-w-4xl space-y-4 px-page py-16">
        <Reveal>
          <div className="space-y-4">
            {sections.map((s, i) => (
              <div key={i} className="arena-panel arena-hud-corners p-5 sm:p-6">
                <h2 className="font-display text-xl text-white">
                  {i + 1}. {s.heading}
                </h2>
                {(Array.isArray(s.body) ? s.body : [s.body]).map((p, j) => (
                  <p key={j} className="mt-2 text-sm leading-relaxed text-body">
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </Reveal>
      </section>
    </SiteLayout>
  );
}
