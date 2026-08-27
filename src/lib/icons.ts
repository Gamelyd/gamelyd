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

function localCrests(
  kind: "team" | "player",
  entries: [file: string, label: string][],
): AppIcon[] {
  return entries.map(([file, label]) => ({
    id: file.replace(/\.png$/, ""),
    label,
    url: `/images/crests/${kind}/${file}`,
  }));
}

function localCovers(
  folder: string,
  entries: [file: string, label: string][],
): AppIcon[] {
  return entries.map(([file, label]) => ({
    id: file.replace(/\.png$/, ""),
    label,
    url: `/images/tournaments/${folder}/${file}`,
  }));
}

const EAFC_COVERS = localCovers("eafc", [
  ["eafc-01-center-spot.png", "EAFC · Pitch"],
  ["eafc-02-kickoff.png", "EAFC · Kickoff"],
  ["eafc-03-duel.png", "EAFC · Duel"],
  ["eafc-04-goal.png", "EAFC · Goal"],
  ["eafc-05-stadium.png", "EAFC · Stadium"],
  ["eafc-06-penalty.png", "EAFC · Penalty"],
  ["eafc-07-aerial.png", "EAFC · Aerial"],
  ["eafc-08-corner.png", "EAFC · Corner"],
  ["eafc-09-ball.png", "EAFC · Ball"],
  ["eafc-10-tunnel.png", "EAFC · Tunnel"],
]);

const COD_COVERS = localCovers("cod", [
  ["cod-01-urban.png", "COD · Urban"],
  ["cod-02-snd.png", "COD · Search"],
  ["cod-03-gunfight.png", "COD · Gunfight"],
  ["cod-04-streak.png", "COD · Streak"],
  ["cod-05-sniper.png", "COD · Sniper"],
]);

const WARZONE_COVERS = localCovers("warzone", [
  ["warzone-01-drop.png", "Warzone · Drop"],
  ["warzone-02-circle.png", "Warzone · Circle"],
  ["warzone-03-loadout.png", "Warzone · Loadout"],
  ["warzone-04-gulag.png", "Warzone · Gulag"],
  ["warzone-05-vehicle.png", "Warzone · Vehicle"],
]);

const CODM_COVERS = localCovers("codm", [
  ["codm-01-urban.png", "CODM · Urban"],
  ["codm-02-drop.png", "CODM · Drop"],
  ["codm-03-sniper.png", "CODM · Sniper"],
  ["codm-04-alley.png", "CODM · Alley"],
]);

const NBA2K_COVERS = localCovers("nba2k", [
  ["nba2k-01-dunk.png", "NBA 2K · Dunk"],
  ["nba2k-02-tipoff.png", "NBA 2K · Tip-off"],
  ["nba2k-03-three.png", "NBA 2K · Three"],
  ["nba2k-04-arena.png", "NBA 2K · Arena"],
  ["nba2k-05-break.png", "NBA 2K · Break"],
]);

const BATTLEFIELD_COVERS = localCovers("battlefield", [
  ["bf-01-tanks.png", "Battlefield · Tanks"],
  ["bf-02-jet.png", "Battlefield · Jet"],
  ["bf-03-conquest.png", "Battlefield · Conquest"],
  ["bf-04-outpost.png", "Battlefield · Outpost"],
]);

const APEX_COVERS = localCovers("apex", [
  ["apex-01-drop.png", "Apex · Drop"],
  ["apex-02-fight.png", "Apex · Fight"],
  ["apex-03-ring.png", "Apex · Ring"],
  ["apex-04-champ.png", "Apex · Champion"],
]);

const FORTNITE_COVERS = localCovers("fortnite", [
  ["fortnite-01-storm.png", "Fortnite · Storm"],
  ["fortnite-02-builds.png", "Fortnite · Builds"],
  ["fortnite-03-island.png", "Fortnite · Island"],
]);

const EFOOTBALL_COVERS = localCovers("efootball", [
  ["efootball-01-pitch.png", "eFootball · Pitch"],
  ["efootball-02-shot.png", "eFootball · Shot"],
  ["efootball-03-stadium.png", "eFootball · Stadium"],
]);

export const TOURNAMENT_ICONS: AppIcon[] = [
  ...EAFC_COVERS,
  ...COD_COVERS,
  ...WARZONE_COVERS,
  ...CODM_COVERS,
  ...NBA2K_COVERS,
  ...BATTLEFIELD_COVERS,
  ...APEX_COVERS,
  ...FORTNITE_COVERS,
  ...EFOOTBALL_COVERS,
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

/** Crests used when registering a team. */
export const TEAM_ICONS: AppIcon[] = localCrests("team", [
  ["crest-team-01-wolf.png", "Wolf"],
  ["crest-team-02-chevron.png", "Chevron"],
  ["crest-team-03-bolt.png", "Bolt"],
  ["crest-team-04-crown.png", "Crown"],
  ["crest-team-05-hawk.png", "Hawk"],
  ["crest-team-06-star.png", "Star"],
  ["crest-team-07-diamond.png", "Diamond"],
  ["crest-team-08-flame.png", "Flame"],
  ["crest-team-09-blades.png", "Blades"],
  ["crest-team-10-trident.png", "Trident"],
  ["crest-team-11-lion.png", "Lion"],
  ["crest-team-12-ram.png", "Ram"],
  ["crest-team-13-bear.png", "Bear"],
  ["crest-team-14-fox.png", "Fox"],
  ["crest-team-15-stag.png", "Stag"],
  ["crest-team-16-serpent.png", "Serpent"],
  ["crest-team-17-scorpion.png", "Scorpion"],
  ["crest-team-18-mountain.png", "Mountain"],
  ["crest-team-19-tower.png", "Tower"],
  ["crest-team-20-hammer.png", "Hammer"],
  ["crest-team-21-axe.png", "Axe"],
  ["crest-team-22-spear.png", "Spear"],
  ["crest-team-23-sun.png", "Sun"],
  ["crest-team-24-wave.png", "Wave"],
  ["crest-team-25-arrow.png", "Arrow"],
  ["crest-team-26-tree.png", "Tree"],
  ["crest-team-27-gear.png", "Gear"],
  ["crest-team-28-compass.png", "Compass"],
  ["crest-team-29-horseshoe.png", "Horseshoe"],
  ["crest-team-30-anvil.png", "Anvil"],
  ["crest-team-31-dragon.png", "Dragon"],
  ["crest-team-32-phoenix.png", "Phoenix"],
  ["crest-team-33-panther.png", "Panther"],
  ["crest-team-34-shark.png", "Shark"],
  ["crest-team-35-bull.png", "Bull"],
  ["crest-team-36-owl.png", "Owl"],
  ["crest-team-37-griffin.png", "Griffin"],
  ["crest-team-38-kraken.png", "Kraken"],
  ["crest-team-39-raven.png", "Raven"],
  ["crest-team-40-boar.png", "Boar"],
  ["crest-team-41-helmet.png", "Helmet"],
  ["crest-team-42-fist.png", "Fist"],
  ["crest-team-43-moon.png", "Moon"],
  ["crest-team-44-castle.png", "Castle"],
  ["crest-team-45-wing.png", "Wing"],
  ["crest-team-46-claw.png", "Claw"],
  ["crest-team-47-chain.png", "Chain"],
  ["crest-team-48-cannon.png", "Cannon"],
  ["crest-team-49-ivy.png", "Ivy"],
  ["crest-team-50-hydra.png", "Hydra"],
]);

/** Org logos reuse the same crest set. Upload comes later. */
export const ORG_ICONS = TEAM_ICONS;

/** Generic player tokens — symbols, not portraits. */
export const PLAYER_ICONS: AppIcon[] = localCrests("player", [
  ["crest-player-01-headset.png", "Headset"],
  ["crest-player-02-pad.png", "Pad"],
  ["crest-player-03-pawn.png", "Pawn"],
  ["crest-player-04-target.png", "Target"],
  ["crest-player-05-spark.png", "Spark"],
  ["crest-player-06-cube.png", "Cube"],
  ["crest-player-07-crescent.png", "Crescent"],
  ["crest-player-08-bolt.png", "Bolt"],
  ["crest-player-09-orbit.png", "Orbit"],
  ["crest-player-10-hex.png", "Hex"],
  ["crest-player-11-trophy.png", "Trophy"],
  ["crest-player-12-dice.png", "Dice"],
  ["crest-player-13-joystick.png", "Joystick"],
  ["crest-player-14-chip.png", "Chip"],
  ["crest-player-15-key.png", "Key"],
  ["crest-player-16-rocket.png", "Rocket"],
  ["crest-player-17-hourglass.png", "Hourglass"],
  ["crest-player-18-coin.png", "Coin"],
  ["crest-player-19-flag.png", "Flag"],
  ["crest-player-20-pentagon.png", "Pentagon"],
  ["crest-player-21-triangle.png", "Triangle"],
  ["crest-player-22-infinity.png", "Infinity"],
  ["crest-player-23-spiral.png", "Spiral"],
  ["crest-player-24-plus.png", "Plus"],
  ["crest-player-25-grid.png", "Grid"],
  ["crest-player-26-clover.png", "Clover"],
  ["crest-player-27-medal.png", "Medal"],
  ["crest-player-28-lock.png", "Lock"],
  ["crest-player-29-wifi.png", "Signal"],
  ["crest-player-30-rune.png", "Rune"],
  ["crest-player-31-keyboard.png", "Keyboard"],
  ["crest-player-32-mouse.png", "Mouse"],
  ["crest-player-33-mic.png", "Mic"],
  ["crest-player-34-gem.png", "Gem"],
  ["crest-player-35-flask.png", "Flask"],
  ["crest-player-36-planet.png", "Planet"],
  ["crest-player-37-meteor.png", "Meteor"],
  ["crest-player-38-portal.png", "Portal"],
  ["crest-player-39-puzzle.png", "Puzzle"],
  ["crest-player-40-magnet.png", "Magnet"],
  ["crest-player-41-atom.png", "Atom"],
  ["crest-player-42-snowflake.png", "Snowflake"],
  ["crest-player-43-leaf.png", "Leaf"],
  ["crest-player-44-lantern.png", "Lantern"],
  ["crest-player-45-scroll.png", "Scroll"],
  ["crest-player-46-map.png", "Map"],
  ["crest-player-47-whistle.png", "Whistle"],
  ["crest-player-48-goggles.png", "Goggles"],
  ["crest-player-49-backpack.png", "Backpack"],
  ["crest-player-50-boot.png", "Boot"],
  ["crest-player-51-tent.png", "Tent"],
  ["crest-player-52-drum.png", "Drum"],
  ["crest-player-53-disc.png", "Disc"],
  ["crest-player-54-bell.png", "Bell"],
  ["crest-player-55-eye.png", "Eye"],
  ["crest-player-56-prism.png", "Prism"],
  ["crest-player-57-satellite.png", "Satellite"],
  ["crest-player-58-battery.png", "Battery"],
  ["crest-player-59-ladder.png", "Ladder"],
  ["crest-player-60-bookmark.png", "Bookmark"],
]);

export const UI_ICONS = {
  teamCard: `${IK}/Icons/teamCard.svg?updatedAt=1702140208686`,
  teamName: `${IK}/Icons/teamName.svg?updatedAt=1702140208879`,
  vs: `${IK}/Icons/vs.svg?updatedAt=1702070662602`,
  cancel: `${IK}/Icons/cancel.svg?updatedAt=1702198051653`,
} as const;

export const FALLBACKS = {
  tournament: "/api/icons/eafc-01-center-spot",
  team: "/api/icons/crest-team-01-wolf",
  player: "/api/icons/crest-player-01-headset",
} as const;

const GAME_ICON_MATCHERS: { test: RegExp; url: string }[] = [
  { test: /fifa|ea\s*fc|eafc/i, url: iconUrl("eafc-01-center-spot") },
  {
    test: /codm|call\s*of\s*duty\s*mobile/i,
    url: iconUrl("codm-01-urban"),
  },
  { test: /warzone/i, url: iconUrl("warzone-01-drop") },
  { test: /battlefield|\bbf\b/i, url: iconUrl("bf-01-tanks") },
  {
    test: /call\s*of\s*duty|\bcod\b/i,
    url: iconUrl("cod-01-urban"),
  },
  { test: /nba|2k/i, url: iconUrl("nba2k-01-dunk") },
  { test: /apex/i, url: iconUrl("apex-01-drop") },
  { test: /fortnite/i, url: iconUrl("fortnite-01-storm") },
  { test: /pes|efootball/i, url: iconUrl("efootball-01-pitch") },
  { test: /shooter/i, url: iconUrl("cod-01-urban") },
];

/** Game-name tests used when seeding tournament covers into the catalog. */
export function seedGameTests(icon: AppIcon): RegExp[] {
  const byPath: [string, RegExp][] = [
    ["/tournaments/codm/", /codm|call\s*of\s*duty\s*mobile/i],
    ["/tournaments/warzone/", /warzone/i],
    ["/tournaments/eafc/", /fifa|ea\s*fc|eafc/i],
    ["/tournaments/cod/", /^(?!.*(?:warzone|mobile|codm)).*(?:call\s*of\s*duty|\bcod\b)/i],
    ["/tournaments/battlefield/", /battlefield|\bbf\b/i],
    ["/tournaments/nba2k/", /nba|2k/i],
    ["/tournaments/apex/", /apex/i],
    ["/tournaments/fortnite/", /fortnite/i],
    ["/tournaments/efootball/", /pes|efootball/i],
  ];
  for (const [needle, test] of byPath) {
    if (icon.url.includes(needle)) return [test];
  }
  return GAME_ICON_MATCHERS.filter((entry) => entry.test.test(icon.label)).map(
    (entry) => entry.test,
  );
}

function iconUrl(id: string): string {
  return (
    TOURNAMENT_ICONS.find((icon) => icon.id === id)?.url ?? FALLBACKS.tournament
  );
}

export function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash + value.charCodeAt(i) * (i + 1)) % 2147483647;
  }
  return hash;
}

export function pickStableIcon(
  icons: { url: string }[],
  seed: string,
  fallback: string,
): string {
  if (!seed || icons.length === 0) return fallback;
  return icons[hashSeed(seed) % icons.length]?.url ?? fallback;
}

/** Pick a tournament cover that matches a game name. */
export function iconForGame(
  gameName: string,
  icons: AppIcon[] = TOURNAMENT_ICONS,
): string {
  const name = gameName.trim();
  if (!name) return FALLBACKS.tournament;
  const match = GAME_ICON_MATCHERS.find((entry) => entry.test.test(name));
  if (match) {
    const wanted = catalogFileSlug(match.url);
    const fromList =
      icons.find((icon) => icon.url === match.url) ||
      icons.find(
        (icon) =>
          icon.id === wanted || catalogFileSlug(icon.url) === wanted,
      );
    if (fromList) return fromList.url;
    return rewriteCatalogPath(match.url);
  }
  const labeled = icons.find(
    (icon) => icon.label.toLowerCase() === name.toLowerCase(),
  );
  return labeled?.url ?? icons[0]?.url ?? FALLBACKS.tournament;
}

/** Stable player avatar from a user id. */
export function playerIconFor(
  userId: string,
  icons: AppIcon[] = PLAYER_ICONS,
): string {
  return pickStableIcon(icons, userId, FALLBACKS.player);
}

function catalogFileSlug(url: string): string {
  return url.split("/").pop()?.split("?")[0]?.replace(/\.png$/i, "") ?? "";
}

/** Turn stored local catalog paths into the database-backed API URL. */
export function rewriteCatalogPath(url: string, slug?: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/api/icons/")) return url;
  const fromPath =
    url.startsWith("/images/tournaments/") ||
    url.startsWith("/images/crests/");
  if (!fromPath) return url;
  const nextSlug = slug || catalogFileSlug(url);
  return nextSlug ? `/api/icons/${nextSlug}` : url;
}

function isUsableIconSrc(value: string): boolean {
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/")
  );
}

export function resolveIcon(
  value: string | undefined,
  fallback: string = FALLBACKS.team,
): string {
  const src = value && isUsableIconSrc(value) ? value : fallback;
  return rewriteCatalogPath(src);
}

export function resolvePlayerIcon(
  icon: string | undefined,
  userId: string,
  icons: AppIcon[] = PLAYER_ICONS,
): string {
  return resolveIcon(icon, playerIconFor(userId, icons));
}

export function iconLabel(icons: AppIcon[], url: string): string | undefined {
  return icons.find((icon) => icon.url === url)?.label;
}

export function catalogToAppIcon(icon: {
  icon_id: string;
  name: string;
  url: string;
}): AppIcon {
  return { id: icon.icon_id, label: icon.name, url: icon.url };
}
