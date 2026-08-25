import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Forgot password",
  description: "Request a link to reset your Gamelyd password.",
  path: "/forgotpassword",
  noIndex: true,
});

export default function ForgotPasswordLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
