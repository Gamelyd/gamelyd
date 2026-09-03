import Link from "next/link";
import type { Metadata } from "next";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { pageMeta } from "@/lib/seo";
import {
  INTERVAL_LABEL,
  MODE_LABEL,
  PLAN_ORDER,
  limitLabel,
  type Plan,
  type PlanLimits,
} from "@/lib/plans";
import { getPlans } from "@/server/services/settingsService";
import { formatMoney } from "@/lib/currency";

export const metadata: Metadata = pageMeta({
  title: "Pricing",
  description:
    "Gamelyd is free. Every format, every organiser tool, as many tournaments as you want. Paying is only for putting your own club's name on it.",
  path: "/pricing",
});

/**
 * Feature lines are derived from the limits that actually enforce them, so the
 * page can never advertise a ceiling the server does not honour.
 */
function featureLines(limits: PlanLimits): string[] {
  return [
    `${limitLabel(limits.maxActive)} tournaments`,
    `Up to ${limits.maxTeams} teams in one tournament`,
    limits.modes.length === 1
      ? `${MODE_LABEL[limits.modes[0]]} only`
      : `Every format: ${limits.modes.map((m) => MODE_LABEL[m]).join(", ")}`,
    "Registration, fixtures, brackets, groups and standings",
    "A public tournament page anyone can follow",
    `${limitLabel(limits.maxManagers)} co-managers`,
    limits.canHostAsOrg
      ? "Host under your club or organization's name"
      : "Personal hosting",
    limits.canBrand ? "Your own branding on the page" : "Gamelyd branding",
    limits.showsAttribution
      ? "Public pages carry a small Gamelyd credit"
      : "No Gamelyd credit on your pages",
  ];
}

function priceLabel(limits: PlanLimits): string {
  if (limits.priceMinor === 0) return "Free";
  return formatMoney(limits.priceMinor / 100, limits.currency);
}

export default async function PricingPage() {
  const plans = await getPlans();
  const sold = PLAN_ORDER.filter((plan) => plans[plan].sold);

  return (
    <SiteLayout>
      <PageHeader
        title="Free to run. Free to play."
        description="Gamelyd does not charge for the software. Create your tournament, run every format, invite as many players as you need. Paying is only for taking our name off it."
      />

      <section className="mx-auto max-w-page px-page py-12">
        <div className="grid gap-5 md:grid-cols-2">
          {sold.map((plan: Plan) => {
            const limits = plans[plan];
            const featured = plan === "FREE";
            return (
              <div
                key={plan}
                className={`flex flex-col rounded-2xl border bg-primary-panel p-6 sm:p-8 ${
                  featured ? "border-primary" : "border-white/10"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-2xl text-white">
                    {limits.label}
                  </h2>
                  {featured ? (
                    <span className="inline-flex items-center justify-center leading-none rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-primary">
                      Start here
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 min-h-10 text-sm text-body">{limits.blurb}</p>

                <p className="mt-5 font-display text-4xl leading-none text-secondary">
                  {priceLabel(limits)}
                  {limits.priceMinor > 0 ? (
                    <span className="font-sans text-base text-body">
                      {INTERVAL_LABEL[limits.interval]}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1.5 text-xs text-body">
                  {limits.priceMinor === 0
                    ? "No card, no trial, no feature held back."
                    : "Billed to the organiser. Players are never charged."}
                </p>

                <ul className="mt-6 flex flex-1 flex-col gap-2.5 border-t border-white/10 pt-6 text-sm text-body">
                  {featureLines(limits).map((line) => (
                    <li key={line} className="flex gap-2.5">
                      <span className="mt-0.5 text-primary">✓</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {limits.priceMinor === 0 ? (
                    <Link href="/tournament/new">
                      <span className="block rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-on-primary transition-colors hover:bg-primary-dark">
                        Create a tournament
                      </span>
                    </Link>
                  ) : (
                    <Link href="/contact-us?topic=club">
                      <span className="block rounded-lg border border-primary py-2.5 text-center text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-on-primary">
                        Start a {limits.label} plan
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-body">
          Running something bigger than {plans.FREE.maxTeams} teams?{" "}
          <Link href="/contact-us" className="text-primary hover:underline">
            Talk to us
          </Link>{" "}
          and we will lift the ceiling for your event. Existing tournaments
          always keep working, even if a plan lapses.
        </p>
      </section>
    </SiteLayout>
  );
}
