import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildBracketModel,
  forkSegments,
  knockoutRoundLabels,
  readyMatches,
  staleSeries,
  layoutWing,
  teamRoute,
} from "@/lib/bracketModel";
import type { Draw, Teams } from "@/lib/schemas/draw";
import { knockoutRoundsForBracket } from "@/lib/knockoutSeries";

const cols = (...counts: number[]) => counts.map((n) => ({ length: n }));

describe("layoutWing", () => {
  test("an even wing spaces cards the usual way", () => {
    const { units, centres } = layoutWing(cols(4, 2, 1));
    assert.equal(units, 4);
    assert.deepEqual(centres, [[0.5, 1.5, 2.5, 3.5], [1, 3], [2]]);
  });

  test("an odd wing puts each card between the matches feeding it", () => {
    // 3 matches, then a pair plus a bye, then one card.
    const { centres } = layoutWing(cols(3, 2, 1));
    const [first, second, third] = centres;
    assert.equal(second[0], (first[0] + first[1]) / 2, "pair meets in the middle");
    assert.equal(second[1], first[2], "a bye stays level with its match");
    assert.equal(third[0], (second[0] + second[1]) / 2);
  });

  test("an odd wing is padded so its last card is level with the trophy", () => {
    const { units, centres } = layoutWing(cols(3, 2, 1));
    assert.equal(centres[2][0], units / 2);
  });
});

describe("forkSegments", () => {
  test("pieces add up to the wing height and the arrow sits on the midpoint", () => {
    const centres = [0.5, 1.5, 2.5];
    const segs = forkSegments(centres, 3);
    const total = segs.reduce((sum, s) => sum + ("grow" in s ? s.grow : 0), 0);
    assert.equal(total, 3);
    let at = 0;
    const arrows: number[] = [];
    for (const s of segs) {
      if (s.kind === "arrow") arrows.push(at);
      else at += s.grow;
    }
    assert.deepEqual(arrows, [1, 2.5]);
  });
});

describe("teamRoute", () => {
  const slot = (name?: string, won = false) => ({
    team: name ? ({ TeamName: name } as never) : undefined,
    score: 0,
    played: won,
    won,
  });
  const node = (a?: string, b?: string, winner?: 1 | 2) => ({
    draw: null,
    team1: slot(a, winner === 1),
    team2: slot(b, winner === 2),
  });

  test("a team still in follows the bracket's shape to the trophy", () => {
    const cols = [
      [node("A", "B", 1), node("C", "D"), node("E", "F"), node("G", "H")],
      [node("A"), node()],
      [node()],
    ];
    const route = teamRoute(cols, "a");
    assert.equal(route?.outAt, null);
    assert.deepEqual(
      route?.steps.map((s) => s && [s.index, s.row, s.continues]),
      [
        [0, "team1", true],
        [0, "team1", true],
        [0, "team1", true],
      ],
    );
  });

  test("a team from the lower match takes the bottom row next round", () => {
    const cols = [[node("A", "B"), node("C", "D", 2)], [node(undefined, "D")]];
    const route = teamRoute(cols, "D");
    assert.equal(route?.steps[0]?.row, "team2");
    assert.equal(route?.steps[1]?.row, "team2");
  });

  test("a knocked-out team's road stops where it lost", () => {
    const cols = [[node("A", "B", 1), node("C", "D")], [node("A")]];
    const route = teamRoute(cols, "B");
    assert.equal(route?.outAt, 0);
    assert.equal(route?.steps[0]?.continues, false);
    assert.equal(route?.steps[1], undefined);
  });

  test("a team not in this wing has no route", () => {
    assert.equal(teamRoute([[node("A", "B")]], "Z"), null);
  });
});

describe("buildBracketModel", () => {
  const team = (TeamName: string) => ({ TeamName }) as unknown as Teams;
  const draw = (o: Partial<Draw>) =>
    ({
      Stage: 1,
      Group: "",
      Kind: "",
      BRTeams: [],
      Team1Score: 0,
      Team2Score: 0,
      Winner: "",
      Played: false,
      ...o,
    }) as Draw;

  test("a winner of a drawn round shows up in the round after it", () => {
    // The round after a drawn one is predicted, so it has to read the real
    // result rather than the prediction the drawn round replaced.
    const model = buildBracketModel({
      knockoutLive: true,
      rounds: [
        {
          stage: 1,
          matches: [
            draw({ DrawId: "a", Team1: team("A"), Team2: team("B"), Team1Score: 2, Played: true, Winner: "Team1" }),
            draw({ DrawId: "b", Team1: team("C"), Team2: team("D"), Team2Score: 2, Played: true, Winner: "Team2" }),
            draw({ DrawId: "c", Team1: team("E"), Team2: team("F"), Team1Score: 2, Played: true, Winner: "Team1" }),
            draw({ DrawId: "d", Team1: team("G"), Team2: team("H"), Team1Score: 2, Played: true, Winner: "Team1" }),
          ],
        },
        {
          stage: 2,
          matches: [
            draw({ Stage: 2, DrawId: "e", Team1: team("A"), Team2: team("D"), Team2Score: 5, Played: true, Winner: "Team2" }),
            draw({ Stage: 2, DrawId: "f", Team1: team("E"), Team2: team("G") }),
          ],
        },
      ],
    });
    // Left wing: the drawn semi-final, then the final slot it feeds.
    assert.equal(model.leftCols[1][0].team1.team?.TeamName, "A");
    assert.equal(model.leftCols[1][0].team2.team?.TeamName, "D");
    assert.equal(model.finalDraw, null);
    const route = teamRoute(model.leftCols, "D");
    assert.equal(route?.outAt, null, "D won its semi-final, so it goes on");
  });
});

describe("knockoutRoundLabels", () => {
  const team = (TeamName: string) => ({ TeamName }) as unknown as Teams;
  const d = (o: Partial<Draw>) =>
    ({
      Stage: 1,
      Group: "",
      Kind: "",
      BRTeams: [],
      Team1Score: 0,
      Team2Score: 0,
      Winner: "",
      Played: false,
      ...o,
    }) as Draw;

  test("names a tie by its distance from the final, not by its stage", () => {
    // An uneven bracket drawn the old way: five first-round ties, so one half
    // reaches the final a round before the other. Stage 2 then holds a
    // semi-final (the short half) beside quarter-finals.
    const stage1 = [
      ["zinkop", "Mauytr"],
      ["mutiu", "Death Angel"],
      ["kamsi", "loi"],
      ["Mehul Lad", "yeeser"],
      ["manana", "Stan"],
    ].map(([a, b], i) =>
      d({ DrawId: `s1-${i}`, SeriesId: `s1-${i}`, Team1: team(a), Team2: team(b), Team1Score: 2, Played: true, Winner: "Team1" }),
    );
    const stage2 = [
      d({ Stage: 2, DrawId: "a", SeriesId: "a", Team1: team("zinkop"), Team2: team("mutiu") }),
      d({ Stage: 2, DrawId: "b", SeriesId: "b", Team1: team("kamsi"), Team2: team("Mehul Lad") }),
      d({ Stage: 2, DrawId: "c", SeriesId: "c", Team1: team("manana") }),
    ];
    const labels = knockoutRoundLabels([...stage1, ...stage2]);
    assert.equal(labels.get("a"), "Semi-finals", "its winner goes to the final");
    assert.equal(labels.get("b"), "Quarter-finals");
  });
});

describe("readyMatches", () => {
  const team = (TeamName: string) => ({ TeamName }) as unknown as Teams;
  const mk = (o: Partial<Draw>) =>
    ({
      Stage: 1,
      Group: "",
      Kind: "",
      BRTeams: [],
      Team1Score: 0,
      Team2Score: 0,
      Winner: "",
      Played: false,
      ...o,
    }) as Draw;
  const tie = (id: string, a: string, b: string, won?: 1 | 2, stage = 1) =>
    mk({
      Stage: stage,
      DrawId: id,
      SeriesId: id,
      Team1: team(a),
      Team2: team(b),
      Played: Boolean(won),
      Winner: won === 1 ? "Team1" : won === 2 ? "Team2" : "",
    });
  const model = (draws: Draw[]) =>
    buildBracketModel({
      rounds: knockoutRoundsForBracket(draws, undefined),
      knockoutLive: true,
    });

  test("draws a match as soon as both ties feeding it are settled", () => {
    // Ten teams: four on one side, six on the other. The short side's two
    // ties are done, the long side's are not -- its next match is still ready.
    const draws = [
      tie("l1", "A", "B", 1),
      tie("l2", "C", "D", 2),
      tie("r1", "E", "F"),
      tie("r2", "G", "H"),
      tie("r3", "I", "J"),
    ];
    const ready = readyMatches(model(draws));
    assert.equal(ready.length, 1);
    assert.equal(ready[0].team1.TeamName, "A");
    assert.equal(ready[0].team2?.TeamName, "D");
    assert.equal(ready[0].stage, 2);
  });

  test("waits when only one of the two feeding ties is settled", () => {
    const draws = [
      tie("l1", "A", "B", 1),
      tie("l2", "C", "D"),
      tie("r1", "E", "F"),
      tie("r2", "G", "H"),
      tie("r3", "I", "J"),
    ];
    assert.deepEqual(readyMatches(model(draws)), []);
  });

  test("draws nothing twice: a match already drawn is left alone", () => {
    const draws = [
      tie("l1", "A", "B", 1),
      tie("l2", "C", "D", 2),
      tie("r1", "E", "F"),
      tie("r2", "G", "H"),
      tie("r3", "I", "J"),
      tie("l3", "A", "D", undefined, 2),
    ];
    assert.deepEqual(readyMatches(model(draws)), []);
  });

  test("the same match keeps the same identity, so it cannot be drawn twice", () => {
    const draws = [
      tie("l1", "A", "B", 1),
      tie("l2", "C", "D", 2),
      tie("r1", "E", "F"),
      tie("r2", "G", "H"),
      tie("r3", "I", "J"),
    ];
    assert.equal(readyMatches(model(draws))[0].seed, readyMatches(model(draws))[0].seed);
  });

  test("a bye needs only the tie that feeds it", () => {
    // Three ties on a side: two meet, the third goes through on its own.
    // The first two ties listed form one half, the rest the other.
    const draws = [
      tie("l1", "A", "B"),
      tie("l2", "C", "D"),
      tie("r1", "E", "F", 1),
      tie("r2", "G", "H", 1),
      tie("r3", "I", "J", 2),
    ];
    const ready = readyMatches(model(draws));
    const bye = ready.find((m) => !m.team2);
    assert.equal(bye?.team1.TeamName, "J");
  });

  test("the final is drawn once each half has a finalist", () => {
    const draws = [
      tie("l1", "A", "B", 1),
      tie("l2", "C", "D", 2),
      tie("l3", "A", "D", 1, 2),
      tie("r1", "E", "F", 1),
      tie("r2", "G", "H", 1),
      tie("r3", "E", "G", 1, 2),
    ];
    const ready = readyMatches(model(draws));
    assert.equal(ready.length, 1);
    assert.equal(ready[0].kind, "FINAL");
    assert.deepEqual(
      [ready[0].team1.TeamName, ready[0].team2?.TeamName].sort(),
      ["A", "E"],
    );
  });

  test("a disqualified team's place is left open", () => {
    const draws = [
      tie("l1", "A", "B", 1),
      tie("l2", "C", "D", 2),
      tie("r1", "E", "F"),
      tie("r2", "G", "H"),
      tie("r3", "I", "J"),
    ];
    const ready = readyMatches(model(draws), { excluded: new Set(["D"]) });
    assert.deepEqual(ready, [], "the match waits rather than drawing one team");
  });
});

describe("staleSeries", () => {
  const team = (TeamName: string) => ({ TeamName }) as unknown as Teams;
  const mk = (o: Partial<Draw>) =>
    ({
      Stage: 1,
      Group: "",
      Kind: "",
      BRTeams: [],
      Team1Score: 0,
      Team2Score: 0,
      Winner: "",
      Played: false,
      ...o,
    }) as Draw;
  const tie = (id: string, a: string, b: string, won?: 1 | 2, stage = 1) =>
    mk({
      Stage: stage,
      DrawId: id,
      SeriesId: id,
      Team1: team(a),
      Team2: team(b),
      Played: Boolean(won),
      Winner: won === 1 ? "Team1" : won === 2 ? "Team2" : "",
    });
  const model = (draws: Draw[]) =>
    buildBracketModel({
      rounds: knockoutRoundsForBracket(draws, undefined),
      knockoutLive: true,
    });

  test("nothing is stale while the next round holds the right teams", () => {
    const draws = [
      tie("l1", "A", "B", 1),
      tie("l2", "C", "D", 2),
      tie("r1", "E", "F", 1),
      tie("r2", "G", "H", 1),
      tie("next", "A", "D", undefined, 2),
    ];
    assert.equal(staleSeries(model(draws)).size, 0);
  });

  test("a corrected result makes the match drawn from it stale", () => {
    // B won after the correction, so the next match still holding A is wrong.
    const draws = [
      tie("l1", "A", "B", 2),
      tie("l2", "C", "D", 2),
      tie("r1", "E", "F", 1),
      tie("r2", "G", "H", 1),
      tie("next", "A", "D", undefined, 2),
    ];
    assert.deepEqual([...staleSeries(model(draws))], ["next"]);
  });

  test("a changed score that keeps the same winner changes nothing", () => {
    const draws = [
      tie("l1", "A", "B", 1),
      tie("l2", "C", "D", 2),
      tie("r1", "E", "F", 1),
      tie("r2", "G", "H", 1),
      mk({ ...tie("next", "A", "D", undefined, 2) }),
    ];
    assert.equal(staleSeries(model(draws)).size, 0);
  });

  test("a final left holding a team that no longer got there is stale", () => {
    const draws = [
      tie("l1", "A", "B", 1),
      tie("l2", "C", "D", 2),
      tie("ls", "A", "D", 1, 2),
      tie("r1", "E", "F", 1),
      tie("r2", "G", "H", 1),
      tie("rs", "E", "G", 2, 2),
      tie("final", "A", "E", undefined, 3),
    ];
    // The right semi now sends G, not E.
    assert.deepEqual([...staleSeries(model(draws))], ["final"]);
  });
});
