import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHeader } from "@/components/layout/PageHeader";

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
      <PageHeader
        title={title}
        description={`Last updated: ${updated}`}
        width="max-w-4xl"
      />

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
