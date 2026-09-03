"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { signupAction } from "@/server/actions/authActions";
import { checkUserNameAction } from "@/server/actions/userActions";
import { isStrongPassword } from "@/lib/password";
import type { SignupFormInput } from "@/lib/schemas/user";
import { LIMITS } from "@/lib/limits";

/**
 * Only what it takes to identify an account. Real name, phone and everything
 * else live on the profile: this form stands between a player and a tournament
 * they were invited to, so each extra field costs signups.
 */
const empty: SignupFormInput = {
  user_name: "",
  email: "",
  password: "",
  user_type: "USER",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<keyof SignupFormInput | "confirm", string>>;

export function SignupForm({ onFlip }: { onFlip: () => void }) {
  const [form, setForm] = useState<SignupFormInput>(empty);
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const update = <K extends keyof SignupFormInput>(
    key: K,
    value: SignupFormInput[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const checkUsername = async (name: string) => {
    if (name.trim().length < 2) return;
    const result = await checkUserNameAction(name);
    if (result.ok && !result.data.available) {
      setErrors((prev) => ({ ...prev, user_name: "Username is already taken" }));
    }
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (form.user_name.trim().length < 2)
      next.user_name = errors.user_name ?? "Choose a username";
    else if (errors.user_name) next.user_name = errors.user_name;
    if (!emailPattern.test(form.email))
      next.email = "Enter a valid email address";
    if (!isStrongPassword(form.password))
      next.password = "Password does not meet the requirements below";
    if (confirm !== form.password) next.confirm = "Passwords do not match";

    setErrors(next);
    return Object.values(next).every((v) => !v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    const result = await signupAction(form);
    setLoading(false);

    if (result.ok) {
      setUser(result.data);
      toast.success(result.message ?? "Account created");
      router.push("/");
    } else {
      if (result.fieldErrors) {
        const mapped: Errors = {};
        for (const [key, msgs] of Object.entries(result.fieldErrors)) {
          mapped[key as keyof Errors] = msgs?.[0];
        }
        setErrors((prev) => ({ ...prev, ...mapped }));
      }
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input
        label="Username"
        maxLength={LIMITS.userName}
        value={form.user_name}
        onChange={(e) => update("user_name", e.target.value)}
        onBlur={(e) => checkUsername(e.target.value)}
        error={errors.user_name}
        required
      />
      <Input
        type="email"
        label="Email"
        maxLength={LIMITS.email}
        value={form.email}
        onChange={(e) => update("email", e.target.value)}
        error={errors.email}
        required
      />
      <div className="flex flex-col gap-2">
        <PasswordInput
          label="Password"
          maxLength={LIMITS.password}
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          error={errors.password}
          autoComplete="new-password"
          required
        />
        <PasswordStrength value={form.password} />
      </div>
      <PasswordInput
        label="Confirm password"
        maxLength={LIMITS.password}
        value={confirm}
        onChange={(e) => {
          setConfirm(e.target.value);
          setErrors((prev) => ({ ...prev, confirm: undefined }));
        }}
        error={errors.confirm}
        autoComplete="new-password"
        required
      />
      <Button type="submit" loading={loading} fullWidth>
        Sign Up
      </Button>
      <p className="text-center text-xs text-body">
        By signing up you agree to the{" "}
        <Link href="/terms" className="text-primary hover:underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/policy" className="text-primary hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={onFlip}
        className="text-sm text-primary hover:underline"
      >
        Already have an account? Sign in
      </button>
    </form>
  );
}
