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
    heading: "Running tournaments is free",
    body: [
      "Creating, running and joining tournaments is free. Every format, every organiser tool and as many tournaments as you like are included at no charge, and we do not ask for a card to start.",
      "There is a ceiling on how many teams one tournament can hold, so a single event cannot become unreasonably expensive for us to run. It is a technical limit, not a paywall. Contact us if your event needs to be bigger and we will lift it.",
      "Public tournament pages on the free plan carry a small Gamelyd credit.",
    ],
  },
  {
    heading: "Paid plans",
    body: [
      "A paid plan is optional and changes nothing about how a tournament runs. It covers presentation: your own branding on the tournament page and the removal of the Gamelyd credit. Limits and prices are shown on the pricing page.",
      "A plan is billed to the organiser. Players are never charged for a plan, and never need one to register, play, or see results.",
      "If a plan lapses, tournaments already created keep working. The Gamelyd credit returns to your public pages until it is renewed.",
    ],
  },
  {
    heading: "Entry fees and prize money",
    body: [
      "Gamelyd does not currently collect entry fees and does not process payments between players and organisers. If we introduce this, it will be announced and these terms will be updated before it applies to anyone.",
      "A tournament may advertise prizes. Those amounts are supplied and displayed on behalf of the host: Gamelyd does not hold, transfer, or guarantee prize money, and the host awards it directly. Any dispute about a prize is between the players and the host who advertised it.",
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
