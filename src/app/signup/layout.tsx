import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Sign in",
  description:
    "Sign in or create a Gamelyd account to host and join game tournaments.",
  path: "/signup",
  noIndex: true,
});

export default function SignupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
