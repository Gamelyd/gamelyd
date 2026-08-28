import { SiteLayout } from "@/components/layout/SiteLayout";
import { Loader } from "@/components/ui/Loader";

export default function Loading() {
  return (
    <SiteLayout>
      <Loader variant="page" label="Loading games" />
    </SiteLayout>
  );
}
