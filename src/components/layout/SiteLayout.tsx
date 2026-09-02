import type { ReactNode } from "react";
import { Suspense } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { CreateOrgBanner } from "@/components/org/CreateOrgBanner";
import { ArenaPattern } from "@/components/layout/ArenaPattern";

export function SiteLayout({
  children,
  /*
   * The hex field belongs behind the top of a page, not the whole of it. Run
   * continuously it sits under the content everywhere and muddies cards,
   * tables, and form fields; faded out after the first screen it frames the
   * header and then gets out of the way. "full" stays for pages that are
   * mostly empty and want the texture throughout.
   */
  pattern = "top",
}: {
  children: ReactNode;
  pattern?: "full" | "top";
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={null}>
        <Navbar />
      </Suspense>
      <main className="relative flex-1 pt-20">
        {pattern === "top" ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-184 mask-[linear-gradient(to_bottom,#000_55%,transparent)]">
            <ArenaPattern />
          </div>
        ) : (
          <ArenaPattern />
        )}
        <div className="relative z-1">
          <CreateOrgBanner />
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
