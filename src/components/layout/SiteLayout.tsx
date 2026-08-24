import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { CreateOrgBanner } from "@/components/org/CreateOrgBanner";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 pt-20">
        <CreateOrgBanner />
        {children}
      </main>
      <Footer />
    </div>
  );
}
