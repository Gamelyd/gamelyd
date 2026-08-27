"use client";

import { useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { submitContactAction } from "@/server/actions/contactActions";
import { Reveal } from "@/components/ui/Reveal";

export default function ContactPage() {
  const [form, setForm] = useState({ Name: "", Email: "", Message: "" });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await submitContactAction(form);
    setLoading(false);
    if (result.ok) {
      toast.success(result.message ?? "Message sent");
      setForm({ Name: "", Email: "", Message: "" });
    } else {
      toast.error(result.error);
    }
  };

  return (
    <SiteLayout>
      <PageHeader
        kicker="Support"
        title="Open a line"
        description="Questions about a cup, hosting, or a partnership — send a message. We read everything that lands here."
        width="max-w-5xl"
      />

      <section className="mx-auto max-w-5xl px-5 py-16">
        <Reveal>
          <div className="grid gap-6 md:grid-cols-2">
        <form
          onSubmit={handleSubmit}
          className="arena-panel arena-hud-corners flex flex-col gap-4 p-5 sm:p-6"
        >
          <Input
            label="Name"
            value={form.Name}
            onChange={(e) => setForm({ ...form, Name: e.target.value })}
            required
          />
          <Input
            type="email"
            label="Email"
            value={form.Email}
            onChange={(e) => setForm({ ...form, Email: e.target.value })}
            required
          />
          <TextArea
            label="Message"
            rows={5}
            value={form.Message}
            onChange={(e) => setForm({ ...form, Message: e.target.value })}
            required
          />
          <Button type="submit" loading={loading}>
            Send message
          </Button>
        </form>

        <div className="arena-panel arena-hud-corners space-y-6 p-5 text-body sm:p-6">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Email
            </h3>
            <p className="mt-1">contact@gamelyd.com</p>
          </div>
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Website
            </h3>
            <p className="mt-1">www.gamelyd.co</p>
          </div>
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Support hours
            </h3>
            <p className="mt-1">Monday – Friday, 9am – 6pm WAT</p>
          </div>
        </div>
          </div>
        </Reveal>
      </section>
    </SiteLayout>
  );
}
