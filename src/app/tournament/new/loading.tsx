import { SiteLayout } from "@/components/layout/SiteLayout";
import { Loader } from "@/components/ui/Loader";

export default function CreateTournamentLoading() {
  return (
    <SiteLayout>
      <Loader variant="page" label="Loading arena" />
    </SiteLayout>
  );
}
