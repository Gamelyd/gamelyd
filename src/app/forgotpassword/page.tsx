"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthShell } from "@/components/auth/AuthShell";
import { useToast } from "@/components/ui/Toast";
import { forgotPasswordAction } from "@/server/actions/authActions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await forgotPasswordAction({ email });
    setLoading(false);
    if (result.ok) {
      setSent(true);
      toast.success(result.message ?? "Check your email");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <AuthShell title="Reset your password">
      <form onSubmit={handleSubmit} className="w-full">
        <p className="mb-6 text-sm text-body">
          Enter your email and we&apos;ll send you a reset link.
        </p>
        {sent ? (
          <p className="rounded-lg border border-primary/40 bg-surface p-4 text-sm text-white">
            If an account exists for {email}, a reset link is on its way.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <Input
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" loading={loading} fullWidth>
              Send reset link
            </Button>
          </div>
        )}
        <Link
          href="/signup"
          className="mt-4 block text-sm text-primary hover:underline"
        >
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}
