import { z } from "zod";
import { isBrDraw, isGroupDraw, isKnockoutDraw } from "@/lib/drawKind";
import { computeLeagueStandings } from "@/lib/leagueStandings";
import { computeBrStandings } from "@/lib/brStandings";
import { resolvePodium } from "@/lib/podium";
import { roundLabel } from "@/lib/roundLabel";
import {
  buildBracketModel,
  type BracketNode,
  type BracketSlot,
  type WingLayout,
} from "@/lib/bracketModel";
import { knockoutRoundsForBracket } from "@/lib/knockoutSeries";
import { iconMapFromTeams } from "@/lib/teamIcons";
import { FALLBACKS, resolveIcon, resolvePlayerIcon } from "@/lib/icons";
import type { Draw, Teams } from "@/lib/schemas/draw";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { Tournament } from "@/lib/schemas/tournament";

/**
 * Plain data for the downloadable images.
 *
 * The picture is rendered on the server rather than captured from the page, so
 * a host on a phone gets the same wide layout as one on a desktop -- a bracket
 * squeezed into a 390px column is not worth sharing. That means the layout
 * cannot read the DOM, so everything it needs is derived here instead, as pure
 * functions over the same data the page already has.
 */

export const exportViewSchema = z.enum([
  "bracket",
  "groups",
  "standings",
  "teams",
  "champions",
  "unplayed",
]);
export type ExportView = z.infer<typeof exportViewSchema>;

export const EXPORT_VIEW_LABEL: Record<ExportView, string> = {
  bracket: "Bracket",
  groups: "Groups",
  standings: "Standings",
  teams: "Teams",
  champions: "Champions",
  unplayed: "Unplayed matches",
};

export interface ExportSide {
  name: string;
  score: number;
  won: boolean;
  /** Whether a result exists for this side. Unplayed slots show no score. */
  played?: boolean;
  /** A "Group A winner"-style slot waiting for a team. */
  placeholder?: boolean;
  /** Nobody in this slot yet: drawn as a blank crest and a dim "TBD". */
  empty?: boolean;
  /** Crest URL, or "" when the team has none and initials stand in. */
  icon: string;
}

export interface ExportMatch {
  home: ExportSide;
  away: ExportSide;
  played: boolean;
  /** When it is due, for fixture lists. Empty when the host has not set a time. */
  when: string;
  /** Bracket only: one team goes straight through ("Auto qualified"). */
  bye?: boolean;
  /** Bracket only: a lone final drawn as one team per side of the trophy. */
  solo?: boolean;
}

export interface ExportColumn {
  label: string;
  matches: ExportMatch[];
  /**
   * Bracket only: each card's centre and the wing's height, in match slots,
   * from the shared layout -- so connectors meet the cards on uneven sides.
   * Absent means evenly spaced.
   */
  centres?: number[];
  units?: number;
}

/**
 * The centre of the bracket: the trophy, who lifted it, and the final itself.
 * The page keeps the final out of the wings and puts a trophy between them, so
 * the export does the same.
 */
export interface ExportFinal {
  home: ExportSide;
  away: ExportSide;
  played: boolean;
  champion: ExportSide | null;
}

export interface ExportTableRow {
  position: number;
  name: string;
  cells: string[];
  icon: string;
}

export interface ExportTable {
  name: string;
  headers: string[];
  rows: ExportTableRow[];
}

/** A player as the page shows them: their crest beside their name. */
export interface ExportPlayer {
  name: string;
  icon: string;
}

export interface ExportTeam {
  name: string;
  players: ExportPlayer[];
  icon: string;
}

export interface ExportPlace {
  place: number;
  label: string;
  name: string;
  players: ExportPlayer[];
  icon: string;
}

export type ExportModel =
  | {
      kind: "bracket";
      /** Outermost round first; the right wing renders mirrored. */
      left: ExportColumn[];
      right: ExportColumn[];
      final: ExportFinal | null;
    }
  | { kind: "tables"; tables: ExportTable[] }
  | { kind: "teams"; teams: ExportTeam[] }
  | { kind: "fixtures"; sections: ExportColumn[] }
  | { kind: "champions"; places: ExportPlace[] };

const PLACE_LABEL: Record<number, string> = {
  1: "Champion",
  2: "Runner-up",
  3: "Third",
};

/**
 * Team crests are stored on the registration, not always on the draw, so the
 * page hydrates fixtures from the participant list before rendering. The export
 * has to do the same or half the crests come back empty.
 */
export type IconLookup = (name: string, own?: string) => string;

export function iconLookupFor(participants: RegisterTournament[]): IconLookup {
  const map = iconMapFromTeams(
    participants.map((entry) => ({
      TeamName: entry.TeamName ?? "",
      Icon: entry.Icon ?? "",
    })),
  );
  return (name, own) => {
    if (!name.trim()) return "";
    const direct = (own ?? "").trim();
    const found =
      direct.startsWith("http") || direct.startsWith("/")
        ? direct
        : (map.get(name.trim().toLowerCase()) ?? "");
    // The page always shows a crest, falling back to the default team badge, so
    // the export has to as well -- a grid of monograms looked nothing like it.
    return resolveIcon(found, FALLBACKS.team);
  };
}

function sideOf(
  team: Teams | undefined,
  score: number,
  won: boolean,
  icons: IconLookup,
): ExportSide {
  const name = team?.TeamName?.trim() ?? "";
  // An empty slot stays a placeholder rather than borrowing a crest.
  return {
    name: name || "TBD",
    score,
    won,
    icon: name ? icons(name, team?.Icon) : "",
  };
}

/**
 * `Draw.Winner` holds the side that went through -- the literal string "Team1"
 * or "Team2" -- not the team's name. Comparing it against a name silently never
 * matches, which showed up as a bracket where nobody had won anything.
 */
function matchOf(draw: Draw, icons: IconLookup): ExportMatch {
  const winner = draw.Winner?.trim() ?? "";
  return {
    home: sideOf(draw.Team1, draw.Team1Score, winner === "Team1", icons),
    away: sideOf(draw.Team2, draw.Team2Score, winner === "Team2", icons),
    played: draw.Played,
    when: kickOff(draw),
  };
}

/** "Sat 20 Sep, 15:00" from whatever parts the host filled in. */
export function kickOff(draw: { Date?: string; Time?: string }): string {
  const date = (draw.Date ?? "").trim();
  const time = (draw.Time ?? "").trim();
  if (!date) return time;
  const parsed = new Date(date);
  const day = Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
  return time ? `${day}, ${time}` : day;
}

function bracketSide(slot: BracketSlot, icons: IconLookup): ExportSide {
  const name = slot.team?.TeamName?.trim() ?? "";
  return {
    name: name || slot.label || "TBD",
    score: slot.score,
    won: slot.won,
    played: slot.played,
    placeholder: !name && Boolean(slot.label),
    empty: !name,
    icon: name ? icons(name, slot.team?.Icon) : "",
  };
}

function bracketMatch(node: BracketNode, icons: IconLookup): ExportMatch {
  return {
    home: bracketSide(node.team1, icons),
    away: bracketSide(node.team2, icons),
    played: Boolean(node.draw?.Played),
    when: "",
    bye: Boolean(node.bye),
  };
}

/** Group names as the page reads them: the saved groups, else the draws. */
function bracketGroupNames(tournament: Tournament, draws: Draw[]): string[] {
  const fromDoc = (tournament.Groups ?? [])
    .map((g) => g.GroupName?.trim() ?? "")
    .filter(Boolean);
  if (fromDoc.length > 0) return fromDoc;
  const seen = new Set<string>();
  for (const draw of draws) {
    const name = draw.Group?.trim();
    if (name) seen.add(name);
  }
  return [...seen];
}

/**
 * The bracket exactly as the page draws it -- built by the same
 * `buildBracketModel` the page uses, so the download cannot drift from what
 * the host is looking at. Every round is there from the start, unplayed ones
 * as TBD or "Group A winner" placeholders, with byes and two-leg aggregates
 * handled the same way.
 *
 * League and battle royale are excluded outright. Their fixtures pass the
 * knockout predicate, but a "bracket" of a round robin means nothing -- those
 * modes export `standings` instead.
 */
export function buildBracket(
  tournament: Tournament,
  draws: Draw[],
  icons: IconLookup = () => "",
  teamCount = 0,
): { left: ExportColumn[]; right: ExportColumn[]; final: ExportFinal | null } {
  const empty = { left: [], right: [], final: null };
  if (
    tournament.TournamentMode === "LEAGUE" ||
    tournament.TournamentMode === "BATTLEROYALE"
  ) {
    return empty;
  }

  const isGroups = tournament.TournamentMode === "GROUPS";
  const model = buildBracketModel({
    rounds: knockoutRoundsForBracket(draws, tournament.KnockoutFormat),
    groupNames: bracketGroupNames(tournament, draws),
    advancePerGroup: tournament.AdvancePerGroup || 2,
    teamCount: isGroups ? 0 : teamCount,
    isGroupMode: isGroups,
    knockoutLive: draws.some(isKnockoutDraw),
  });
  if (model.leaves.length === 0) return empty;

  const champion = model.champion?.TeamName?.trim()
    ? {
        name: model.champion.TeamName.trim(),
        score: 0,
        won: true,
        icon: icons(model.champion.TeamName, model.champion.Icon),
      }
    : null;
  const final: ExportFinal = model.finalDraw
    ? { ...matchOf(model.finalDraw, icons), champion }
    : {
        home: bracketSide({ score: 0, played: false, won: false }, icons),
        away: bracketSide({ score: 0, played: false, won: false }, icons),
        played: false,
        champion,
      };

  // A lone match: the page puts one team either side of the trophy.
  if (model.leaves.length === 1) {
    const only = bracketMatch(model.leaves[0], icons);
    return {
      left: [
        { label: "", matches: [{ ...only, solo: true }], centres: [0.5], units: 1 },
      ],
      right: [
        {
          label: "",
          matches: [{ ...only, home: only.away, away: only.home, solo: true }],
          centres: [0.5],
          units: 1,
        },
      ],
      final,
    };
  }

  const wing = (
    cols: BracketNode[][],
    labels: string[],
    layout: WingLayout,
  ): ExportColumn[] =>
    cols.map((col, i) => ({
      label: (labels[i] ?? "").toUpperCase(),
      matches: col.map((node) => bracketMatch(node, icons)),
      centres: layout.centres[i],
      units: layout.units,
    }));
  return {
    left: wing(model.leftCols, model.leftLabels, model.leftLayout),
    right: wing(model.rightCols, model.rightLabels, model.rightLayout),
    final,
  };
}

const GROUP_HEADERS = ["P", "W", "D", "L", "GD", "Pts"];

function standingCells(row: {
  Played: number;
  Won: number;
  Drawn: number;
  Lost: number;
  GoalDifference: number;
  Points: number;
}): string[] {
  return [
    String(row.Played),
    String(row.Won),
    String(row.Drawn),
    String(row.Lost),
    row.GoalDifference > 0 ? `+${row.GoalDifference}` : String(row.GoalDifference),
    String(row.Points),
  ];
}

/** One table per group, each computed from that group's own fixtures. */
export function buildGroups(
  tournament: Tournament,
  draws: Draw[],
  icons: IconLookup = () => "",
): ExportTable[] {
  const byGroup = new Map<string, Draw[]>();
  for (const draw of draws) {
    if (!isGroupDraw(draw)) continue;
    const name = draw.Group.trim();
    byGroup.set(name, [...(byGroup.get(name) ?? []), draw]);
  }

  return [...byGroup.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([name, list]) => {
      // A group's teams are whoever appears in its fixtures: the draw is the
      // only place that membership is actually recorded.
      const teams = new Map<string, Teams>();
      for (const draw of list) {
        for (const team of [draw.Team1, draw.Team2]) {
          const key = team?.TeamName?.trim();
          if (key && !teams.has(key)) teams.set(key, team as Teams);
        }
      }
      const standings = computeLeagueStandings(
        [...teams.values()],
        list,
        tournament.PointSystem,
        tournament.TieBreaker,
      );
      return {
        name: name || "Group",
        headers: GROUP_HEADERS,
        rows: standings.map((row, index) => ({
          position: index + 1,
          name: row.TeamName,
          cells: standingCells(row),
          icon: icons(row.TeamName, row.Icon),
        })),
      };
    });
}

/** The league table, or the battle-royale points table. */
export function buildStandings(
  tournament: Tournament,
  draws: Draw[],
  participants: RegisterTournament[],
  icons: IconLookup = () => "",
): ExportTable[] {
  if (tournament.TournamentMode === "BATTLEROYALE") {
    const rows = computeBrStandings(draws, {
      KillPoints: tournament.BrKillPoints,
      FirstBloodPoints: tournament.BrFirstBloodPoints,
      PlacementPoints: tournament.BrPlacementPoints,
    });
    if (rows.length === 0) return [];
    return [
      {
        name: "Standings",
        headers: ["Kills", "FB", "Best", "Pts"],
        rows: rows.map((row, index) => ({
          position: index + 1,
          name: row.TeamName,
          cells: [
            String(row.Kills),
            String(row.FirstBloods),
            row.BestPlace > 0 ? `#${row.BestPlace}` : "-",
            String(row.Points),
          ],
          icon: icons(row.TeamName),
        })),
      },
    ];
  }

  if (tournament.TournamentMode !== "LEAGUE") return [];
  const teams: Teams[] = participants.map((entry) => ({
    TeamName: entry.TeamName,
    Players: entry.Players,
    Icon: entry.Icon,
    Points: 0,
    GoalsScored: 0,
    GoalsReceived: 0,
    GoalsDifference: 0,
  }));
  const standings = computeLeagueStandings(
    teams,
    draws,
    tournament.PointSystem,
    tournament.TieBreaker,
  );
  if (standings.length === 0) return [];
  return [
    {
      name: "Table",
      headers: GROUP_HEADERS,
      rows: standings.map((row, index) => ({
        position: index + 1,
        name: row.TeamName,
        cells: standingCells(row),
        icon: icons(row.TeamName, row.Icon),
      })),
    },
  ];
}

/**
 * A roster with each player's crest, resolved the same way the page does it --
 * their own icon, or the stable one their user id maps to.
 */
function rosterOf(
  players: { UserName?: string; GameUserName?: string; Icon?: string; User_id?: string }[],
): ExportPlayer[] {
  return (players ?? [])
    .map((player) => ({
      name: player.GameUserName?.trim() || player.UserName?.trim() || "",
      icon: resolvePlayerIcon(player.Icon, player.User_id ?? ""),
    }))
    .filter((player) => player.name);
}

/**
 * Everything still to be played, grouped the way the fixtures tab groups it.
 *
 * A host running an event on the day wants one list of what is left, not a
 * scroll through rounds that are already finished.
 */
export function buildUnplayed(
  tournament: Tournament,
  draws: Draw[],
  icons: IconLookup = () => "",
): ExportColumn[] {
  return sectionise(
    tournament,
    draws.filter((draw) => !draw.Played),
    icons,
    "widest",
  );
}

/**
 * One team's matches, played and still to come, under the same round headings
 * the fixtures tab uses. Newest first, so what is happening now is at the top.
 *
 * `drawIds` is the set the page already computes for "see my fixtures", so both
 * agree on what counts as yours -- team name or a player's user id.
 */
export function buildMyMatches(
  tournament: Tournament,
  draws: Draw[],
  drawIds: Set<string>,
  icons: IconLookup = () => "",
): ExportColumn[] {
  return sectionise(
    tournament,
    draws.filter((draw) => drawIds.has(draw.DrawId)),
    icons,
    "newest",
  );
}

/**
 * Groups fixtures into the sections the fixtures tab shows: one per group, then
 * one per knockout round.
 *
 * `order` decides how the rounds run. A list of what is left reads widest-round
 * first, the way a bracket does. A personal list reads newest first, because
 * the match you care about is the one coming up.
 */
function sectionise(
  tournament: Tournament,
  draws: Draw[],
  icons: IconLookup,
  order: "widest" | "newest",
): ExportColumn[] {
  if (draws.length === 0) return [];

  const groups = new Map<string, Draw[]>();
  const rounds = new Map<number, Draw[]>();
  for (const draw of draws) {
    if (isGroupDraw(draw)) {
      const name = draw.Group.trim() || "Group";
      groups.set(name, [...(groups.get(name) ?? []), draw]);
    } else {
      rounds.set(draw.Stage, [...(rounds.get(draw.Stage) ?? []), draw]);
    }
  }

  const sections: ExportColumn[] = [];
  for (const [name, list] of [...groups.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { numeric: true }),
  )) {
    sections.push({ label: name, matches: list.map((d) => matchOf(d, icons)) });
  }
  const roundList = [...rounds.entries()].sort(
    ([stageA, a], [stageB, b]) =>
      order === "widest" ? b.length - a.length || stageA - stageB : stageB - stageA,
  );
  for (const [stage, list] of roundList) {
    sections.push({
      label: roundLabel(list.length, stage, tournament.TournamentMode),
      matches: list.map((d) => matchOf(d, icons)),
    });
  }
  return sections;
}

export function buildTeams(
  participants: RegisterTournament[],
  icons: IconLookup = () => "",
): ExportTeam[] {
  return participants
    .filter((entry) => entry.TeamName?.trim())
    .map((entry) => ({
      name: entry.TeamName.trim(),
      icon: icons(entry.TeamName.trim(), entry.Icon),
      players: rosterOf(entry.Players),
    }));
}

export function buildChampions(
  tournament: Tournament,
  draws: Draw[],
  participants: RegisterTournament[],
  icons: IconLookup = () => "",
): ExportPlace[] {
  const podium = resolvePodium(tournament, draws, participants);
  if (!podium) return [];
  const entries: [number, Teams | undefined][] = [
    [1, podium.first],
    [2, podium.second],
    [3, podium.third],
  ];
  return entries
    .filter((entry): entry is [number, Teams] => Boolean(entry[1]?.TeamName))
    .map(([place, team]) => ({
      place,
      label: PLACE_LABEL[place] ?? `#${place}`,
      name: team.TeamName,
      icon: icons(team.TeamName, team.Icon),
      players: rosterOf(team.Players),
    }));
}

export function buildExportModel(
  view: ExportView,
  tournament: Tournament,
  draws: Draw[],
  participants: RegisterTournament[],
): ExportModel | null {
  const icons = iconLookupFor(participants);
  switch (view) {
    case "bracket": {
      const { left, right, final } = buildBracket(
        tournament,
        draws,
        icons,
        participants.length,
      );
      return left.length > 0 || right.length > 0
        ? { kind: "bracket", left, right, final }
        : null;
    }
    case "groups": {
      const tables = buildGroups(tournament, draws, icons);
      return tables.length > 0 ? { kind: "tables", tables } : null;
    }
    case "standings": {
      const tables = buildStandings(tournament, draws, participants, icons);
      return tables.length > 0 ? { kind: "tables", tables } : null;
    }
    case "teams": {
      const teams = buildTeams(participants, icons);
      return teams.length > 0 ? { kind: "teams", teams } : null;
    }
    case "unplayed": {
      const sections = buildUnplayed(tournament, draws, icons);
      return sections.length > 0 ? { kind: "fixtures", sections } : null;
    }
    case "champions": {
      const places = buildChampions(tournament, draws, participants, icons);
      return places.length > 0 ? { kind: "champions", places } : null;
    }
  }
}

/**
 * Which downloads have something in them right now, so the page never offers a
 * button that would produce an empty picture.
 */
export function availableExportViews(
  tournament: Tournament,
  draws: Draw[],
  participants: RegisterTournament[],
): ExportView[] {
  return exportViewSchema.options.filter(
    (view) => buildExportModel(view, tournament, draws, participants) !== null,
  );
}

/** True when a draw belongs to the battle-royale ladder rather than a bracket. */
export function hasBattleRoyale(draws: Draw[]): boolean {
  return draws.some(isBrDraw);
}

/* -------------------------------- Layout -------------------------------- */

/**
 * How big the picture has to be, and what fits on it.
 *
 * The card used to render a fixed 1600x900 and silently cut whatever ran past
 * it -- a 20-team league showed ten teams and said nothing. The canvas now
 * grows instead: taller for more rows, wider for more knockout rounds. Only at
 * genuinely unreasonable sizes does anything get dropped, and then the card
 * says how much.
 *
 * These numbers mirror the padding and row heights in `exportCard`. They live
 * here so the size and the layout cannot drift apart, and so the arithmetic can
 * be tested without rendering a PNG.
 */
export const EXPORT_WIDTH = 1600;
export const EXPORT_MIN_HEIGHT = 900;

/** Past this a PNG stops being something anyone can usefully open or share. */
const MAX_WIDTH = 3200;
const MAX_HEIGHT = 3600;

/** Page padding, plus the header and footer bands. */
const PAGE_PAD = 96;
const CHROME_H = 306;

const ROW_H = 49;
const TABLE_CHROME_H = 80;
const BLOCK_GAP = 18;
/** A table taller than this is split into side-by-side blocks. */
export const ROWS_PER_BLOCK = 10;

const TEAM_CARD_H = 162;
const TEAM_GAP = 16;
export const TEAMS_PER_ROW = 4;

const MATCH_CARD_H = 108;
const BRACKET_LABEL_H = 34;
export const BRACKET_COL_MIN = 300;
export const BRACKET_COL_GAP = 18;
/** The fork joining a pair of matches to the one they feed. */
export const BRACKET_FORK_W = 44;
/** The trophy column between the two wings. */
export const BRACKET_TROPHY_W = 190;
/**
 * How far the bracket may shrink to fit everything on one picture. Below this
 * the names stop being readable, so it pages instead of shrinking further.
 */
const BRACKET_MIN_SCALE = 0.45;

/** The champions card is a portrait poster, sized to its own content. */
export const CHAMPION_WIDTH = 1080;
export const CHAMPION_MIN_HEIGHT = 1080;
const CHAMPION_BASE_H = 950;
const CHAMPION_ROSTER_ROW_H = 52;
export const CHAMPION_ROSTER_PER_ROW = 4;

export interface ExportPage {
  width: number;
  height: number;
  /** Just this page's slice of the content. */
  model: ExportModel;
  /** 1 is full size. Brackets shrink to fit rather than dropping rounds. */
  scale: number;
}

export interface ExportLayout extends ExportPage {
  /** 1-based. */
  page: number;
  pages: number;
}

function canvasHeight(bodyHeight: number): number {
  return Math.min(MAX_HEIGHT, Math.max(EXPORT_MIN_HEIGHT, CHROME_H + bodyHeight));
}

/** How many stacked bands of `bandHeight` fit before the canvas maxes out. */
function bandsThatFit(bandHeight: number, gap: number): number {
  return Math.max(1, Math.floor((MAX_HEIGHT - CHROME_H + gap) / (bandHeight + gap)));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += Math.max(1, size)) {
    out.push(items.slice(i, i + Math.max(1, size)));
  }
  return out.length > 0 ? out : [[]];
}

/**
 * A long table becomes several blocks of at most `ROWS_PER_BLOCK`, laid out two
 * across. Twenty teams read as two columns of ten rather than a truncated ten.
 */
export function splitTable(table: ExportTable): ExportTable[] {
  if (table.rows.length <= ROWS_PER_BLOCK) return [table];
  const blocks: ExportTable[] = [];
  for (let i = 0; i < table.rows.length; i += ROWS_PER_BLOCK) {
    blocks.push({
      name: i === 0 ? table.name : `${table.name} (cont.)`,
      headers: table.headers,
      rows: table.rows.slice(i, i + ROWS_PER_BLOCK),
    });
  }
  return blocks;
}

/**
 * Every page needed to show the whole thing.
 *
 * The canvas grows first -- taller for more rows, wider for more rounds -- and
 * only once it hits a size nobody could usefully open does the content roll
 * onto a second image. Nothing is ever dropped: a 200-team league comes back as
 * several pictures rather than one truncated one.
 */
export function paginateExport(model: ExportModel): ExportPage[] {
  if (model.kind === "tables") {
    const blocks = model.tables.flatMap(splitTable);
    const perRow = blocks.length === 1 ? 1 : 2;
    const tallest = Math.max(...blocks.map((block) => block.rows.length));
    const blockH = TABLE_CHROME_H + tallest * ROW_H;
    const perPage = bandsThatFit(blockH, BLOCK_GAP) * perRow;
    return chunk(blocks, perPage).map((tables) => {
      const rows = Math.ceil(tables.length / perRow);
      return {
        width: EXPORT_WIDTH,
        height: canvasHeight(rows * blockH + (rows - 1) * BLOCK_GAP),
        model: { kind: "tables", tables },
        scale: 1,
      };
    });
  }

  if (model.kind === "teams") {
    const perPage = bandsThatFit(TEAM_CARD_H, TEAM_GAP) * TEAMS_PER_ROW;
    return chunk(model.teams, perPage).map((teams) => {
      const rows = Math.ceil(teams.length / TEAMS_PER_ROW);
      return {
        width: EXPORT_WIDTH,
        height: canvasHeight(rows * TEAM_CARD_H + (rows - 1) * TEAM_GAP),
        model: { kind: "teams", teams },
        scale: 1,
      };
    });
  }

  if (model.kind === "bracket") {
    const columns = [...model.left, ...model.right];
    const rounds = columns.length;
    // Uneven wings are padded to line up with the trophy, so size by the
    // layout's height, not just the busiest column.
    const deepest = Math.max(
      1,
      ...columns.map((c) => Math.max(c.units ?? 0, c.matches.length)),
    );
    const unit = BRACKET_COL_MIN + BRACKET_COL_GAP + BRACKET_FORK_W;
    const needW = rounds * unit + BRACKET_TROPHY_W;
    const needH = BRACKET_LABEL_H + deepest * MATCH_CARD_H;

    // Shrink to fit before paging: a bracket split across images stops being a
    // bracket, so zooming out is nearly always the better trade.
    const scale = Math.min(
      1,
      (MAX_WIDTH - PAGE_PAD) / needW,
      (MAX_HEIGHT - CHROME_H) / needH,
    );

    if (scale >= BRACKET_MIN_SCALE) {
      return [
        {
          width: Math.round(
            Math.max(EXPORT_WIDTH, Math.min(MAX_WIDTH, PAGE_PAD + needW * scale)),
          ),
          height: Math.round(
            Math.max(
              EXPORT_MIN_HEIGHT,
              Math.min(MAX_HEIGHT, CHROME_H + needH * scale),
            ),
          ),
          model,
          scale,
        },
      ];
    }

    // Too deep even shrunk: hold the smallest readable size and page by match
    // rows, keeping both wings and the trophy on every picture so each one
    // still reads as a bracket.
    const rowsPerPage = Math.max(
      1,
      Math.floor(
        (MAX_HEIGHT - CHROME_H - BRACKET_LABEL_H * BRACKET_MIN_SCALE) /
          (MATCH_CARD_H * BRACKET_MIN_SCALE),
      ),
    );
    const width = Math.round(
      Math.max(
        EXPORT_WIDTH,
        Math.min(MAX_WIDTH, PAGE_PAD + needW * BRACKET_MIN_SCALE),
      ),
    );
    const slice = (cols: ExportColumn[], from: number) =>
      cols
        .map((column) => ({
          ...column,
          matches: column.matches.slice(from, from + rowsPerPage),
          // A slice no longer matches the whole-wing layout: space evenly.
          centres: undefined,
          units: undefined,
        }))
        .filter((column) => column.matches.length > 0);

    const pages: ExportPage[] = [];
    for (let start = 0; start < deepest; start += rowsPerPage) {
      const left = slice(model.left, start);
      const right = slice(model.right, start);
      if (left.length === 0 && right.length === 0) continue;
      const rows = Math.max(
        1,
        ...[...left, ...right].map((c) => c.matches.length),
      );
      pages.push({
        width,
        height: Math.round(
          Math.max(
            EXPORT_MIN_HEIGHT,
            CHROME_H +
              (BRACKET_LABEL_H + rows * MATCH_CARD_H) * BRACKET_MIN_SCALE,
          ),
        ),
        // The final rides on the first page only, where the top of the bracket is.
        model: { kind: "bracket", left, right, final: start === 0 ? model.final : null },
        scale: BRACKET_MIN_SCALE,
      });
    }
    return pages.length > 0
      ? pages
      : [{ width: EXPORT_WIDTH, height: EXPORT_MIN_HEIGHT, model, scale: 1 }];
  }

  if (model.kind === "fixtures") {
    const headerH = 46;
    const rowH = 58;
    const height = model.sections.reduce(
      (total, section) =>
        total + headerH + section.matches.length * rowH + BLOCK_GAP,
      0,
    );
    // One long list rather than pages: a host scanning what is left wants it
    // all in one picture.
    return [
      {
        width: EXPORT_WIDTH,
        height: canvasHeight(height),
        model,
        scale: 1,
      },
    ];
  }

  const roster = Math.max(
    0,
    ...model.places.map((place) => place.players.length),
  );
  const rows = Math.ceil(roster / CHAMPION_ROSTER_PER_ROW);
  return [
    {
      width: CHAMPION_WIDTH,
      height: Math.max(
        CHAMPION_MIN_HEIGHT,
        CHAMPION_BASE_H + rows * CHAMPION_ROSTER_ROW_H,
      ),
      model,
      scale: 1,
    },
  ];
}

export function exportPageCount(model: ExportModel): number {
  return paginateExport(model).length;
}

/** One page of the export, clamped to a page that exists. */
export function layoutExport(model: ExportModel, page = 1): ExportLayout {
  const pages = paginateExport(model);
  const index = Math.min(Math.max(1, Math.trunc(page)), pages.length) - 1;
  return { ...pages[index], page: index + 1, pages: pages.length };
}

/**
 * Which downloads exist for this tournament and how many images each needs, so
 * the page can offer one link per picture instead of a button that quietly
 * hands back part of the answer.
 */
export function exportPlan(
  tournament: Tournament,
  draws: Draw[],
  participants: RegisterTournament[],
): Partial<Record<ExportView, number>> {
  const plan: Partial<Record<ExportView, number>> = {};
  for (const view of exportViewSchema.options) {
    const model = buildExportModel(view, tournament, draws, participants);
    if (model) plan[view] = exportPageCount(model);
  }
  return plan;
}

/**
 * Which download matches the panel a host is actually looking at.
 *
 * The teams tab shows three different things depending on how far a groups
 * tournament has got: the group tables once the stage is drawn, the group
 * arrangement before that, and a plain list of registered teams before groups
 * exist at all. Asking for "groups" in every case meant the last two states
 * offered no button, because there are no group fixtures to draw yet.
 *
 * `available` is the export plan for this tournament.
 */
export function viewForTeamsPanel(input: {
  panel: "teams" | "bracket";
  isGroups: boolean;
  groupsCreated: boolean;
  available: (view: ExportView) => boolean;
}): ExportView | null {
  const { panel, isGroups, groupsCreated, available } = input;
  if (panel === "bracket") return available("bracket") ? "bracket" : null;
  if (isGroups && groupsCreated && available("groups")) return "groups";
  // Falls through to the team list, which is what the panel is showing when
  // there are no groups to draw yet.
  return available("teams") ? "teams" : null;
}
