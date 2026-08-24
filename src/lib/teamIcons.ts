import type { Draw, Teams } from "@/lib/schemas/draw";

/** Team-name → icon URL from registrations (legacy draws often omit icon). */
export function iconMapFromTeams(
  teams: { TeamName: string; Icon: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const team of teams) {
    const name = team.TeamName.trim().toLowerCase();
    if (name && team.Icon.startsWith("http")) map.set(name, team.Icon);
  }
  return map;
}

function fillTeam(
  team: Teams | undefined,
  icons: Map<string, string>,
): Teams | undefined {
  if (!team) return team;
  if (team.Icon.startsWith("http")) return team;
  const icon = icons.get(team.TeamName.trim().toLowerCase());
  return icon ? { ...team, Icon: icon } : team;
}

/** Copy registration crests onto draw teams when the draw row has none. */
export function hydrateDrawIcons(
  draw: Draw,
  icons: Map<string, string>,
): Draw {
  if (icons.size === 0) return draw;
  return {
    ...draw,
    Team1: fillTeam(draw.Team1, icons),
    Team2: fillTeam(draw.Team2, icons),
  };
}
