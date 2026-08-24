"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthShell } from "@/components/auth/AuthShell";
import { useToast } from "@/components/ui/Toast";
import { resetPasswordAction } from "@/server/actions/authActions";

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const result = await resetPasswordAction(token, { newPassword: password });
    setLoading(false);
    if (result.ok) {
      toast.success(result.message ?? "Password reset");
      router.push("/signup");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <AuthShell title="Set a new password">
      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex flex-col gap-4">
          <Input
            type="password"
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            label="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <Button type="submit" loading={loading} fullWidth>
            Reset password
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
