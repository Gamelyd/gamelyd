import "server-only";
import { ObjectId } from "mongodb";
import { draws, registrations, tournaments } from "../db";
import type {
  DrawDoc,
  RegisterTournamentDoc,
  TournamentDoc,
} from "../documents";
import {
  serializeDraw,
  serializeRegistration,
  serializeTournament,
} from "../serialize";
import {
  asDocFilter,
  byAnyTournamentId,
  byDrawId,
  byTournamentId,
} from "../legacy";
import { relatedTournamentIds } from "./tournamentService";
import { settleEndedTournament } from "./paymentService";
import { ServiceError } from "./userService";
import { createNotifications } from "./notificationService";
import { sendEmail } from "../email/mailer";
import {
  addLinkEmail,
  addTimeEmail,
  drawMadeEmail,
  scorePostedEmail,
} from "../email/templates";
import type { Draw, Player, Teams } from "@/lib/schemas/draw";
import type { Tournament } from "@/lib/schemas/tournament";
import { prizeBoardTotal, teamsNeededForBoard } from "@/lib/prizeBoard";
import { roundMoney } from "@/lib/fees";
import { formatMoney } from "@/lib/currency";
import { hydrateDrawIcons, iconMapFromTeams } from "@/lib/teamIcons";
import { hydrateDraw, hydrateDraws } from "../hydrateVerified";
import type {
  AddScoreInput,
  AddTimeInput,
  SetDrawVenueInput,
  UpdateBrDrawInput,
} from "@/lib/schemas/draw";
import { computeLeagueStandings, standingToTeam } from "@/lib/leagueStandings";
import type { AdvanceGroupStageInput } from "@/lib/schemas/tournament";
import {
  pairWithinHalves,
  seedKnockoutPairs,
} from "@/lib/knockoutSeed";
import {
  asDisqualifiedSet,
  groupQualifiersComplete,
  groupTieBreak,
  qualifiersForGroup,
} from "@/lib/groupQualifiers";
import { stampMatchTimes } from "@/lib/matchSchedule";
import { isKnockoutDraw } from "@/lib/drawKind";
import {
  formatForSeriesGames,
  groupKnockoutTies,
  isKnockoutTieSettled,
  knockoutFormatForRound,
  knockoutLegCount,
  knockoutTieLoser,
  knockoutTieWinner,
  tiesAtStage,
} from "@/lib/knockoutSeries";
import {
  brChampionFromStandings,
  brLobbyComplete,
  computeBrStandings,
} from "@/lib/brStandings";
import type { KnockoutFormat } from "@/lib/schemas/common";

function emptyTeamFrom(team: Teams): Teams {
  return {
    TeamName: team.TeamName,
    Players: team.Players,
    Icon: team.Icon,
    Points: 0,
    GoalsScored: 0,
    GoalsReceived: 0,
    GoalsDifference: 0,
  };
}

/** Builds a knockout fixture (Group left empty). A missing team2 is a bye. */
function knockoutDraw(
  team1: Teams,
  team2: Teams | undefined,
  tournamentId: string,
  stage: number,
  now: string,
  extra: {
    seriesId?: string;
    leg?: number;
    kind?: string;
  } = {},
): DrawDoc {
  const _id = new ObjectId();
  const bye = !team2;
  return {
    _id,
    Team1: emptyTeamFrom(team1),
    Team2: team2 ? emptyTeamFrom(team2) : undefined,
    Created_at: now,
    Updated_at: now,
    TournamentId: tournamentId,
    DrawId: _id.toHexString(),
    Stage: stage,
    Winner: bye ? "Team1" : "",
    BRWinner: "",
    Time: "",
    Date: "",
    Team1Score: 0,
    Team2Score: 0,
    Link: "",
    Group: "",
    BRTeams: [],
    Played: bye,
    SeriesId: extra.seriesId || _id.toHexString(),
    Leg: extra.leg || 1,
    Kind: extra.kind || "",
  };
}

function knockoutSeries(
  team1: Teams,
  team2: Teams | undefined,
  tournamentId: string,
  stage: number,
  now: string,
  format: KnockoutFormat | undefined,
  kind = "",
): DrawDoc[] {
  const seriesId = new ObjectId().toHexString();
  const legs = team2 ? knockoutLegCount(format) : 1;
  return Array.from({ length: legs }, (_, i) =>
    knockoutDraw(team1, team2, tournamentId, stage, now, {
      seriesId,
      leg: i + 1,
      kind,
    }),
  );
}

function scheduleNewDraws(
  docs: DrawDoc[],
  tournament: ReturnType<typeof serializeTournament>,
  alreadyStamped = 0,
): DrawDoc[] {
  return stampMatchTimes(
    docs,
    tournament.FirstMatchAt,
    tournament.MatchIntervalMinutes,
    alreadyStamped,
  );
}

function teamsReadyToPlay(
  teams: Teams[],
  checkedIn: Set<string>,
  required: boolean,
): Teams[] {
  if (!required) return teams;
  return teams.filter((t) => checkedIn.has(t.TeamName));
}

function namesCheckedIn(regDocs: RegisterTournamentDoc[]): Set<string> {
  return new Set(
    regDocs
      .map(serializeRegistration)
      .filter((r) => r.CheckedIn)
      .map((r) => r.TeamName),
  );
}

function teamsFromRegistrations(regDocs: RegisterTournamentDoc[]): Teams[] {
  return regDocs.map((r) => {
    const reg = serializeRegistration(r);
    return {
      TeamName: reg.TeamName,
      Players: reg.Players,
      Icon: reg.Icon,
      Points: 0,
      GoalsScored: 0,
      GoalsReceived: 0,
      GoalsDifference: 0,
    };
  });
}

function fixtureLabel(draw: Draw): string {
  const left = draw.Team1?.TeamName?.trim() || "TBD";
  const right = draw.Team2?.TeamName?.trim() || "TBD";
  const group = draw.Group?.trim();
  return group ? `${left} vs ${right} (${group})` : `${left} vs ${right}`;
}

function flagMissingFixtures(
  draws: Draw[],
  need: "result" | "winner",
): string {
  const labels = [...new Set(draws.filter(Boolean).map(fixtureLabel))];
  const shown = labels.slice(0, 6);
  const extra = labels.length - shown.length;
  const list =
    extra > 0 ? `${shown.join("; ")}; +${extra} more` : shown.join("; ");
  if (need === "result") {
    return `These fixtures still need a result: ${list}. Record the scores, then try again.`;
  }
  return `These fixtures still need a winner: ${list}. If the match ended level (including 0-0), pick who goes through, then try again.`;
}

/**
 * A paid event promises fixed cash prizes, so it must not start until entry
 * fees have actually covered the board. Otherwise the host advertises money
 * that was never collected and settlement pays out short.
 */
function assertBoardFunded(tournament: Tournament): void {
  if (tournament.Payment !== "PAID") return;
  const board = prizeBoardTotal(tournament.Prizes);
  if (board <= 0) return;
  const pot = tournament.PotNet || 0;
  if (pot >= board) return;
  const short = roundMoney(board - pot);
  const need = teamsNeededForBoard(
    board,
    tournament.RegistrationAmount,
    tournament.PlatformFeeBps,
  );
  throw new ServiceError(
    `Entries have raised ${formatMoney(pot, tournament.Currency)} of the ${formatMoney(board, tournament.Currency)} prize board, ${formatMoney(short, tournament.Currency)} short. You need about ${need} paid teams before this can start. Lower the prizes in settings, or wait for more entries.`,
  );
}

export async function newDraw(tournamentId: string): Promise<Draw[]> {
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(tournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(tournamentDoc);
  assertBoardFunded(tournament);

  if (tournament.TournamentMode === "GROUPS") {
    throw new ServiceError(
      "Group tournaments use the group-stage draw. Draw group fixtures, then advance to the knockout.",
    );
  }
  if (tournament.TournamentMode === "LEAGUE") {
    throw new ServiceError("Use the league draw for league tournaments");
  }
  if (tournament.TournamentMode === "BATTLEROYALE") {
    throw new ServiceError("Use the battle royale draw for this tournament");
  }

  const dCol = await draws();
  const existing = await dCol.countDocuments(
    asDocFilter<DrawDoc>(byAnyTournamentId(ids)),
  );
  if (existing > 0 || tournament.IsDrawn) {
    throw new ServiceError(
      "The first round is already drawn. Set a winner on every fixture in this round, then draw the next knockout round.",
    );
  }

  const regDocs = await (await registrations())
    .find(asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)))
    .toArray();
  if (regDocs.length < 2) {
    throw new ServiceError("You need at least 2 teams to draw a tournament");
  }

  const teams = teamsReadyToPlay(
    teamsFromRegistrations(regDocs).filter(
      (t) => !asDisqualifiedSet(tournament.DisqualifiedTeams).has(t.TeamName),
    ),
    namesCheckedIn(regDocs),
    tournament.CheckInRequired,
  );
  if (teams.length < 2) {
    throw new ServiceError(
      tournament.CheckInRequired
        ? "At least 2 teams need to check in before you can draw"
        : "You need at least 2 teams to draw a tournament",
    );
  }

  const ordered =
    tournament.Shuffle === "AUTOMATIC"
      ? [...teams].sort(() => Math.random() - 0.5)
      : teams;

  const stage = (tournament.Stage || 0) + 1;
  const now = new Date().toISOString();
  const drawDocs: DrawDoc[] = [];
  const pairCount = Math.ceil(ordered.length / 2);
  const roundFormat = knockoutFormatForRound(tournament.KnockoutFormat, {
    finalsUseSeries: tournament.KnockoutFinalsSeries,
    isFinal: pairCount === 1,
  });

  for (let i = 0; i < ordered.length; i += 2) {
    drawDocs.push(
      ...knockoutSeries(
        ordered[i],
        ordered[i + 1],
        tournament.TournamentId,
        stage,
        now,
        roundFormat,
      ),
    );
  }

  const stamped = scheduleNewDraws(drawDocs, tournament, 0);

  await dCol.insertMany(stamped);
  await tCol.updateOne({ _id: tournamentDoc._id }, {
    $set: {
      Start: true,
      start: true,
      Stage: stage,
      stage,
      IsDrawn: true,
      isdrawn: true,
      Updated_at: now,
      updated_at: now,
    },
  } as unknown as Parameters<typeof tCol.updateOne>[1]);

  const result = stamped.map(serializeDraw);
  void notifyDrawReady(
    tournament.TournamentId,
    tournament.Name,
    result,
    `Fixtures are out for ${tournament.Name}. Open the tournament to see your matches.`,
  );
  return result;
}

export async function drawBr(tournamentId: string): Promise<Draw[]> {
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(tournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(tournamentDoc);
  assertBoardFunded(tournament);

  const dCol = await draws();
  const existing = await dCol.countDocuments(
    asDocFilter<DrawDoc>(byAnyTournamentId(ids)),
  );
  if (existing > 0) {
    throw new ServiceError("Battle royale lobbies have already been drawn");
  }

  const regDocs = await (await registrations())
    .find(asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)))
    .toArray();
  if (regDocs.length < 2) {
    throw new ServiceError("You need at least 2 teams to draw a tournament");
  }

  const ready = teamsReadyToPlay(
    teamsFromRegistrations(regDocs).filter(
      (r) => !asDisqualifiedSet(tournament.DisqualifiedTeams).has(r.TeamName),
    ),
    namesCheckedIn(regDocs),
    tournament.CheckInRequired,
  );
  const brTeams = ready.map((r) => ({
    TeamName: r.TeamName,
    Players: r.Players,
    Wins: 0,
    Kills: 0,
    FirstBloods: 0,
    Placement: 0,
  }));
  if (brTeams.length < 2) {
    throw new ServiceError(
      tournament.CheckInRequired
        ? "At least 2 teams need to check in before you can draw"
        : "You need at least 2 teams to draw a tournament",
    );
  }

  const now = new Date().toISOString();
  const lobbies = Math.max(1, tournament.BrLobbyCount || 1);
  const drawDocs: DrawDoc[] = Array.from({ length: lobbies }, (_, i) => {
    const _id = new ObjectId();
    return {
      _id,
      Created_at: now,
      Updated_at: now,
      TournamentId: tournament.TournamentId,
      DrawId: _id.toHexString(),
      Stage: i + 1,
      Winner: "",
      BRWinner: "",
      Time: "",
      Date: "",
      Team1Score: 0,
      Team2Score: 0,
      Link: "",
      Group: "",
      BRTeams: brTeams.map((t) => ({ ...t, Players: [...t.Players] })),
      Played: false,
    };
  });
  const stamped = scheduleNewDraws(drawDocs, tournament, 0);

  await dCol.insertMany(stamped);
  await tCol.updateOne({ _id: tournamentDoc._id }, {
    $set: {
      Start: true,
      start: true,
      Stage: lobbies,
      stage: lobbies,
      IsDrawn: true,
      isdrawn: true,
      Updated_at: now,
      updated_at: now,
    },
  } as unknown as Parameters<typeof tCol.updateOne>[1]);
  const result = stamped.map(serializeDraw);
  void notifyDrawReady(
    tournament.TournamentId,
    tournament.Name,
    result,
    `Lobbies are drawn for ${tournament.Name}. Open the tournament to see your lobby.`,
  );
  return result;
}

export async function drawLeague(tournamentId: string): Promise<Draw[]> {
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(tournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(tournamentDoc);
  assertBoardFunded(tournament);

  if (tournament.TournamentMode !== "LEAGUE") {
    throw new ServiceError("This tournament is not a league");
  }
  if (tournament.IsDrawn) {
    throw new ServiceError("League fixtures have already been generated");
  }

  const regDocs = await (await registrations())
    .find(asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)))
    .toArray();
  if (regDocs.length < 2) {
    throw new ServiceError("You need at least 2 teams to start a league");
  }

  const teams = teamsReadyToPlay(
    teamsFromRegistrations(regDocs).filter(
      (t) => !asDisqualifiedSet(tournament.DisqualifiedTeams).has(t.TeamName),
    ),
    namesCheckedIn(regDocs),
    tournament.CheckInRequired,
  );
  if (teams.length < 2) {
    throw new ServiceError(
      tournament.CheckInRequired
        ? "At least 2 teams need to check in before you can start"
        : "You need at least 2 teams to start a league",
    );
  }
  const ordered =
    tournament.Shuffle === "AUTOMATIC" ? shuffleTeams(teams) : teams;
  const now = new Date().toISOString();
  const pairings = circleRoundRobin(ordered, tournament.ReturnLeg);
  const lastStage = pairings[pairings.length - 1]?.stage ?? 1;

  const drawDocs: DrawDoc[] = pairings.map((pair) => {
    const _id = new ObjectId();
    return {
      _id,
      Team1: emptyTeamFrom(pair.team1),
      Team2: emptyTeamFrom(pair.team2),
      Created_at: now,
      Updated_at: now,
      TournamentId: tournament.TournamentId,
      DrawId: _id.toHexString(),
      Stage: pair.stage,
      Winner: "",
      BRWinner: "",
      Time: "",
      Date: "",
      Team1Score: 0,
      Team2Score: 0,
      Link: "",
      Group: "",
      BRTeams: [],
      Played: false,
    };
  });

  const stamped = scheduleNewDraws(drawDocs, tournament, 0);

  const dCol = await draws();
  await dCol.insertMany(stamped);
  await tCol.updateOne({ _id: tournamentDoc._id }, {
    $set: {
      Start: true,
      start: true,
      Stage: lastStage,
      stage: lastStage,
      IsDrawn: true,
      isdrawn: true,
      Updated_at: now,
      updated_at: now,
    },
  } as unknown as Parameters<typeof tCol.updateOne>[1]);

  const result = stamped.map(serializeDraw);
  void notifyDrawReady(
    tournament.TournamentId,
    tournament.Name,
    result,
    `Fixtures are out for ${tournament.Name}. Open the tournament to see your matches.`,
  );
  return result;
}

/**
 * Group-stage fixtures: a single round-robin within each group, every match
 * tagged with its group name. Matchdays share stage numbers across groups.
 */
export async function drawGroupStage(tournamentId: string): Promise<Draw[]> {
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(tournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(tournamentDoc);
  assertBoardFunded(tournament);

  if (tournament.TournamentMode !== "GROUPS") {
    throw new ServiceError("This tournament is not a group tournament");
  }
  if (!tournament.Groups || tournament.Groups.length === 0) {
    throw new ServiceError("Create groups before drawing fixtures");
  }

  const dCol = await draws();
  const existing = await dCol.countDocuments(
    asDocFilter<DrawDoc>(byAnyTournamentId(ids)),
  );
  if (existing > 0) {
    throw new ServiceError("Group fixtures have already been drawn");
  }

  const now = new Date().toISOString();
  const drawDocs: DrawDoc[] = [];
  let maxStage = 0;

  for (const group of tournament.Groups) {
    const pairings = circleRoundRobin(group.Teams, tournament.ReturnLeg);
    for (const pair of pairings) {
      maxStage = Math.max(maxStage, pair.stage);
      const _id = new ObjectId();
      drawDocs.push({
        _id,
        Team1: emptyTeamFrom(pair.team1),
        Team2: emptyTeamFrom(pair.team2),
        Created_at: now,
        Updated_at: now,
        TournamentId: tournament.TournamentId,
        DrawId: _id.toHexString(),
        Stage: pair.stage,
        Winner: "",
        BRWinner: "",
        Time: "",
        Date: "",
        Team1Score: 0,
        Team2Score: 0,
        Link: "",
        Group: group.GroupName,
        BRTeams: [],
        Played: false,
      });
    }
  }

  if (drawDocs.length === 0) {
    throw new ServiceError(
      "Each group needs at least two teams to draw fixtures",
    );
  }

  const stamped = scheduleNewDraws(drawDocs, tournament, 0);

  await dCol.insertMany(stamped);
  await tCol.updateOne({ _id: tournamentDoc._id }, {
    $set: {
      Start: true,
      start: true,
      Stage: maxStage,
      stage: maxStage,
      IsDrawn: true,
      isdrawn: true,
      Updated_at: now,
      updated_at: now,
    },
  } as unknown as Parameters<typeof tCol.updateOne>[1]);

  const result = stamped.map(serializeDraw);
  void notifyDrawReady(
    tournament.TournamentId,
    tournament.Name,
    result,
    `Fixtures are out for ${tournament.Name}. Open the tournament to see your matches.`,
  );
  return result;
}

/**
 * Seeds the knockout stage from group qualifiers. When the organiser is
 * allowed to pick, those selections (and their public reasons) are used.
 * Otherwise the top N of each group (N = AdvancePerGroup) qualify.
 */
export async function advanceGroupStage(
  tournamentId: string,
  input: AdvanceGroupStageInput,
): Promise<Draw[]> {
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(tournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(tournamentDoc);

  if (tournament.TournamentMode !== "GROUPS") {
    throw new ServiceError("This tournament is not a group tournament");
  }
  if (!tournament.Groups || tournament.Groups.length === 0) {
    throw new ServiceError("This tournament has no groups");
  }

  const dCol = await draws();
  const allDraws = (
    await dCol.find(asDocFilter<DrawDoc>(byAnyTournamentId(ids))).toArray()
  ).map(serializeDraw);
  const groupDraws = allDraws.filter((d) => d.Group);
  if (groupDraws.length === 0) {
    throw new ServiceError("Draw the group fixtures first");
  }
  const knockoutDraws = allDraws.filter(isKnockoutDraw);
  if (knockoutDraws.length > 0) {
    throw new ServiceError("The knockout stage has already been drawn");
  }
  if (groupDraws.some((d) => !d.Played)) {
    throw new ServiceError(
      flagMissingFixtures(
        groupDraws.filter((d) => !d.Played),
        "result",
      ),
    );
  }

  const advancePerGroup =
    tournament.AdvancePerGroup || input.AdvancePerGroup || 2;
  const disqualified = asDisqualifiedSet(tournament.DisqualifiedTeams);
  const byPosition = qualifiersFromGroups(
    tournament,
    groupDraws,
    advancePerGroup,
    disqualified,
  );

  const pairs = seedKnockoutPairs(byPosition);
  if (pairs.length === 0) {
    throw new ServiceError("Not enough qualifiers to make a knockout stage");
  }

  const now = new Date().toISOString();
  const nextStage = (tournament.Stage || 0) + 1;
  const roundFormat = knockoutFormatForRound(tournament.KnockoutFormat, {
    finalsUseSeries: tournament.KnockoutFinalsSeries,
    isFinal: pairs.length === 1,
  });
  const drawDocs: DrawDoc[] = pairs.flatMap(([team1, team2]) =>
    knockoutSeries(
      team1,
      team2,
      tournament.TournamentId,
      nextStage,
      now,
      roundFormat,
    ),
  );
  const stamped = scheduleNewDraws(drawDocs, tournament, allDraws.length);

  await dCol.insertMany(stamped);
  await tCol.updateOne({ _id: tournamentDoc._id }, {
    $set: {
      Stage: nextStage,
      stage: nextStage,
      Updated_at: now,
      updated_at: now,
    },
  } as unknown as Parameters<typeof tCol.updateOne>[1]);

  const result = stamped.map(serializeDraw);
  void notifyDrawReady(
    tournament.TournamentId,
    tournament.Name,
    result,
    `The knockout stage is drawn in ${tournament.Name}. Check your fixture.`,
  );
  return result;
}

function qualifiersFromGroups(
  tournament: ReturnType<typeof serializeTournament>,
  groupDraws: Draw[],
  advancePerGroup: number,
  disqualified: Set<string>,
): Teams[][] {
  const manual = tournament.OwnerCanSelectQualifiers;
  const sections = tournament.Groups.map((group) => {
    const standings = computeLeagueStandings(
      group.Teams,
      groupDraws.filter((d) => d.Group === group.GroupName),
      tournament.PointSystem,
      tournament.TieBreaker,
    );
    return { group, standings };
  });

  if (manual) {
    const complete = groupQualifiersComplete(
      sections.map((s) => ({
        name: s.group.GroupName,
        standings: s.standings,
      })),
      tournament.Qualifiers,
      advancePerGroup,
      disqualified,
      true,
    );
    if (!complete) {
      throw new ServiceError(
        "Teams are level on points. Pick who qualifies (with a public reason) before advancing",
      );
    }
  }

  const byPosition: Teams[][] = [];
  for (const { group, standings } of sections) {
    const eligible = standings.filter((row) => !disqualified.has(row.TeamName));
    const tie = manual
      ? groupTieBreak(standings, advancePerGroup, group.GroupName, disqualified)
      : null;

    let names: string[];
    if (tie) {
      const chosen = qualifiersForGroup(
        tournament.Qualifiers,
        group.GroupName,
      ).map((q) => q.TeamName);
      names = [...tie.autoQualified, ...chosen];
    } else {
      names = eligible.slice(0, advancePerGroup).map((row) => row.TeamName);
    }

    names.forEach((name, pos) => {
      const row = standings.find((s) => s.TeamName === name);
      if (!row) {
        throw new ServiceError(`${name} is not in ${group.GroupName}`);
      }
      (byPosition[pos] ??= []).push(standingToTeam(row));
    });
  }
  return byPosition;
}

/** Advances knockout-round winners into the next round. */
export async function drawKnockoutNext(tournamentId: string): Promise<Draw[]> {
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(tournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(tournamentDoc);
  const format = tournament.KnockoutFormat;

  const dCol = await draws();
  const allDraws = (
    await dCol.find(asDocFilter<DrawDoc>(byAnyTournamentId(ids))).toArray()
  ).map(serializeDraw);
  const knockoutDraws = allDraws.filter(isKnockoutDraw);
  if (knockoutDraws.length === 0) {
    throw new ServiceError("Advance the group stage first");
  }

  const ties = groupKnockoutTies(knockoutDraws, false);
  const maxStage = Math.max(...ties.map((tie) => tie.stage));
  const current = tiesAtStage(ties, maxStage);
  const unresolved = current.filter((tie) => {
    const seriesFormat = formatForSeriesGames(tie.games, format);
    return !knockoutTieWinner(tie.games, seriesFormat);
  });
  if (unresolved.length > 0) {
    throw new ServiceError(
      flagMissingFixtures(
        unresolved
          .map((tie) => tie.games[tie.games.length - 1] ?? tie.games[0])
          .filter((draw): draw is Draw => Boolean(draw)),
        "winner",
      ),
    );
  }

  const dq = asDisqualifiedSet(tournament.DisqualifiedTeams);
  const winners = current
    .map((tie) =>
      knockoutTieWinner(tie.games, formatForSeriesGames(tie.games, format)),
    )
    .filter((team): team is Teams => {
      if (!team) return false;
      return !dq.has(team.TeamName);
    });
  if (winners.length === 1) {
    const now = new Date().toISOString();
    await tCol.updateOne({ _id: tournamentDoc._id }, {
      $set: {
        Winner: winners[0],
        winner: winners[0],
        Active: false,
        active: false,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof tCol.updateOne>[1]);
    return allDraws;
  }
  if (winners.length < 2) {
    throw new ServiceError("The knockout stage is already decided");
  }

  const now = new Date().toISOString();
  const nextStage = maxStage + 1;
  const nextPairs = pairWithinHalves(winners);
  const isFinal = nextPairs.length === 1;
  const roundFormat = knockoutFormatForRound(format, {
    finalsUseSeries: tournament.KnockoutFinalsSeries,
    isFinal,
  });
  const drawDocs: DrawDoc[] = nextPairs.flatMap(([team1, team2]) =>
    knockoutSeries(
      team1,
      team2,
      tournament.TournamentId,
      nextStage,
      now,
      roundFormat,
    ),
  );

  if (tournament.ThirdPlace && current.length === 2 && nextPairs.length === 1) {
    const losers = current
      .map((tie) =>
        knockoutTieLoser(tie.games, formatForSeriesGames(tie.games, format)),
      )
      .filter((team): team is Teams => Boolean(team && !dq.has(team.TeamName)));
    if (losers.length === 2) {
      drawDocs.push(
        ...knockoutSeries(
          losers[0],
          losers[1],
          tournament.TournamentId,
          nextStage,
          now,
          knockoutFormatForRound(format, { isThirdPlace: true }),
          "THIRD_PLACE",
        ),
      );
    }
  }

  const stamped = scheduleNewDraws(drawDocs, tournament, allDraws.length);
  await dCol.insertMany(stamped);
  await tCol.updateOne({ _id: tournamentDoc._id }, {
    $set: {
      Stage: nextStage,
      stage: nextStage,
      Updated_at: now,
      updated_at: now,
    },
  } as unknown as Parameters<typeof tCol.updateOne>[1]);

  const result = stamped.map(serializeDraw);
  void notifyDrawReady(
    tournament.TournamentId,
    tournament.Name,
    result,
    `The next round is drawn in ${tournament.Name}. Check your fixture.`,
  );
  return result;
}

export async function getDrawsByTournament(
  tournamentId: string,
): Promise<Draw[]> {
  const ids = await relatedTournamentIds(tournamentId);
  const col = await draws();
  const docs = await col
    .find(asDocFilter<DrawDoc>(byAnyTournamentId(ids)))
    .limit(1000)
    .toArray();
  const mapped = docs.map(serializeDraw);
  const regDocs = await (
    await registrations()
  )
    .find(asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)))
    .limit(1000)
    .toArray();
  const icons = iconMapFromTeams(regDocs.map(serializeRegistration));
  return hydrateDraws(mapped.map((draw) => hydrateDrawIcons(draw, icons)));
}

export async function getDrawTournamentId(
  drawId: string,
): Promise<string | null> {
  const col = await draws();
  const found = await col.findOne(asDocFilter<DrawDoc>(byDrawId(drawId)));
  return found ? serializeDraw(found).TournamentId : null;
}

export async function addWinner(drawId: string, winner: string): Promise<Draw> {
  const col = await draws();
  const updated = await col.findOneAndUpdate(
    asDocFilter<DrawDoc>(byDrawId(drawId)),
    { $set: { Winner: winner, Updated_at: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Draw not found");
  const mapped = serializeDraw(updated);
  await maybeFinishKnockout(mapped);
  return hydrateDraw(mapped);
}

export async function addTime(
  drawId: string,
  input: AddTimeInput,
): Promise<Draw> {
  const col = await draws();
  const updated = await col.findOneAndUpdate(
    asDocFilter<DrawDoc>(byDrawId(drawId)),
    {
      $set: {
        Time: input.Time,
        Date: input.Date,
        Updated_at: new Date().toISOString(),
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Draw not found");

  const mapped = serializeDraw(updated);
  void notifyTimeSet(mapped);
  return hydrateDraw(mapped);
}

/**
 * Point one fixture at a place. Passing an empty name clears it, so a host can
 * undo a mistake without deleting the match.
 */
export async function setDrawVenue(
  drawId: string,
  input: SetDrawVenueInput,
): Promise<Draw> {
  const col = await draws();
  const name = input.VenueName.trim();
  const hasPoint =
    Number.isFinite(input.VenueLat) &&
    Number.isFinite(input.VenueLng) &&
    !(input.VenueLat === 0 && input.VenueLng === 0);

  const updated = await col.findOneAndUpdate(
    asDocFilter<DrawDoc>(byDrawId(drawId)),
    name
      ? {
          $set: {
            VenueName: name,
            VenueCountry: input.VenueCountry.toUpperCase(),
            VenueLat: hasPoint ? input.VenueLat : 0,
            VenueLng: hasPoint ? input.VenueLng : 0,
            Updated_at: new Date().toISOString(),
            ...(hasPoint
              ? {
                  VenueGeo: {
                    type: "Point" as const,
                    coordinates: [input.VenueLng, input.VenueLat] as [
                      number,
                      number,
                    ],
                  },
                }
              : {}),
          },
          ...(hasPoint ? {} : { $unset: { VenueGeo: "" } }),
        }
      : {
          $set: {
            VenueName: "",
            VenueCountry: "",
            VenueLat: 0,
            VenueLng: 0,
            Updated_at: new Date().toISOString(),
          },
          $unset: { VenueGeo: "" },
        },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Draw not found");

  const mapped = serializeDraw(updated);
  if (name) void notifyVenueSet(mapped);
  return hydrateDraw(mapped);
}

export async function addScore(
  drawId: string,
  input: AddScoreInput,
): Promise<Draw> {
  const col = await draws();
  const winner =
    input.Team1 > input.Team2
      ? "Team1"
      : input.Team2 > input.Team1
        ? "Team2"
        : "";

  const updated = await col.findOneAndUpdate(
    asDocFilter<DrawDoc>(byDrawId(drawId)),
    {
      $set: {
        Team1Score: input.Team1,
        Team2Score: input.Team2,
        Winner: input.Winner || winner,
        Played: true,
        played: true,
        Updated_at: new Date().toISOString(),
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Draw not found");

  const mapped = serializeDraw(updated);
  await maybeFinishLeague(mapped);
  await maybeFinishKnockout(mapped);
  if (input.IsFinal === "true" && input.WinnerTeam) {
    const winningTeam =
      (input.Winner || winner) === "Team1" ? mapped.Team1 : mapped.Team2;
    if (winningTeam) {
      const tCol = await tournaments();
      await tCol.updateOne(
        asDocFilter<TournamentDoc>(byTournamentId(input.TournamentId)),
        {
          $set: {
            Winner: winningTeam,
            winner: winningTeam,
            Active: false,
            active: false,
            Updated_at: new Date().toISOString(),
          },
        } as unknown as Parameters<typeof tCol.updateOne>[1],
      );
      void settleEndedTournament(input.TournamentId).catch((error) =>
        console.error(error),
      );
    }
  }
  void notifyScorePosted(mapped);
  return hydrateDraw(mapped);
}

export async function addLink(drawId: string, link: string): Promise<Draw> {
  const col = await draws();
  const updated = await col.findOneAndUpdate(
    asDocFilter<DrawDoc>(byDrawId(drawId)),
    { $set: { Link: link, Updated_at: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Draw not found");

  const mapped = serializeDraw(updated);
  notifyPlayers(updated, (name, tournamentName) =>
    addLinkEmail(name, tournamentName, mapped.TournamentId),
  );
  return hydrateDraw(mapped);
}

export async function updateBrDraw(
  drawId: string,
  input: UpdateBrDrawInput,
): Promise<Draw> {
  const col = await draws();
  const existing = await col.findOne(asDocFilter<DrawDoc>(byDrawId(drawId)));
  const first = input.Players.find((t) => t.Placement === 1);
  const played = brLobbyComplete({
    BRTeams: input.Players,
    Played: false,
  } as Draw);
  const updated = await col.findOneAndUpdate(
    asDocFilter<DrawDoc>(byDrawId(drawId)),
    {
      $set: {
        BRTeams: input.Players,
        Link: input.Link,
        Date: input.Date,
        Time: input.Time,
        Played: played,
        played: played,
        BRWinner: first?.TeamName || "",
        Updated_at: new Date().toISOString(),
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Draw not found");
  const mapped = serializeDraw(updated);
  await maybeFinishBr(mapped);
  const previous = existing ? serializeDraw(existing) : null;
  const timeChanged =
    !previous ||
    previous.Date !== mapped.Date ||
    previous.Time !== mapped.Time;
  if (timeChanged && (mapped.Date || mapped.Time)) {
    void notifyTimeSet(mapped);
  }
  if (played) void notifyScorePosted(mapped);
  return hydrateDraw(mapped);
}

/* --------------------------- helpers --------------------------- */

function shuffleTeams(teams: Teams[]): Teams[] {
  const ordered = [...teams];
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  return ordered;
}

function circleRoundRobin(
  teams: Teams[],
  returnLeg: boolean,
): { stage: number; team1: Teams; team2: Teams }[] {
  const rotation: (Teams | null)[] = [...teams];
  if (rotation.length % 2 === 1) rotation.push(null);

  const n = rotation.length;
  const rounds = n - 1;
  const half = n / 2;
  const firstHalf: { stage: number; team1: Teams; team2: Teams }[] = [];

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const home = rotation[i];
      const away = rotation[n - 1 - i];
      if (!home || !away) continue;
      firstHalf.push({ stage: round + 1, team1: home, team2: away });
    }
    const last = rotation.pop();
    if (last !== undefined) rotation.splice(1, 0, last);
  }

  if (!returnLeg) return firstHalf;

  return [
    ...firstHalf,
    ...firstHalf.map((pair) => ({
      stage: pair.stage + rounds,
      team1: pair.team2,
      team2: pair.team1,
    })),
  ];
}

async function maybeFinishLeague(draw: Draw): Promise<void> {
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(draw.TournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) return;
  const tournament = serializeTournament(tournamentDoc);
  if (tournament.TournamentMode !== "LEAGUE") return;

  const leagueDraws = await getDrawsByTournament(draw.TournamentId);
  if (leagueDraws.length === 0 || leagueDraws.some((item) => !item.Played)) {
    return;
  }

  const teams = leagueDraws.flatMap((item) =>
    [item.Team1, item.Team2].filter((team): team is Teams => Boolean(team)),
  );
  const unique = [
    ...new Map(teams.map((team) => [team.TeamName, team])).values(),
  ];
  const table = computeLeagueStandings(
    unique,
    leagueDraws,
    tournament.PointSystem,
    tournament.TieBreaker,
  );
  const leader = table[0];
  if (!leader) return;

  await tCol.updateOne({ _id: tournamentDoc._id }, {
    $set: {
      Winner: standingToTeam(leader),
      winner: standingToTeam(leader),
      Active: false,
      active: false,
      Updated_at: new Date().toISOString(),
    },
  } as unknown as Parameters<typeof tCol.updateOne>[1]);
  void settleEndedTournament(tournament.TournamentId).catch((error) =>
    console.error(error),
  );
}

async function maybeFinishKnockout(draw: Draw): Promise<void> {
  if (!isKnockoutDraw(draw)) return;
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(draw.TournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) return;
  const tournament = serializeTournament(tournamentDoc);
  if (
    tournament.TournamentMode !== "MULTIPLAYER" &&
    tournament.TournamentMode !== "GROUPS"
  ) {
    return;
  }
  const all = await getDrawsByTournament(draw.TournamentId);
  const ties = groupKnockoutTies(all, false);
  if (ties.length === 0) return;
  const maxStage = Math.max(...ties.map((tie) => tie.stage));
  const current = tiesAtStage(ties, maxStage);
  if (current.length !== 1) return;
  const seriesFormat = formatForSeriesGames(
    current[0].games,
    tournament.KnockoutFormat,
  );
  if (!isKnockoutTieSettled(current[0].games, seriesFormat)) {
    return;
  }
  const winner = knockoutTieWinner(current[0].games, seriesFormat);
  if (!winner) return;
  await tCol.updateOne({ _id: tournamentDoc._id }, {
    $set: {
      Winner: winner,
      winner: winner,
      Active: false,
      active: false,
      Updated_at: new Date().toISOString(),
    },
  } as unknown as Parameters<typeof tCol.updateOne>[1]);
  void settleEndedTournament(tournament.TournamentId).catch((error) =>
    console.error(error),
  );
}

async function maybeFinishBr(draw: Draw): Promise<void> {
  if ((draw.BRTeams?.length ?? 0) === 0) return;
  const tCol = await tournaments();
  const ids = await relatedTournamentIds(draw.TournamentId);
  const tournamentDoc = await tCol.findOne(
    asDocFilter<TournamentDoc>(byAnyTournamentId(ids)),
  );
  if (!tournamentDoc) return;
  const tournament = serializeTournament(tournamentDoc);
  if (tournament.TournamentMode !== "BATTLEROYALE") return;
  const all = await getDrawsByTournament(draw.TournamentId);
  const lobbies = all.filter((d) => (d.BRTeams?.length ?? 0) > 0);
  if (lobbies.length === 0 || lobbies.some((d) => !brLobbyComplete(d))) return;
  const table = computeBrStandings(lobbies, {
    PlacementPoints: tournament.BrPlacementPoints,
    KillPoints: tournament.BrKillPoints,
    FirstBloodPoints: tournament.BrFirstBloodPoints,
  });
  const champ = brChampionFromStandings(table);
  if (!champ) return;
  await tCol.updateOne({ _id: tournamentDoc._id }, {
    $set: {
      Winner: {
        TeamName: champ.TeamName,
        Players: champ.Players,
        Icon: "",
        Points: table[0]?.Points ?? 0,
        GoalsScored: 0,
        GoalsReceived: 0,
        GoalsDifference: 0,
      },
      winner: {
        TeamName: champ.TeamName,
        Players: champ.Players,
        Icon: "",
        Points: table[0]?.Points ?? 0,
        GoalsScored: 0,
        GoalsReceived: 0,
        GoalsDifference: 0,
      },
      Active: false,
      active: false,
      Updated_at: new Date().toISOString(),
    },
  } as unknown as Parameters<typeof tCol.updateOne>[1]);
  void settleEndedTournament(tournament.TournamentId).catch((error) =>
    console.error(error),
  );
}

function playersOnDraw(draw: Draw): Player[] {
  return [
    ...(draw.Team1?.Players ?? []),
    ...(draw.Team2?.Players ?? []),
    ...(draw.BRTeams ?? []).flatMap((team) => team.Players ?? []),
  ];
}

function uniquePlayers(draws: Draw[]): Player[] {
  const byId = new Map<string, Player>();
  for (const draw of draws) {
    for (const player of playersOnDraw(draw)) {
      if (player.User_id) byId.set(player.User_id, player);
    }
  }
  return [...byId.values()];
}

async function notifyDrawReady(
  tournamentId: string,
  tournamentName: string,
  draws: Draw[],
  message: string,
): Promise<void> {
  try {
    const players = uniquePlayers(draws);
    const timed = draws.find((draw) => draw.Date.trim() && draw.Time.trim());
    const full = timed
      ? `${message} Kickoff ${timed.Date} at ${timed.Time}.`
      : message;
    await createNotifications(
      players.map((player) => player.User_id),
      full,
      { kind: "DRAW", tournament_id: tournamentId },
    );
    for (const player of players) {
      if (player.Email) {
        void sendEmail(
          player.Email,
          drawMadeEmail(player.UserName, tournamentName, tournamentId, full),
        );
      }
    }
  } catch (error) {
    console.error(error);
  }
}

async function notifyScorePosted(draw: Draw): Promise<void> {
  try {
    const tournamentDoc = await (
      await tournaments()
    ).findOne(asDocFilter<TournamentDoc>(byTournamentId(draw.TournamentId)));
    const tournamentName = tournamentDoc
      ? serializeTournament(tournamentDoc).Name
      : "your tournament";
    const isBr = (draw.BRTeams?.length ?? 0) > 0;
    const message = isBr
      ? `Lobby results are in for ${tournamentName}.`
      : `${draw.Team1?.TeamName || "Team 1"} ${draw.Team1Score}-${draw.Team2Score} ${draw.Team2?.TeamName || "Team 2"} in ${tournamentName}.`;
    const players = uniquePlayers([draw]);
    await createNotifications(
      players.map((player) => player.User_id),
      message,
      { kind: "SCORE", tournament_id: draw.TournamentId },
    );
    for (const player of players) {
      if (player.Email) {
        void sendEmail(
          player.Email,
          scorePostedEmail(
            player.UserName,
            tournamentName,
            draw.TournamentId,
            message,
          ),
        );
      }
    }
  } catch (error) {
    console.error(error);
  }
}

/** Tells both teams where they are playing. In-app only, no email needed. */
async function notifyVenueSet(draw: Draw): Promise<void> {
  try {
    const venue = draw.VenueName.trim();
    if (!venue) return;
    const tournamentDoc = await (
      await tournaments()
    ).findOne(asDocFilter<TournamentDoc>(byTournamentId(draw.TournamentId)));
    const tournamentName = tournamentDoc
      ? serializeTournament(tournamentDoc).Name
      : "your tournament";
    const fixture =
      draw.Team1?.TeamName && draw.Team2?.TeamName
        ? `${draw.Team1.TeamName} vs ${draw.Team2.TeamName}`
        : "Your match";
    await createNotifications(
      uniquePlayers([draw]).map((player) => player.User_id),
      `${fixture} in ${tournamentName} will be played at ${venue}.`,
      { kind: "TIME", tournament_id: draw.TournamentId },
    );
  } catch (error) {
    console.error("[draw] venue notification failed:", error);
  }
}

async function notifyTimeSet(draw: Draw): Promise<void> {
  try {
    const date = draw.Date.trim();
    const time = draw.Time.trim();
    if (!date && !time) return;
    const when = date && time ? `${date} at ${time}` : date || time;
    const tournamentDoc = await (
      await tournaments()
    ).findOne(asDocFilter<TournamentDoc>(byTournamentId(draw.TournamentId)));
    const tournamentName = tournamentDoc
      ? serializeTournament(tournamentDoc).Name
      : "your tournament";
    const fixture =
      draw.Team1?.TeamName && draw.Team2?.TeamName
        ? `${draw.Team1.TeamName} vs ${draw.Team2.TeamName}`
        : "Your match";
    const message = `${fixture} in ${tournamentName} is set for ${when}.`;
    const players = uniquePlayers([draw]);
    await createNotifications(
      players.map((player) => player.User_id),
      message,
      { kind: "TIME", tournament_id: draw.TournamentId },
    );
    for (const player of players) {
      if (player.Email) {
        void sendEmail(
          player.Email,
          addTimeEmail(
            player.UserName,
            tournamentName,
            draw.TournamentId,
            time || "TBD",
            date || "TBD",
          ),
        );
      }
    }
  } catch (error) {
    console.error(error);
  }
}

async function notifyPlayers(
  draw: DrawDoc,
  build: (
    name: string,
    tournamentName: string,
  ) => { subject: string; html: string },
): Promise<void> {
  const mapped = serializeDraw(draw);
  const tournamentDoc = await (
    await tournaments()
  ).findOne(asDocFilter<TournamentDoc>(byTournamentId(mapped.TournamentId)));
  const tournamentName = tournamentDoc
    ? serializeTournament(tournamentDoc).Name
    : "your tournament";
  const players = uniquePlayers([mapped]);
  for (const player of players) {
    if (player.Email) {
      void sendEmail(player.Email, build(player.UserName, tournamentName));
    }
  }
}
