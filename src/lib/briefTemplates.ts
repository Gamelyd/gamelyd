import type { TournamentMode } from "@/lib/schemas/common";

/**
 * Starter Markdown briefings, one per tournament mode. A host can drop one into
 * the briefing editor and edit from there. `{game}` is filled with the game
 * name so the sample reads naturally.
 */
const TEMPLATES: Record<TournamentMode, string> = {
  MULTIPLAYER: `## {game} Knockout

Single elimination. Win and advance, lose and you are out.

### Format
- Best of three. First to 2 wins takes the match.
- Be online and ready at your scheduled time. 10 minutes late without notice is a forfeit.

### Rules
- Standard competitive settings unless stated otherwise.
- No hacks, mods, or third-party tools. Instant disqualification.
- Screenshot the end-of-match result and keep it until the event ends.

### Reporting
- The winner reports the score after each match.
- Any dispute goes to the host, whose decision is final.`,

  GROUPS: `## {game} Groups

Group stage into a knockout. Top teams from each group advance.

### Format
- Round robin within each group, everyone plays everyone once.
- Top 2 of each group qualify for the knockout bracket.
- Points: Win 3, Draw 1, Loss 0.

### Rules
- Standard competitive settings unless stated otherwise.
- No hacks, mods, or third-party tools. Instant disqualification.
- Screenshot every result and keep it until the event ends.

### Reporting
- Report each match result promptly so the table stays up to date.
- Any dispute goes to the host, whose decision is final.`,

  LEAGUE: `## {game} League

Everyone plays everyone. The table decides the champion.

### Format
- Full round robin. Each team plays every other team.
- Points: Win 3, Draw 1, Loss 0.
- Ties are broken by head to head, then goal difference.

### Rules
- Standard competitive settings unless stated otherwise.
- No hacks, mods, or third-party tools. Instant disqualification.
- Screenshot every result and keep it until the season ends.

### Reporting
- Report each match result promptly so the table stays accurate.
- Any dispute goes to the host, whose decision is final.`,

  BATTLEROYALE: `## {game} Battle Royale

Drop in, survive, and rack up points across the lobbies.

### Format
- Points from placement plus kills across all games.
- Placement points for the top finishers, 1 point per kill.
- Highest total after the final game wins.

### Rules
- Join the assigned lobby on time. Late drops forfeit that game.
- No teaming, no hacks, no third-party tools. Instant disqualification.
- Screenshot your placement and kills after each game.

### Reporting
- Submit your results after each lobby.
- Any dispute goes to the host, whose decision is final.`,
};

export function briefTemplate(mode: TournamentMode, game: string): string {
  const name = game.trim() || "the game";
  return TEMPLATES[mode].replaceAll("{game}", name);
}
