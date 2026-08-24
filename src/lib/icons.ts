/**
 * Icon catalog from the original Gamelyd ImageKit library.
 * Tournament covers, team crests, and player avatars all live here so
 * pickers and fallbacks stay in sync.
 */

const IK = "https://ik.imagekit.io/dmkczkqll/Gamelyd";

export type AppIcon = {
  id: string;
  label: string;
  url: string;
};

export const TOURNAMENT_ICONS: AppIcon[] = [
  {
    id: "warzone2",
    label: "Warzone",
    url: `${IK}/Tournaments/warzone2.jpeg?updatedAt=1695930036202`,
  },
  {
    id: "fifa2",
    label: "FIFA",
    url: `${IK}/Tournaments/fifa2.jpg?updatedAt=1695929789214`,
  },
  {
    id: "apex2",
    label: "Apex",
    url: `${IK}/Tournaments/apex2.jpg?updatedAt=1695930037592`,
  },
  {
    id: "codm-jpg",
    label: "CODM",
    url: `${IK}/Tournaments/codm.jpg?updatedAt=1695929782629`,
  },
  {
    id: "pes2",
    label: "PES",
    url: `${IK}/Tournaments/pes2.jpg?updatedAt=1695929782272`,
  },
  {
    id: "warzone-jpg",
    label: "Warzone",
    url: `${IK}/Tournaments/warzone.jpg?updatedAt=1695929792320`,
  },
  {
    id: "nba2",
    label: "NBA 2K",
    url: `${IK}/Tournaments/nba2.jpg?updatedAt=1695929781550`,
  },
  {
    id: "pes",
    label: "PES",
    url: `${IK}/Tournaments/pes.jpg?updatedAt=1695929781787`,
  },
  {
    id: "fortnite2",
    label: "Fortnite",
    url: `${IK}/Tournaments/fortnite2.jpg?updatedAt=1695929784524`,
  },
  {
    id: "nba",
    label: "NBA 2K",
    url: `${IK}/Tournaments/nba.jpg?updatedAt=1695929781188`,
  },
  {
    id: "fortnite",
    label: "Fortnite",
    url: `${IK}/Tournaments/fortnite.jpg?updatedAt=1695929784173`,
  },
  {
    id: "codm2",
    label: "CODM",
    url: `${IK}/Tournaments/codm2.jpg?updatedAt=1695929782613`,
  },
  {
    id: "apex",
    label: "Apex",
    url: `${IK}/Tournaments/apex.jpg?updatedAt=1695929789889`,
  },
  {
    id: "warzone-png",
    label: "Warzone",
    url: `${IK}/Tournaments/warzone.png?updatedAt=1695897395102`,
  },
  {
    id: "hacker",
    label: "Hacker",
    url: `${IK}/Tournaments/hacker.png?updatedAt=1695897392790`,
  },
  {
    id: "arcane",
    label: "Arcane",
    url: `${IK}/Tournaments/acane.png?updatedAt=1695897392507`,
  },
  {
    id: "codm-png",
    label: "CODM",
    url: `${IK}/Tournaments/codm.png?updatedAt=1695897346299`,
  },
  {
    id: "girly",
    label: "Girly",
    url: `${IK}/Tournaments/girl.png?updatedAt=1695897324556`,
  },
];

/** Crests used when registering a team (old register picker). */
export const TEAM_ICONS: AppIcon[] = [
  {
    id: "arcane",
    label: "Arcane",
    url: `${IK}/Tournaments/acane.png?updatedAt=1695897392507`,
  },
  {
    id: "hacker",
    label: "Hacker",
    url: `${IK}/Tournaments/hacker.png?updatedAt=1695897392790`,
  },
  {
    id: "codm",
    label: "CODM",
    url: `${IK}/Tournaments/codm.png?updatedAt=1695897346299`,
  },
  {
    id: "girly",
    label: "Girly",
    url: `${IK}/Tournaments/girl.png?updatedAt=1695897324556`,
  },
  {
    id: "warzone",
    label: "Warzone",
    url: `${IK}/Tournaments/warzone.png?updatedAt=1695897395102`,
  },
];

/** Org logos reuse the same crest set. Upload comes later. */
export const ORG_ICONS = TEAM_ICONS;

/** Player / user avatars from the old Icons folder plus character crests. */
export const PLAYER_ICONS: AppIcon[] = [
  {
    id: "player-girl",
    label: "Avatar",
    url: `${IK}/Icons/girl.png?updatedAt=1701589631511`,
  },
  {
    id: "player-default",
    label: "Gamer",
    url: `${IK}/Icons/icon.png?updatedAt=1706418032616`,
  },
  ...TEAM_ICONS.map((icon) => ({ ...icon, id: `player-${icon.id}` })),
];

export const UI_ICONS = {
  teamCard: `${IK}/Icons/teamCard.svg?updatedAt=1702140208686`,
  teamName: `${IK}/Icons/teamName.svg?updatedAt=1702140208879`,
  vs: `${IK}/Icons/vs.svg?updatedAt=1702070662602`,
  cancel: `${IK}/Icons/cancel.svg?updatedAt=1702198051653`,
} as const;

export const FALLBACKS = {
  tournament: `${IK}/Tournaments/hacker.png?updatedAt=1695897392790`,
  team: `${IK}/Icons/icon.png?updatedAt=1706418032616`,
  player: `${IK}/Icons/girl.png?updatedAt=1701589631511`,
} as const;

const GAME_ICON_MATCHERS: { test: RegExp; url: string }[] = [
  { test: /fifa|ea\s*fc/i, url: iconUrl("fifa2") },
  { test: /codm|call\s*of\s*duty\s*mobile/i, url: iconUrl("codm-jpg") },
  { test: /warzone|cod\b/i, url: iconUrl("warzone2") },
  { test: /apex/i, url: iconUrl("apex2") },
  { test: /fortnite/i, url: iconUrl("fortnite") },
  { test: /nba|2k/i, url: iconUrl("nba") },
  { test: /pes|efootball/i, url: iconUrl("pes") },
  { test: /shooter/i, url: iconUrl("warzone2") },
];

function iconUrl(id: string): string {
  return (
    TOURNAMENT_ICONS.find((icon) => icon.id === id)?.url ?? FALLBACKS.tournament
  );
}

/** Pick a tournament cover that matches a game name. */
export function iconForGame(gameName: string): string {
  const name = gameName.trim();
  if (!name) return FALLBACKS.tournament;
  const match = GAME_ICON_MATCHERS.find((entry) => entry.test.test(name));
  if (match) return match.url;
  const labeled = TOURNAMENT_ICONS.find(
    (icon) => icon.label.toLowerCase() === name.toLowerCase(),
  );
  return labeled?.url ?? FALLBACKS.tournament;
}

/** Stable player avatar from a user id. */
export function playerIconFor(userId: string): string {
  if (!userId || PLAYER_ICONS.length === 0) return FALLBACKS.player;
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash + userId.charCodeAt(i) * (i + 1)) % 2147483647;
  }
  return PLAYER_ICONS[hash % PLAYER_ICONS.length]?.url ?? FALLBACKS.player;
}

export function resolveIcon(
  value: string | undefined,
  fallback: string = FALLBACKS.team,
): string {
  return value && value.startsWith("http") ? value : fallback;
}

export function resolvePlayerIcon(
  icon: string | undefined,
  userId: string,
): string {
  return resolveIcon(icon, playerIconFor(userId));
}

export function iconLabel(icons: AppIcon[], url: string): string | undefined {
  return icons.find((icon) => icon.url === url)?.label;
}
