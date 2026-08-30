import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { pageMeta } from "@/lib/seo";
import { feePercent } from "@/lib/fees";
import { getPlatformFeeBps } from "@/server/services/settingsService";

export const metadata: Metadata = pageMeta({
  title: "Terms of Service",
  description:
    "How Gamelyd works: hosting, joining, the platform fee, held funds, and conduct.",
  path: "/terms",
});

/** Built per request so the published terms always quote the live rate. */
function buildSections(pct: number): LegalSection[] {
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
      "You must be 18 or older to pay money, fund a prize pool, or receive prize money. Free events may be used where the law allows.",
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
      "Any signed-in player can report a tournament from its page: a wrong result, an unresponsive host, a prize that was not paid, cheating, or misleading details. Reports go to our team, and the host is not told who sent them.",
      "Reporting is not a substitute for talking to the host first where that is possible. We may contact either side, and we can suspend an event or hold funds while we look into it.",
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
      "The captain is the player who registered the team. They pay the entry fee, invite teammates, and are the one person Gamelyd pays that team's prize money to. Splitting a prize between teammates is up to the team.",
      "You can also save a team on your profile and enter it into an event in one step. Everyone on a saved team joins the roster together, because they already accepted an invite to that team. The person who created the saved team is its captain.",
      "A host can add players to the roster directly. That is a host action, not the player invite flow.",
    ],
  },
  {
    heading: "Running tournaments: free, plans, and one-off",
    body: [
      "Creating and joining tournaments is free. Larger events (bigger lobbies, leagues, groups, or several at once) need a paid plan or a one-off payment, charged to the organiser. Players are never charged a plan or a one-off.",
      "A plan is a subscription that lifts these limits while it is active. A one-off payment lets you create a single larger event without subscribing. Both are fees for running competitions; neither is prize money, and we do not hold them on anyone's behalf.",
      "If a plan lapses, tournaments already created keep working. You simply cannot create new ones above the free limits until you renew or pay a one-off.",
    ],
  },
  {
    heading: "Prize events, where offered",
    body: [
      "Paid and sponsored prize events are only available where we have turned them on. Where they are not offered, tournaments run without Gamelyd holding any prize money.",
      "Free events have no entry fee and no prize money held by Gamelyd.",
      "Paid events charge one entry fee per team, not per player. The captain pays it at checkout, and teammates the captain invites afterwards join free. Gamelyd keeps a platform fee of " +
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
      "A paid entry is only confirmed after the payment company tells us the charge succeeded. If checkout is cancelled or fails, the team is not registered.",
    ],
  },
  {
    heading: "Your payout account",
    body: [
      "To register for a paid event you must first connect a payout account, because as captain you are who that team's winnings would be sent to. You can add one from Payouts on your profile.",
      "For NGN, GHS, KES, and ZAR you give bank details, which we check with the bank and turn into a Paystack transfer recipient. For USD, GBP, and EUR you complete Stripe's own onboarding and Stripe verifies you. We keep the last four digits of an account number and the reference the payment company gives us. We do not keep your full account number.",
      "Keep the account current and in your own name. We cannot send prize money to an account that is missing, unverified, or rejected by the payment company, and money stays recorded as owed until you fix it.",
    ],
  },
  {
    heading: "Holding money and paying out",
    body: [
      "Entry fees and sponsored deposits are held for that tournament. We do not send them to the host as people join.",
      "When the tournament has a champion, we record what is owed: each paid place from the published split or board, and leftover net funds to the host where the rules say so. The " +
        pct +
        "% platform fee is Gamelyd's and is not part of the winner pot.",
      "A team's prize is recorded against, and paid to, that team's captain, the player who registered the team. We pay one person per team. How a team divides its winnings afterwards is between the players.",
      "On a paid event the host publishes a fixed cash prize for each place, funded by entry fees. The event cannot start until entries cover that board, and we never pay out more than was actually collected. Money left over, and prizes for places no team reached, goes back to the host.",
      "Recording an amount owed is not the same as sending money to a bank. Transfers use Stripe or Paystack to the payout account on the recipient's profile. Timing depends on those companies. Chargebacks, disputes, or a missing or unverified payout account can delay or reverse a transfer.",
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
}

export default async function TermsPage() {
  const pct = feePercent(await getPlatformFeeBps());
  return (
    <LegalPage
      title="Terms of Service"
      updated="28 August 2026"
      sections={buildSections(pct)}
    />
  );
}
