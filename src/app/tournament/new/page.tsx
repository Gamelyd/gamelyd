"use client";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { CreateTournamentWizard } from "@/components/tournament/CreateTournamentWizard";

export default function CreateTournamentPage() {
  return (
    <SiteLayout>
      <CreateTournamentWizard />
    </SiteLayout>
  );
}
