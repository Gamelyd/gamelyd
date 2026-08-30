import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Terms of Service",
  description:
    "How Gamelyd works: hosting tournaments, joining, plans, and conduct.",
  path: "/terms",
});

/** Built per request so the published terms always quote the live rate. */
function buildSections(): LegalSection[] {
  return [
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
      "You must be 18 or older to pay for a plan or a one-off tournament.",
    ],
  },
  {
    heading: "Verified accounts",
    body: [
      "A verified badge means we checked that account's details and confirmed they are correct and that the person is reachable on them. It is not an endorsement of how someone hosts or plays.",
      "Because verification rests on those details, a verified account cannot change its own email or phone. Request a change from your profile settings and we will verify the new details before applying them. Until then the old ones stay in place.",
      "We can remove verification at any time, for example if contact details stop working or we can no longer confirm them.",
    ],
  },
  {
    heading: "Reporting a problem",
    body: [
      "Any signed-in player can report a tournament from its page: a wrong result, an unresponsive host, cheating, or misleading details. Reports go to our team, and the host is not told who sent them.",
      "Reporting is not a substitute for talking to the host first where that is possible. We may contact either side, and we can suspend an event while we look into it.",
    ],
  },
  {
    heading: "Hosts and players",
    body: [
      "A host creates the tournament, sets the rules, and runs fixtures. Players join as teams. Organizations can host under a shared name.",
      "Hosts must set honest details: game, format, dates, and rules.",
    ],
  },
  {
    heading: "Joining an event",
    body: [
      "Every tournament is listed on Gamelyd. Invite-only (the default) means you can see the event, but you can register only after the host invites you and you accept. Anyone-can-join events let any signed-in user register.",
      "In duo and squad events, the captain registers first, then invites teammates. Teammates are not on the roster until they accept. A player cannot be on two teams in the same tournament.",
      "The captain is the player who registered the team. They invite teammates, and teammates join when they accept.",
      "You can also save a team on your profile and enter it into an event in one step. Everyone on a saved team joins the roster together, because they already accepted an invite to that team. The person who created the saved team is its captain.",
      "A host can add players to the roster directly. That is a host action, not the player invite flow.",
    ],
  },
  {
    heading: "Running tournaments: free, plans, and one-off",
    body: [
      "Creating and joining tournaments is free. Larger events (bigger lobbies, leagues, groups, or several at once) need a paid plan or a one-off payment, charged to the organiser. Players are never charged a plan or a one-off.",
      "A plan is a subscription that lifts these limits while it is active. A one-off payment lets you create a single larger event without subscribing. Both are fees for running competitions.",
      "If a plan lapses, tournaments already created keep working. You simply cannot create new ones above the free limits until you renew or pay a one-off.",
    ],
  },
  {
    heading: "How we charge",
    body: [
      "Plan and one-off payments are handled by our payment provider. We never take card numbers on our forms; the payment company handles the card page.",
      "A payment is only confirmed after the payment company tells us the charge succeeded. If checkout is cancelled or fails, nothing is charged and the plan or one-off does not take effect.",
    ],
  },
  {
    heading: "Disputes and results",
    body: [
      "The host records scores and winners on Gamelyd. If players disagree with a result, raise it with the host first.",
      "Gamelyd is not a court and does not guarantee a match outcome. Cheating, fake accounts, or payment abuse can get an account suspended.",
    ],
  },
  {
    heading: "Conduct",
    body: "Do not cheat, harass, impersonate, or abuse the site. We may suspend or delete accounts that break this. Report abuse from the contact page.",
  },
  {
    heading: "Our role",
    body: [
      "We provide the software and checkout for plans and one-off tournaments. We are not a bank, insurer, or the publisher of any game.",
      "The site is provided as available. We are not liable for lost matches, downtime, or indirect loss. Our liability is limited to the fees you paid us in the previous twelve months.",
    ],
  },
  {
    heading: "Changes",
    body: "We may update these terms. The date at the top is the current version. Continued use after a change means you accept the new terms. Questions: use the contact page.",
  },
  ];
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="28 August 2026"
      sections={buildSections()}
    />
  );
}
