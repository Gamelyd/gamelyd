import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Contact",
  description:
    "Questions, feedback, or partnerships — send a message and we will get back to you.",
  path: "/contact-us",
});

export default function ContactLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
