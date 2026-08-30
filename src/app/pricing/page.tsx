import Link from "next/link";
import type { Metadata } from "next";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { pageMeta } from "@/lib/seo";
import { PLANS, MODE_LABEL, limitLabel, type Plan } from "@/lib/plans";
import { getOneOff } from "@/server/services/settingsService";
import { formatMoney } from "@/lib/currency";

export const metadata: Metadata = pageMeta({
  title: "Pricing",
  description:
    "Tournaments are free to run and free to join. Organisers running at scale can upgrade with a plan or a one-off payment.",
  path: "/pricing",
});

const ORDER: Plan[] = ["FREE", "CLUB", "LEAGUE"];

/** Turns a tier's limits into the plain lines shown on its card. */
function featureLines(plan: Plan): string[] {
  const l = PLANS[plan];
  return [
    `${limitLabel(l.maxTeams)} teams per tournament`,
    l.modes.length === 1
      ? `${MODE_LABEL[l.modes[0]]} only`
      : `${l.modes.map((m) => MODE_LABEL[m]).join(", ")}`,
    `${limitLabel(l.maxActive)} tournament${l.maxActive === 1 ? "" : "s"} running at once`,
    l.maxManagers === 0
      ? "No co-managers"
      : `${limitLabel(l.maxManagers)} co-managers`,
    l.canHostAsOrg ? "Host under your organization's name" : "Personal hosting",
  ];
}

export default async function PricingPage() {
  const oneOff = await getOneOff();

  return (
    <SiteLayout>
      <PageHeader
        kicker="Pricing"
        title="Free to play. Free to run."
        description="Creating a tournament and joining one are always free. If you organise at scale, a plan or a one-off payment lifts the limits. Players are never charged."
      />

      <section className="mx-auto max-w-page px-page py-12">
        <div className="grid gap-5 lg:grid-cols-3">
          {ORDER.map((plan) => {
            const l = PLANS[plan];
            const featured = plan === "CLUB";
            return (
              <div
                key={plan}
                className={`flex flex-col rounded-2xl border p-6 ${
                  featured
                    ? "border-primary bg-primary/10"
                    : "border-surface-2 bg-surface"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-2xl text-white">
                    {l.label}
                  </h2>
                  {featured ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-primary">
                      Most popular
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-body">{l.blurb}</p>

                <p className="mt-4 font-display text-3xl text-white">
                  {plan === "FREE" ? "Free" : "Contact us"}
                </p>
                <p className="text-xs text-body">
                  {plan === "FREE"
                    ? "No card, no catch."
                    : "Monthly subscription, billed to the organiser."}
                </p>

                <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-body">
                  {featureLines(plan).map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="mt-0.5 text-primary">✓</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {plan === "FREE" ? (
                    <Link href="/tournament/new">
                      <span className="block rounded-lg border border-primary/40 py-2.5 text-center text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-on-primary">
                        Create a tournament
                      </span>
                    </Link>
                  ) : (
                    <Link href="/contact-us?topic=upgrade">
                      <span
                        className={`block rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${
                          featured
                            ? "bg-primary text-on-primary hover:bg-primary-dark"
                            : "border border-primary/40 text-primary hover:bg-primary hover:text-on-primary"
                        }`}
                      >
                        Contact us to upgrade
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {oneOff.enabled && oneOff.priceMinor > 0 ? (
          <div className="mt-8 rounded-2xl border border-surface-2 bg-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-xl">
                <h2 className="font-display text-xl text-white">
                  Just one big tournament?
                </h2>
                <p className="mt-1 text-sm text-body">
                  Pay once to create a single event above the free limits, with
                  no subscription. You choose the option right in the create
                  form, and only pay if your event needs it.
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl text-white">
                  {formatMoney(oneOff.priceMinor / 100, oneOff.currency)}
                </p>
                <p className="text-xs text-body">per tournament</p>
              </div>
            </div>
          </div>
        ) : null}

        <p className="mt-8 text-center text-sm text-body">
          Not sure which fits?{" "}
          <Link href="/contact-us" className="text-primary hover:underline">
            Talk to us
          </Link>
          . Existing tournaments always keep working, even if a plan lapses.
        </p>
      </section>
    </SiteLayout>
  );
}
