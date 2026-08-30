"use client";

import { Suspense } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { CreateTournamentWizard } from "@/components/tournament/CreateTournamentWizard";
import { OneOffReturn } from "@/components/tournament/OneOffReturn";

export default function CreateTournamentPage() {
  return (
    <SiteLayout>
      <Suspense fallback={null}>
        <OneOffReturn />
      </Suspense>
      <CreateTournamentWizard />
    </SiteLayout>
  );
}
