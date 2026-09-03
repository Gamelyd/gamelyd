"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { loginAction } from "@/server/actions/authActions";
import { LIMITS } from "@/lib/limits";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ onFlip }: { onFlip: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const next: { email?: string; password?: string } = {};
    if (!emailPattern.test(email)) next.email = "Enter a valid email address";
    if (!password) next.password = "Enter your password";
    setErrors(next);
    if (next.email || next.password) return;

    setLoading(true);
    const result = await loginAction({ email, password });
    setLoading(false);

    if (result.ok) {
      setUser(result.data);
      toast.success(result.message ?? "Welcome back");
      router.push(params.get("redirect") ?? "/");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input
        type="email"
        label="Email"
        maxLength={LIMITS.email}
        placeholder="you@example.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setErrors((prev) => ({ ...prev, email: undefined }));
        }}
        error={errors.email}
        required
      />
      <PasswordInput
        label="Password"
        maxLength={LIMITS.password}
        placeholder="••••••••"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setErrors((prev) => ({ ...prev, password: undefined }));
        }}
        error={errors.password}
        autoComplete="current-password"
        required
      />
      <Button type="submit" loading={loading} fullWidth>
        Sign In
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onFlip}
          className="text-primary hover:underline"
        >
          Create an account
        </button>
        <a href="/forgotpassword" className="text-body hover:text-primary">
          Forgot password?
        </a>
      </div>
    </form>
  );
}
