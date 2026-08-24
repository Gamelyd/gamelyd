"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/context/AuthContext";

function AuthPanel() {
  const [showLogin, setShowLogin] = useState(true);
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.push("/");
  }, [isAuthenticated, router]);

  return (
    <AuthShell title={showLogin ? "Welcome Back" : "Create an Account"}>
      {showLogin ? (
        <LoginForm onFlip={() => setShowLogin(false)} />
      ) : (
        <SignupForm onFlip={() => setShowLogin(true)} />
      )}
    </AuthShell>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <AuthPanel />
    </Suspense>
  );
}
