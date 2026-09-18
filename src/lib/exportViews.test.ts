import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CHAMPION_WIDTH,
  EXPORT_MIN_HEIGHT,
  EXPORT_WIDTH,
  layoutExport,
  paginateExport,
  exportPageCount,
  availableExportViews,
  buildMyMatches,
  buildUnplayed,
  viewForTeamsPanel,
  buildBracket,
  buildChampions,
  buildExportModel,
  buildGroups,
  buildTeams,
} from "@/lib/exportViews";
import type { Draw, Teams } from "@/lib/schemas/draw";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { Tournament } from "@/lib/schemas/tournament";

/* Fixtures are deliberately minimal: these builders only read a few fields, and
 * spelling out a whole Tournament would hide which ones actually matter. */

function tournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    TournamentMode: "MULTIPLAYER",
    PointSystem: { Win: 3, Draw: 1 },
    TieBreaker: "GOAL_DIFF",
    BrKillPoints: 1,
    BrFirstBloodPoints: 0,
    BrPlacementPoints: [12, 9, 7, 5, 4, 3, 2, 1],
    ...overrides,
  } as Tournament;
}

function draw(overrides: Partial<Draw> = {}): Draw {
  return {
    Stage: 1,
    Group: "",
    Kind: "",
    BRTeams: [],
    Team1Score: 0,
    Team2Score: 0,
    Winner: "",
    Played: false,
    ...overrides,
  } as Draw;
}

const team = (TeamName: string) => ({ TeamName, Players: [] }) as unknown as Teams;

function entry(name: string, players: string[] = []): RegisterTournament {
  return {
    TeamName: name,
    Icon: "",
    Players: players.map((UserName) => ({ UserName, GameUserName: "" })),
  } as RegisterTournament;
}

describe("buildBracket", () => {
  // Stages count up toward the final, the way the draw service numbers them.
  const draws = [
    draw({ Stage: 1, DrawId: "s1", Team1: team("A"), Team2: team("B"), Winner: "Team1", Played: true }),
    draw({ Stage: 1, DrawId: "s2", Team1: team("C"), Team2: team("D"), Winner: "Team2", Played: true }),
    draw({ Stage: 2, DrawId: "f", Team1: team("A"), Team2: team("D"), Winner: "Team1", Played: true }),
  ];

  test("splits each round across two facing wings", () => {
    // A bracket is two halves meeting at the final. Laid out as one run of
    // columns it just reads as fixtures grouped by round.
    const { left, right } = buildBracket(tournament(), draws);
    assert.equal(left.length, 1);
    assert.equal(right.length, 1);
    assert.equal(left[0].label, "SEMI-FINALS");
    assert.equal(right[0].label, "SEMI-FINALS");
    assert.equal(left[0].matches[0].home.name, "A");
    assert.equal(right[0].matches[0].home.name, "C");
  });

  test("the final becomes the centrepiece, not a column", () => {
    const { left, right, final } = buildBracket(tournament(), draws);
    for (const column of [...left, ...right]) {
      assert.notEqual(column.label, "FINALS");
    }
    assert.equal(final?.home.name, "A");
    assert.equal(final?.away.name, "D");
    assert.equal(final?.champion?.name, "A");
  });

  test("no champion until the final is decided", () => {
    const undecided = [...draws.slice(0, 2), draw({ Stage: 2, DrawId: "f", Team1: team("A"), Team2: team("D") })];
    const { final } = buildBracket(tournament(), undecided);
    assert.equal(final?.champion, null);
    assert.equal(final?.played, false);
  });

  test("marks the side that went through", () => {
    // Winner is the side ("Team1"/"Team2"), never the team name.
    const { left, right } = buildBracket(tournament(), draws);
    assert.equal(left[0].matches[0].home.won, true);
    assert.equal(left[0].matches[0].away.won, false);
    assert.equal(right[0].matches[0].away.won, true);
  });

  test("a match with no winner recorded highlights neither side", () => {
    const { left } = buildBracket(tournament(), [
      draw({ Stage: 1, DrawId: "a", Team1: team("A"), Team2: team("B"), Team1Score: 3, Team2Score: 3, Played: true }),
      draw({ Stage: 1, DrawId: "b", Team1: team("C"), Team2: team("D"), Played: true }),
    ]);
    assert.equal(left[0].matches[0].home.won, false);
    assert.equal(left[0].matches[0].away.won, false);
  });

  test("an unplayed slot reads as TBD rather than blank", () => {
    const { left } = buildBracket(tournament(), [
      draw({ Stage: 1, Team1: team("A") }),
    ]);
    assert.equal(left[0].matches[0].away.name, "TBD");
  });

  test("rounds not played yet are still drawn, as TBD", () => {
    // Only the first round exists; the page still shows every later round.
    const firstRound = ["A", "B", "C", "D", "E", "F", "G", "H"].reduce<Draw[]>(
      (out, name, i, all) =>
        i % 2 === 0
          ? [...out, draw({ Stage: 1, DrawId: `q${i}`, Team1: team(name), Team2: team(all[i + 1]) })]
          : out,
      [],
    );
    const { left, right, final } = buildBracket(tournament(), firstRound);
    assert.deepEqual(left.map((c) => c.label), ["QUARTER-FINALS", "SEMI-FINALS"]);
    assert.deepEqual(right.map((c) => c.label), ["QUARTER-FINALS", "SEMI-FINALS"]);
    assert.equal(left[1].matches[0].home.name, "TBD");
    assert.equal(left[1].matches[0].home.empty, true);
    assert.equal(final?.champion, null);
  });

  test("a team that went through shows no score in its next match", () => {
    const { left } = buildBracket(tournament(), [
      draw({ Stage: 1, DrawId: "a", Team1: team("A"), Team2: team("B"), Team1Score: 3, Team2Score: 1, Played: true }),
      draw({ Stage: 1, DrawId: "b", Team1: team("C"), Team2: team("D") }),
      draw({ Stage: 1, DrawId: "c", Team1: team("E"), Team2: team("F") }),
      draw({ Stage: 1, DrawId: "d", Team1: team("G"), Team2: team("H") }),
    ]);
    const next = left[1].matches[0].home;
    assert.equal(next.name, "A");
    assert.equal(next.played, false);
    assert.equal(next.score, 0);
  });

  test("a groups tournament shows the placeholder bracket before knockouts", () => {
    const { left, right } = buildBracket(
      tournament({
        TournamentMode: "GROUPS",
        AdvancePerGroup: 2,
        Groups: [{ GroupName: "A" }, { GroupName: "B" }],
      } as Partial<Tournament>),
      [],
    );
    const names = [...left, ...right].flatMap((c) =>
      c.matches.flatMap((m) => [m.home, m.away]),
    );
    assert.ok(names.some((s) => s.name === "A winner" && s.placeholder));
  });

  test("a lone final still gives the wings something to show", () => {
    const { left, final } = buildBracket(tournament(), [
      draw({ Stage: 1, Team1: team("A"), Team2: team("B"), Winner: "Team1", Played: true }),
    ]);
    assert.equal(left.length, 1);
    assert.equal(final?.champion?.name, "A");
  });

  test("a league is not a bracket", () => {
    for (const mode of ["LEAGUE", "BATTLEROYALE"] as const) {
      const out = buildBracket(tournament({ TournamentMode: mode }), [
        draw({ Stage: 1, Team1: team("A"), Team2: team("B") }),
      ]);
      assert.deepEqual(out, { left: [], right: [], final: null });
    }
  });

  test("leaves out group and battle-royale fixtures", () => {
    const { left, right } = buildBracket(tournament(), [
      draw({ Stage: 2, Group: "A", Team1: team("A"), Team2: team("B") }),
      draw({ Stage: 2, Team1: team("C"), Team2: team("D") }),
      draw({ Stage: 1, Team1: team("C"), Team2: team("E") }),
    ]);
    const names = [...left, ...right].flatMap((c) =>
      c.matches.map((m) => m.home.name),
    );
    assert.ok(!names.includes("A"), "group fixture must not appear");
    assert.ok(names.includes("C"));
  });
});

describe("buildGroups", () => {
  const draws = [
    draw({
      Stage: 1, Group: "A", Team1: team("A"), Team2: team("B"),
      Team1Score: 2, Team2Score: 0, Winner: "Team1", Played: true,
    }),
    draw({
      Stage: 1, Group: "B", Team1: team("C"), Team2: team("D"),
      Team1Score: 1, Team2Score: 1, Played: true,
    }),
  ];

  test("builds one table per group, in order", () => {
    const tables = buildGroups(tournament({ TournamentMode: "GROUPS" }), draws);
    assert.deepEqual(tables.map((t) => t.name), ["A", "B"]);
  });

  test("ranks a winner above the team it beat", () => {
    const [groupA] = buildGroups(tournament({ TournamentMode: "GROUPS" }), draws);
    assert.equal(groupA.rows[0].name, "A");
    assert.equal(groupA.rows[0].position, 1);
    // P W D L GD Pts
    assert.deepEqual(groupA.rows[0].cells, ["1", "1", "0", "0", "+2", "3"]);
  });

  test("shows a negative goal difference with its sign", () => {
    const [groupA] = buildGroups(tournament({ TournamentMode: "GROUPS" }), draws);
    assert.equal(groupA.rows[1].cells[4], "-2");
  });

  test("a draw leaves both teams on the same points", () => {
    const [, groupB] = buildGroups(tournament({ TournamentMode: "GROUPS" }), draws);
    assert.equal(groupB.rows[0].cells[5], "1");
    assert.equal(groupB.rows[1].cells[5], "1");
  });
});

describe("buildTeams", () => {
  test("lists teams with their players", () => {
    const teams = buildTeams([entry("Alpha", ["ana", "rui"]), entry("Beta")]);
    assert.deepEqual(
      teams.map((t) => ({ name: t.name, players: t.players.map((p) => p.name) })),
      [
        { name: "Alpha", players: ["ana", "rui"] },
        { name: "Beta", players: [] },
      ],
    );
    // Players carry the same crest the page resolves for them.
    assert.ok(teams[0].players[0].icon.startsWith("/api/icons/"));
  });

  test("skips entries with no team name", () => {
    assert.deepEqual(buildTeams([entry("  ")]), []);
  });
});

describe("buildChampions", () => {
  test("is empty until there is a winner", () => {
    assert.deepEqual(buildChampions(tournament(), [], []), []);
  });

  test("labels the places it can resolve", () => {
    const finished = tournament({ Winner: team("A") } as Partial<Tournament>);
    const places = buildChampions(finished, [], [entry("A")]);
    assert.equal(places[0]?.label, "Champion");
    assert.equal(places[0]?.name, "A");
  });
});

describe("availableExportViews", () => {
  test("offers nothing for an empty tournament", () => {
    assert.deepEqual(availableExportViews(tournament(), [], []), []);
  });

  test("offers only the views that would have content", () => {
    const views = availableExportViews(
      tournament(),
      [draw({ Stage: 1, Team1: team("A"), Team2: team("B") })],
      [entry("A"), entry("B")],
    );
    assert.deepEqual(views, ["bracket", "teams", "unplayed"]);
  });

  test("a groups tournament offers its group tables and the bracket ahead", () => {
    // The page shows the knockout bracket as placeholders before it is
    // drawn, so the download does too.
    const views = availableExportViews(
      tournament({ TournamentMode: "GROUPS" }),
      [draw({ Stage: 1, Group: "A", Team1: team("A"), Team2: team("B") })],
      [entry("A")],
    );
    assert.ok(views.includes("groups"));
    assert.ok(views.includes("bracket"));
  });

  test("buildExportModel returns null rather than an empty picture", () => {
    assert.equal(buildExportModel("bracket", tournament(), [], []), null);
    assert.equal(buildExportModel("teams", tournament(), [], []), null);
  });
});

describe("layoutExport", () => {
  const row = (i: number) => ({
    position: i,
    name: `Team ${i}`,
    cells: ["3", "2", "0", "1", "+4", "6"],
    icon: "",
  });
  const table = (count: number) => ({
    name: "Table",
    headers: ["P", "W", "D", "L", "GD", "Pts"],
    rows: Array.from({ length: count }, (_, i) => row(i + 1)),
  });

  test("a 20-team league keeps every team on one page", () => {
    // The bug: a fixed canvas showed ten and said nothing about the rest.
    const out = layoutExport({ kind: "tables", tables: [table(20)] });
    assert.equal(out.pages, 1);
    const shown = out.model.kind === "tables"
      ? out.model.tables.reduce((n, t) => n + t.rows.length, 0)
      : 0;
    assert.equal(shown, 20);
  });

  test("20 teams split into two blocks of ten, still landscape", () => {
    const out = layoutExport({ kind: "tables", tables: [table(20)] });
    assert.equal(out.model.kind === "tables" && out.model.tables.length, 2);
    assert.equal(out.height, EXPORT_MIN_HEIGHT);
    assert.ok(out.width > out.height, "must stay landscape");
  });

  test("a continuation block is labelled, and positions carry on", () => {
    const out = layoutExport({ kind: "tables", tables: [table(20)] });
    if (out.model.kind !== "tables") throw new Error("expected tables");
    const [first, second] = out.model.tables;
    assert.equal(first.name, "Table");
    assert.match(second.name, /cont\./);
    assert.equal(first.rows[0].position, 1);
    assert.equal(second.rows[0].position, 11);
  });

  test("a small table is left as one block at the minimum size", () => {
    const out = layoutExport({ kind: "tables", tables: [table(6)] });
    assert.equal(out.model.kind === "tables" && out.model.tables.length, 1);
    assert.equal(out.height, EXPORT_MIN_HEIGHT);
  });

  test("the canvas grows rather than dropping rows", () => {
    const small = layoutExport({ kind: "tables", tables: [table(20)] });
    const big = layoutExport({ kind: "tables", tables: [table(60)] });
    assert.ok(big.height > small.height, "taller table needs a taller canvas");
    assert.equal(big.pages, 1);
  });

  test("teams grow the canvas instead of stopping at twelve", () => {
    const teams = Array.from({ length: 24 }, (_, i) => ({
      name: `Team ${i + 1}`,
      players: [],
      icon: "",
    }));
    const out = layoutExport({ kind: "teams", teams });
    assert.equal(out.pages, 1);
    assert.equal(out.model.kind === "teams" && out.model.teams.length, 24);
    assert.ok(out.height > EXPORT_MIN_HEIGHT);
  });

  test("a wide bracket gets a wider canvas", () => {
    const columns = [8, 4, 2, 1].map((n) => ({
      label: `R${n}`,
      matches: Array.from({ length: n }, () => ({
        home: { name: "A", score: 0, won: false, icon: "" },
        away: { name: "B", score: 0, won: false, icon: "" },
        played: false,
        when: "",
      })),
    }));
    const out = layoutExport({ kind: "bracket", left: columns, right: [], final: null });
    assert.equal(out.pages, 1);
    assert.ok(out.width >= EXPORT_WIDTH);
    assert.ok(out.width > out.height, "must stay landscape");
  });

  test("a wide bracket zooms out onto one image rather than splitting", () => {
    // A bracket split across pictures stops being a bracket, so shrinking is
    // the better trade until the names stop being readable.
    const columns = Array.from({ length: 14 }, (_, i) => ({
      label: `R${i}`,
      matches: [
        {
          home: { name: `A${i}`, score: 0, won: false, icon: "" },
          away: { name: `B${i}`, score: 0, won: false, icon: "" },
          played: false,
          when: "",
        },
      ],
    }));
    const out = layoutExport({ kind: "bracket", left: columns, right: [], final: null });
    assert.equal(out.pages, 1, "should fit one image");
    assert.ok(out.scale < 1, "and it should be zoomed out to do so");
    assert.ok(out.scale >= 0.45, "but never below readable");
    assert.equal(
      out.model.kind === "bracket" ? out.model.left.length : 0,
      14,
      "every round present",
    );
  });

  test("a bracket too big even zoomed out still shows everything", () => {
    const deep = [128, 64, 32, 16, 8, 4, 2, 1].map((n, i) => ({
      label: `R${i}`,
      matches: Array.from({ length: n }, () => ({
        home: { name: "A", score: 0, won: false, icon: "" },
        away: { name: "B", score: 0, won: false, icon: "" },
        played: false,
        when: "",
      })),
    }));
    const pages = paginateExport({ kind: "bracket", left: deep, right: [], final: null });
    assert.ok(pages.length > 1, "too deep to zoom out alone");
    const matches = pages.reduce(
      (n, p) =>
        n +
        (p.model.kind === "bracket"
          ? [...p.model.left, ...p.model.right].reduce(
              (m, c) => m + c.matches.length,
              0,
            )
          : 0),
      0,
    );
    assert.equal(matches, 255, "every match still comes back");
    for (const page of pages) assert.ok(page.scale >= 0.45);
  });

  test("champions is a portrait poster, not a wide sheet", () => {
    // It holds a podium and a roster, so it reads tall and shares better that
    // way. Every other view stays landscape.
    const out = layoutExport({
      kind: "champions",
      places: [{ place: 1, label: "Champion", name: "A", players: [], icon: "" }],
    });
    assert.equal(out.width, CHAMPION_WIDTH);
    assert.ok(out.height >= out.width, "champions should be portrait or square");
    assert.equal(out.pages, 1);
  });

  test("a big champion roster makes the poster taller", () => {
    const players = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ name: `p${i}`, icon: "" }));
    const small = layoutExport({
      kind: "champions",
      places: [{ place: 1, label: "Champion", name: "A", players: players(2), icon: "" }],
    });
    const big = layoutExport({
      kind: "champions",
      places: [{ place: 1, label: "Champion", name: "A", players: players(12), icon: "" }],
    });
    assert.ok(big.height > small.height);
    assert.equal(big.pages, 1, "a roster never needs a second image");
  });
});

describe("paginateExport never drops anything", () => {
  const row = (i: number) => ({
    position: i,
    name: `Team ${i}`,
    cells: ["3", "2", "0", "1", "+4", "6"],
    icon: "",
  });
  const table = (count: number) => ({
    name: "Table",
    headers: ["P", "W", "D", "L", "GD", "Pts"],
    rows: Array.from({ length: count }, (_, i) => row(i + 1)),
  });

  function rowsAcross(pages: ReturnType<typeof paginateExport>): number {
    return pages.reduce(
      (total, page) =>
        total +
        (page.model.kind === "tables"
          ? page.model.tables.reduce((n, t) => n + t.rows.length, 0)
          : 0),
      0,
    );
  }

  test("40 teams all appear", () => {
    const pages = paginateExport({ kind: "tables", tables: [table(40)] });
    assert.equal(rowsAcross(pages), 40);
  });

  test("every league size from 1 to 260 keeps every single team", () => {
    // The guarantee: the canvas grows, then rolls onto more images, but the
    // count that goes in is always the count that comes out.
    for (const count of [1, 9, 10, 11, 20, 21, 40, 64, 100, 128, 256, 260]) {
      const pages = paginateExport({ kind: "tables", tables: [table(count)] });
      assert.equal(rowsAcross(pages), count, `${count} teams`);
      assert.ok(pages.length >= 1);
      for (const page of pages) {
        assert.ok(page.height <= 3600, `${count}: page too tall`);
        assert.ok(page.width <= 3200, `${count}: page too wide`);
      }
    }
  });

  test("positions stay in order across pages", () => {
    const pages = paginateExport({ kind: "tables", tables: [table(120)] });
    const positions = pages.flatMap((page) =>
      page.model.kind === "tables"
        ? page.model.tables.flatMap((t) => t.rows.map((r) => r.position))
        : [],
    );
    assert.deepEqual(positions, Array.from({ length: 120 }, (_, i) => i + 1));
  });

  test("every team-list size keeps every team", () => {
    for (const count of [1, 12, 13, 40, 96, 256]) {
      const teams = Array.from({ length: count }, (_, i) => ({
        name: `Team ${i + 1}`,
        players: [],
        icon: "",
      }));
      const pages = paginateExport({ kind: "teams", teams });
      const shown = pages.reduce(
        (n, p) => n + (p.model.kind === "teams" ? p.model.teams.length : 0),
        0,
      );
      assert.equal(shown, count, `${count} teams`);
    }
  });

  test("a 256-team bracket keeps all 255 matches", () => {
    // Eight rounds, 128 matches in the first: far past one image, and still
    // every match has to come back.
    const columns = [128, 64, 32, 16, 8, 4, 2, 1].map((n, i) => ({
      label: `R${i}`,
      matches: Array.from({ length: n }, () => ({
        home: { name: "A", score: 0, won: false, icon: "" },
        away: { name: "B", score: 0, won: false, icon: "" },
        played: false,
        when: "",
      })),
    }));
    const pages = paginateExport({ kind: "bracket", left: columns, right: [], final: null });
    const shown = pages.reduce(
      (n, p) =>
        n +
        (p.model.kind === "bracket"
          ? [...p.model.left, ...p.model.right].reduce(
              (m, c) => m + c.matches.length,
              0,
            )
          : 0),
      0,
    );
    assert.equal(shown, 255);
    assert.ok(pages.length > 1);
  });

  test("layoutExport clamps a page number that does not exist", () => {
    const model = { kind: "tables" as const, tables: [table(5)] };
    assert.equal(layoutExport(model, 0).page, 1);
    assert.equal(layoutExport(model, 99).page, 1);
    assert.equal(exportPageCount(model), 1);
  });
});

describe("viewForTeamsPanel", () => {
  const all = () => true;
  const only =
    (...views: string[]) =>
    (view: string) =>
      views.includes(view);

  test("the knockout panel downloads the bracket", () => {
    assert.equal(
      viewForTeamsPanel({
        panel: "bracket",
        isGroups: true,
        groupsCreated: true,
        available: all,
      }),
      "bracket",
    );
  });

  test("a drawn groups tournament downloads its group tables", () => {
    assert.equal(
      viewForTeamsPanel({
        panel: "teams",
        isGroups: true,
        groupsCreated: true,
        available: all,
      }),
      "groups",
    );
  });

  test("a groups tournament before its groups exist downloads the team list", () => {
    // This showed a list of teams with no download button at all, because it
    // asked for group tables that cannot exist yet.
    assert.equal(
      viewForTeamsPanel({
        panel: "teams",
        isGroups: true,
        groupsCreated: false,
        available: only("teams"),
      }),
      "teams",
    );
  });

  test("groups created but not yet drawn still offers the teams", () => {
    assert.equal(
      viewForTeamsPanel({
        panel: "teams",
        isGroups: true,
        groupsCreated: true,
        available: only("teams"),
      }),
      "teams",
    );
  });

  test("a knockout tournament downloads its teams", () => {
    assert.equal(
      viewForTeamsPanel({
        panel: "teams",
        isGroups: false,
        groupsCreated: false,
        available: all,
      }),
      "teams",
    );
  });

  test("offers nothing when there is nothing to draw", () => {
    assert.equal(
      viewForTeamsPanel({
        panel: "teams",
        isGroups: false,
        groupsCreated: false,
        available: () => false,
      }),
      null,
    );
    assert.equal(
      viewForTeamsPanel({
        panel: "bracket",
        isGroups: false,
        groupsCreated: false,
        available: only("teams"),
      }),
      null,
    );
  });
});

describe("buildUnplayed", () => {
  const played = draw({
    Stage: 2, Team1: team("A"), Team2: team("B"),
    Winner: "Team1", Played: true,
  });
  const pending = draw({ Stage: 1, Team1: team("A"), Team2: team("C") });

  test("lists only what is still to play", () => {
    const sections = buildUnplayed(tournament(), [played, pending]);
    const names = sections.flatMap((s) => s.matches.map((m) => m.home.name));
    assert.deepEqual(names, ["A"]);
    assert.equal(sections[0].matches[0].away.name, "C");
  });

  test("is empty once everything has been played", () => {
    assert.deepEqual(buildUnplayed(tournament(), [played]), []);
  });

  test("groups get their own heading", () => {
    const sections = buildUnplayed(tournament({ TournamentMode: "GROUPS" }), [
      draw({ Stage: 1, Group: "B", Team1: team("A"), Team2: team("B") }),
      draw({ Stage: 1, Group: "A", Team1: team("C"), Team2: team("D") }),
    ]);
    assert.deepEqual(sections.map((s) => s.label), ["A", "B"]);
  });

  test("carries the kick-off when the host set one", () => {
    const sections = buildUnplayed(tournament(), [
      draw({ Stage: 1, Team1: team("A"), Team2: team("B"), Date: "2026-09-20", Time: "15:00" }),
    ]);
    assert.match(sections[0].matches[0].when, /Sep/);
    assert.match(sections[0].matches[0].when, /15:00/);
  });
});

describe("buildMyMatches", () => {
  const mine = draw({
    DrawId: "d1", Stage: 1, Team1: team("A"), Team2: team("B"),
    Winner: "Team1", Played: true,
  });
  const upcoming = draw({ DrawId: "d2", Stage: 2, Team1: team("A"), Team2: team("C") });
  const other = draw({ DrawId: "d3", Stage: 1, Team1: team("X"), Team2: team("Y") });

  test("keeps played and unplayed, and only mine", () => {
    const sections = buildMyMatches(
      tournament(), [mine, upcoming, other], new Set(["d1", "d2"]),
    );
    const all = sections.flatMap((s) => s.matches);
    assert.equal(all.length, 2);
    assert.equal(all.filter((m) => m.played).length, 1);
    assert.ok(!all.some((m) => m.home.name === "X"));
  });

  test("newest round first", () => {
    // The match coming up matters more than the one already played.
    const sections = buildMyMatches(
      tournament(), [mine, upcoming], new Set(["d1", "d2"]),
    );
    assert.equal(sections[0].matches[0].away.name, "C", "stage 2 leads");
  });

  test("is empty when none are yours", () => {
    assert.deepEqual(buildMyMatches(tournament(), [other], new Set()), []);
  });
});
