/**
 * MongoDB collection names (mirrors the Go backend). Kept in a dependency-free
 * module (no `server-only`) so it can be shared by both the Next runtime and
 * standalone scripts like `scripts/create-indexes.ts`.
 */
export const Collections = {
  user: "user",
  tournament: "tournament",
  registerTournament: "registerTournament",
  inviteTournament: "inviteTournament",
  draw: "draw",
  contact: "contact",
  reportAbuse: "reportAbuse",
  notification: "notification",
  org: "org",
  orgMember: "orgMember",
  orgInvite: "orgInvite",
  game: "game",
  catalogKind: "catalogKind",
  platform: "platform",
  icon: "icon",
  payment: "payment",
  payout: "payout",
} as const;

export type CollectionName = (typeof Collections)[keyof typeof Collections];
