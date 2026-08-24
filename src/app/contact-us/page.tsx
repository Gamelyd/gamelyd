"use client";

import { useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { submitContactAction } from "@/server/actions/contactActions";

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
      <section className="gradient-brand-page">
        <div className="mx-auto max-w-4xl px-5 py-16">
          <h1 className="font-display text-4xl text-white md:text-5xl">
            Get in touch
          </h1>
          <p className="mt-2 text-white/80">
            Questions, feedback or partnerships — we&apos;d love to hear from you.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-10 px-5 py-16 md:grid-cols-2">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

        <div className="space-y-6 text-body">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
              Email
            </h3>
            <p className="mt-1">contact@gamelyd.com</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
              Website
            </h3>
            <p className="mt-1">www.gamelyd.co</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
              Support hours
            </h3>
            <p className="mt-1">Monday – Friday, 9am – 6pm WAT</p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
