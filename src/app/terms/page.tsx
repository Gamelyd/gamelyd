import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Terms of Service",
  description:
    "The rules for using Gamelyd: accounts, tournaments, payments, and conduct.",
  path: "/terms",
});

const sections: LegalSection[] = [
  {
    heading: "Acceptance of Terms",
    body: "By accessing or using Gamelyd, you agree to be bound by these Terms of Service and all applicable laws and regulations.",
  },
  {
    heading: "Accounts",
    body: "You are responsible for maintaining the confidentiality of your account and password and for restricting access to your device.",
  },
  {
    heading: "Tournaments",
    body: "Organizers are responsible for the accuracy of tournament details, prizes and fixtures. Gamelyd is not liable for disputes between participants.",
  },
  {
    heading: "Payments",
    body: "Paid tournaments are processed through third-party payment providers. Entry fees and prizes are governed by the organizer's rules.",
  },
  {
    heading: "Conduct",
    body: "Cheating, harassment and abusive behaviour are strictly prohibited and may result in suspension or termination of your account.",
  },
  {
    heading: "Changes",
    body: "We may revise these terms at any time. Continued use of the platform constitutes acceptance of the updated terms.",
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="August 2026"
      sections={sections}
    />
  );
}
