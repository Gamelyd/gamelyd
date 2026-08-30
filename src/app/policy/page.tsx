import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Privacy Policy",
  description:
    "What Gamelyd collects, why we keep it, and who we share it with to run tournaments and payments.",
  path: "/policy",
});

const sections: LegalSection[] = [
  {
    heading: "What this covers",
    body: "This policy explains what we collect when you use Gamelyd, why we use it, and who sees it. It applies to the website at gamelyd.com (and www.gamelyd.com).",
  },
  {
    heading: "What we collect",
    body: [
      "Account: name, username, email, phone, password (stored hashed, never in plain text), profile photo, and optional social links.",
      "Tournaments: events you host or join, team names, in-game names, scores, and messages you post in tournament notes.",
      "Payments: for plan and one-off tournament payments, the amount, currency, status, and a reference from our payment provider. We do not store full card numbers.",
      "Teams you save on your profile: the team name and crest, and which players are on it.",
      "Technical: sign-in cookies, device and IP used to keep the session honest, and basic logs to fix errors.",
    ],
  },
  {
    heading: "Why we use it",
    body: [
      "To run your account, tournaments, and checkout.",
      "To email you about invites, registration, matches, and security.",
      "To stop abuse and fraud.",
      "We do not sell your personal information.",
    ],
  },
  {
    heading: "Cookies",
    body: "We use httpOnly session cookies so you stay signed in. They are not readable by scripts in the browser. We do not use them for advertising networks.",
  },
  {
    heading: "Who we share with",
    body: [
      "Our payment provider, to charge plan and one-off tournament payments. They receive what the charge needs, such as your name, email, and amount.",
      "Email delivery (our mail provider), to send the messages above.",
      "Hosting and database providers that store the site and files you upload (covers, crests, avatars).",
      "We share with others only if the law requires it, or to protect the service from abuse.",
    ],
  },
  {
    heading: "How long we keep it",
    body: "We keep account and tournament records while your account is open and as long as we need them for disputes, tax, or the law. You can update profile fields in the app. To delete an account, contact us.",
  },
  {
    heading: "Your choices",
    body: "You can change profile details while signed in. You can ask what we hold, or ask us to correct or delete it, through the contact page. We may keep a minimum record if a payment or dispute is still open.",
  },
  {
    heading: "Children",
    body: "Gamelyd is not aimed at children under 13. You must be 18 to pay for a plan or a one-off tournament.",
  },
  {
    heading: "Changes",
    body: "We may update this policy. The date at the top is the current version. Questions: use the contact page.",
  },
];

export default function PolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="28 August 2026"
      sections={sections}
    />
  );
}
