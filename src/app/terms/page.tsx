import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { pageMeta } from "@/lib/seo";
import { feePercent } from "@/lib/fees";

export const metadata: Metadata = pageMeta({
  title: "Terms of Service",
  description:
    "How Gamelyd works: hosting, joining, the platform fee, held funds, and conduct.",
  path: "/terms",
});

const pct = feePercent();

const sections: LegalSection[] = [
  {
    heading: "The service",
    body: [
      "Gamelyd is a website for hosting and playing game tournaments. You can create a lobby, register a team, draw fixtures, and record results.",
      "By using Gamelyd you agree to these terms. If you do not agree, do not use the site.",
    ],
  },
  {
    heading: "Accounts",
    body: [
      "You must give a real email and keep your password private. You are responsible for activity on your account.",
      "You must be 18 or older to pay money, fund a prize pool, or receive prize money. Free events may be used where the law allows.",
    ],
  },
  {
    heading: "Hosts and players",
    body: [
      "A host creates the tournament, sets the rules, and runs fixtures. Players join as teams. Organizations can host under a shared name.",
      "Hosts must set honest details: game, format, dates, fees, and prizes. Do not list a prize you will not fund.",
    ],
  },
  {
    heading: "Joining an event",
    body: [
      "Every tournament is listed on Gamelyd. Invite-only (the default) means you can see the event, but you can register only after the host invites you and you accept. Anyone-can-join events let any signed-in user register.",
      "In duo and squad events, the captain registers first, then invites teammates. Teammates are not on the roster until they accept. A player cannot be on two teams in the same tournament.",
      "A host can add players to the roster directly. That is a host action, not the player invite flow.",
    ],
  },
  {
    heading: "Free, paid, and sponsored",
    body: [
      "Free events have no entry fee and no prize money held by Gamelyd.",
      "Paid events charge an entry fee at checkout. The fee you type is what the player pays. Gamelyd keeps a platform fee of " +
        pct +
        "% of that amount. The rest goes into that tournament's prize pot.",
      "Sponsored events have a prize board set by the host. The host pays the board plus the same " +
        pct +
        "% platform fee so winners can receive the published amounts. A sponsored event is not listed publicly until that deposit succeeds.",
    ],
  },
  {
    heading: "How we charge",
    body: [
      "Checkout is Stripe for USD, GBP, and EUR, and Paystack for NGN, GHS, KES, and ZAR. The currency on the tournament is the currency you pay. Gamelyd does not convert one currency into another.",
      "We never take card numbers on our forms. The payment company handles the card page.",
      "A paid seat is only confirmed after the payment company tells us the charge succeeded. If checkout is cancelled or fails, you are not registered.",
    ],
  },
  {
    heading: "Holding money and paying out",
    body: [
      "Entry fees and sponsored deposits are held for that tournament. We do not send them to the host as people join.",
      "When the tournament has a champion, we record what is owed: winners from the published split or board, and leftover net funds to the host where the rules say so. The " +
        pct +
        "% platform fee is Gamelyd's and is not part of the winner pot.",
      "Recording an amount owed is not the same as sending money to a bank. Transfers use Stripe or Paystack once we have payout details. Timing depends on those companies. Chargebacks, disputes, or missing payout details can delay or reverse a transfer.",
      "If you cancel checkout, you are not charged. If a funded event is cancelled before it starts, contact us about returning held entry fees or unused sponsored deposits. Processor fees and chargebacks can reduce what can be returned.",
    ],
  },
  {
    heading: "Disputes and results",
    body: [
      "The host records scores and winners on Gamelyd. If players disagree with a result, raise it with the host first. We can freeze or reverse a settlement if we reasonably believe there was fraud, a rule break, or a payment dispute.",
      "Gamelyd is not a court and does not guarantee a match outcome. Cheating, fake accounts, or chargeback abuse can get an account suspended and funds held.",
    ],
  },
  {
    heading: "Conduct",
    body: "Do not cheat, harass, impersonate, or abuse the site. We may suspend or delete accounts that break this. Report abuse from the contact page.",
  },
  {
    heading: "Our role",
    body: [
      "We provide the software, checkout, and holding of tournament money as described here. We are not a bank, insurer, or the publisher of any game.",
      "The site is provided as available. We are not liable for lost matches, downtime, or indirect loss. Our liability for a paid event is limited to the fees we collected on that event.",
    ],
  },
  {
    heading: "Changes",
    body: "We may update these terms. The date at the top is the current version. Continued use after a change means you accept the new terms. Questions: use the contact page.",
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="28 August 2026"
      sections={sections}
    />
  );
}
