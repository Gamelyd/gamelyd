import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { forkSegments, layoutWing, teamRoute } from "@/lib/bracketModel";

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
