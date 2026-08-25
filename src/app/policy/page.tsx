import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Privacy Policy",
  description:
    "How Gamelyd collects, uses, and stores account and tournament information.",
  path: "/policy",
});

const sections: LegalSection[] = [
  {
    heading: "Information We Collect",
    body: "We collect the information you provide when creating an account, including your name, email, phone number and profile details.",
  },
  {
    heading: "How We Use Information",
    body: "Your information is used to operate the platform, run tournaments, send notifications and improve our services.",
  },
  {
    heading: "Data Storage",
    body: "Account data is stored securely. Passwords are hashed and never stored in plain text.",
  },
  {
    heading: "Cookies",
    body: "We use httpOnly cookies to keep you signed in securely. These cookies are not accessible to client-side scripts.",
  },
  {
    heading: "Third Parties",
    body: "We share limited data with payment processors and email providers strictly to deliver our services.",
  },
  {
    heading: "Your Rights",
    body: "You may access, update or delete your personal information at any time from your profile or by contacting us.",
  },
];

export default function PolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="August 2026"
      sections={sections}
    />
  );
}
