import type { Metadata } from "next";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/Button";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Page not found",
  description: "This page could not be found on Gamelyd.",
  path: "/",
  noIndex: true,
});

export default function NotFound() {
  return (
    <SiteLayout>
      <section className="px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-primary/25 bg-primary-panel">
          <div className="border-b border-primary/20 px-6 py-3 sm:px-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
              No lobby
            </p>
          </div>
          <div className="px-6 py-12 text-center sm:px-10 sm:py-14">
            <p className="font-display text-[7.5rem] leading-none text-primary sm:text-[9rem]">
              404
            </p>
            <h1 className="mt-2 font-display text-3xl leading-none text-white sm:text-4xl">
              Page not found
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm text-body">
              This URL does not exist, or the tournament was taken down.
              Head home or browse live events.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Link href="/">
                <Button className="w-full">Back home</Button>
              </Link>
              <Link href="/tournament/all/ALL/ALL">
                <Button variant="outline" className="w-full">
                  Browse tournaments
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
