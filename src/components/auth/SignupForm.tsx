"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidPhoneNumber } from "libphonenumber-js";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { signupAction } from "@/server/actions/authActions";
import { checkUserNameAction } from "@/server/actions/userActions";
import { isStrongPassword } from "@/lib/password";
import type { SignupInput } from "@/lib/schemas/user";

const empty: SignupInput = {
  first_name: "",
  last_name: "",
  user_name: "",
  email: "",
  phone: "",
  password: "",
  user_type: "USER",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<keyof SignupInput | "confirm", string>>;

export function SignupForm({ onFlip }: { onFlip: () => void }) {
  const [form, setForm] = useState<SignupInput>(empty);
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const update = <K extends keyof SignupInput>(key: K, value: SignupInput[K]) => {
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
    if (form.first_name.trim().length < 2)
      next.first_name = "Enter your first name";
    if (form.last_name.trim().length < 2)
      next.last_name = "Enter your last name";
    if (form.user_name.trim().length < 2)
      next.user_name = errors.user_name ?? "Choose a username";
    else if (errors.user_name) next.user_name = errors.user_name;
    if (!emailPattern.test(form.email))
      next.email = "Enter a valid email address";
    if (!form.phone || !isValidPhoneNumber(form.phone))
      next.phone = "Enter a valid phone number including country code";
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
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="First name"
          value={form.first_name}
          onChange={(e) => update("first_name", e.target.value)}
          error={errors.first_name}
          required
        />
        <Input
          label="Last name"
          value={form.last_name}
          onChange={(e) => update("last_name", e.target.value)}
          error={errors.last_name}
          required
        />
      </div>
      <Input
        label="Username"
        value={form.user_name}
        onChange={(e) => update("user_name", e.target.value)}
        onBlur={(e) => checkUsername(e.target.value)}
        error={errors.user_name}
        required
      />
      <Input
        type="email"
        label="Email"
        value={form.email}
        onChange={(e) => update("email", e.target.value)}
        error={errors.email}
        required
      />
      <PhoneInput
        label="Phone"
        value={form.phone}
        onChange={(value) => update("phone", value)}
        error={errors.phone}
        required
      />
      <div className="flex flex-col gap-2">
        <PasswordInput
          label="Password"
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
