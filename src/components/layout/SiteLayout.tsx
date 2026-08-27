import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { CreateOrgBanner } from "@/components/org/CreateOrgBanner";
import { ArenaPattern } from "@/components/layout/ArenaPattern";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="relative flex-1 pt-20">
        <ArenaPattern />
        <div className="relative z-1">
          <CreateOrgBanner />
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
