"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { createOrgAction } from "@/server/actions/orgActions";
import { IconPicker } from "@/components/ui/IconPicker";
import { FALLBACKS } from "@/lib/icons";
import { useIcons } from "@/hooks/useIcons";
import type { CreateOrgInput } from "@/lib/schemas/org";

const empty: CreateOrgInput = {
  name: "",
  description: "",
  image: FALLBACKS.team,
  banner: "",
  website: "",
  twitter: "",
  instagram: "",
  linkedin: "",
  facebook: "",
};

export default function CreateOrgPage() {
  const { isAuthenticated, refreshOrgs } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<CreateOrgInput>(empty);
  const [loading, setLoading] = useState(false);
  const { icons: orgIcons, loading: orgIconsLoading } = useIcons("team");

  useEffect(() => {
    if (!isAuthenticated) router.push("/signup?redirect=/org/new");
  }, [isAuthenticated, router]);

  const update = <K extends keyof CreateOrgInput>(
    key: K,
    value: CreateOrgInput[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await createOrgAction(form);
    setLoading(false);
    if (result.ok) {
      toast.success(result.message ?? "Organization created");
      await refreshOrgs();
      router.push(`/org/${result.data.org_id}`);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <SiteLayout>
      <PageHeader
        title="Create an organization"
        description="Host tournaments under your brand and invite teammates to help manage them."
        width="max-w-3xl"
      />

      <section className="mx-auto max-w-3xl px-5 py-12">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input
            label="Organization name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />
          <IconPicker
            label="Logo"
            icons={orgIcons}
            value={form.image}
            onChange={(url) => update("image", url)}
            loading={orgIconsLoading}
          />
          <TextArea
            label="Description"
            rows={4}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Website"
              placeholder="https://..."
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
            />
            <Input
              label="Twitter"
              value={form.twitter}
              onChange={(e) => update("twitter", e.target.value)}
            />
            <Input
              label="Instagram"
              value={form.instagram}
              onChange={(e) => update("instagram", e.target.value)}
            />
            <Input
              label="LinkedIn"
              value={form.linkedin}
              onChange={(e) => update("linkedin", e.target.value)}
            />
          </div>
          <div>
            <Button type="submit" loading={loading}>
              Create organization
            </Button>
          </div>
        </form>
      </section>
    </SiteLayout>
  );
}
