import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { forkSegments, layoutWing } from "@/lib/bracketModel";

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
