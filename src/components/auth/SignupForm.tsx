"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { signupAction } from "@/server/actions/authActions";
import { checkUserNameAction } from "@/server/actions/userActions";
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

export function SignupForm({ onFlip }: { onFlip: () => void }) {
  const [form, setForm] = useState<SignupInput>(empty);
  const [loading, setLoading] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);
  const { setUser } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const update = <K extends keyof SignupInput>(key: K, value: SignupInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const checkUsername = async (name: string) => {
    if (name.length < 2) return;
    const result = await checkUserNameAction(name);
    setUsernameTaken(result.ok ? !result.data.available : false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameTaken) {
      toast.error("Username is already taken");
      return;
    }
    setLoading(true);
    const result = await signupAction(form);
    setLoading(false);

    if (result.ok) {
      setUser(result.data);
      toast.success(result.message ?? "Account created");
      router.push("/");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="First name"
          value={form.first_name}
          onChange={(e) => update("first_name", e.target.value)}
          required
        />
        <Input
          label="Last name"
          value={form.last_name}
          onChange={(e) => update("last_name", e.target.value)}
          required
        />
      </div>
      <Input
        label="Username"
        value={form.user_name}
        onChange={(e) => update("user_name", e.target.value)}
        onBlur={(e) => checkUsername(e.target.value)}
        error={usernameTaken ? "Username is already taken" : undefined}
        required
      />
      <Input
        type="email"
        label="Email"
        value={form.email}
        onChange={(e) => update("email", e.target.value)}
        required
      />
      <Input
        label="Phone"
        value={form.phone}
        onChange={(e) => update("phone", e.target.value)}
        required
      />
      <Input
        type="password"
        label="Password"
        value={form.password}
        onChange={(e) => update("password", e.target.value)}
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
