"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { Button } from "@/components/ui/Button";
import { AuthShell } from "@/components/auth/AuthShell";
import { useToast } from "@/components/ui/Toast";
import { resetPasswordAction } from "@/server/actions/authActions";
import { isStrongPassword } from "@/lib/password";
import { LIMITS } from "@/lib/limits";

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
    if (!isStrongPassword(password)) {
      toast.error("Password does not meet the requirements");
      return;
    }
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
      <form onSubmit={handleSubmit} noValidate className="w-full">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <PasswordInput
              label="New password"
              maxLength={LIMITS.password}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <PasswordStrength value={password} />
          </div>
          <PasswordInput
            label="Confirm password"
            maxLength={LIMITS.password}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={
              confirm && confirm !== password
                ? "Passwords do not match"
                : undefined
            }
            autoComplete="new-password"
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
