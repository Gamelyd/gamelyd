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
        title={title}
        description={`Last updated: ${updated}`}
        width="max-w-4xl"
      />

      {/* Legal copy reads as a document, so the clauses are separated by rules
          rather than boxed into cards. */}
      <section className="border-t border-white/8">
        <div className="mx-auto max-w-4xl px-page py-16">
          <Reveal>
            <div className="divide-y divide-white/10">
              {sections.map((s, i) => (
                <div key={i} className="py-7 first:pt-0 last:pb-0">
                  <h2 className="font-display text-xl text-white">
                    <span className="text-primary">{i + 1}.</span> {s.heading}
                  </h2>
                  {(Array.isArray(s.body) ? s.body : [s.body]).map((p, j) => (
                    <p
                      key={j}
                      className="mt-2 max-w-3xl text-sm leading-relaxed text-body"
                    >
                      {p}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}
