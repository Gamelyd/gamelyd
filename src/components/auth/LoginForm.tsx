"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { loginAction } from "@/server/actions/authActions";

export function LoginForm({ onFlip }: { onFlip: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        type="email"
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        type="password"
        label="Password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
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
