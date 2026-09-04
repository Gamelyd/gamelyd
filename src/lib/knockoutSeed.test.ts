import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  groupPlaceholderPairs,
  seedKnockoutPairs,
  type SeedEntry,
} from "@/lib/knockoutSeed";

/** `2B` means the runner-up of group B. */
function entries(...codes: string[]): SeedEntry<string>[] {
  return codes.map((code) => ({
    value: code,
    position: Number(code[0]),
    group: code.slice(1),
  }));
}

function pairsOf(...codes: string[]): string[] {
  return seedKnockoutPairs(entries(...codes)).map(
    ([a, b]) => `${a}-${b ?? "bye"}`,
  );
}

function noSameGroup(pairs: string[]): void {
  for (const pair of pairs) {
    const [a, b] = pair.split("-");
    if (b === "bye") continue;
    assert.notEqual(a.slice(1), b.slice(1), `${pair} is an all-${a.slice(1)} tie`);
  }
}

describe("seedKnockoutPairs", () => {
  test("two per group crosses them, World Cup style", () => {
    const pairs = pairsOf("1A", "1B", "2A", "2B");
    assert.deepEqual(pairs, ["1A-2B", "1B-2A"]);
  });

  test("four groups: winners meet another group's runner-up", () => {
    const pairs = pairsOf("1A", "1B", "1C", "1D", "2A", "2B", "2C", "2D");
    assert.deepEqual(pairs, ["1A-2D", "1B-2C", "1C-2B", "1D-2A"]);
    noSameGroup(pairs);
  });

  test("never puts two group winners together in round one", () => {
    // The old code fell back to pairing the flat list whenever the count was
    // anything but two per group, which sent half the winners home at once.
    // Not one-per-group: there every qualifier is a winner, so winner v winner
    // is the only thing possible.
    for (const advance of [2, 3, 4]) {
      const codes: string[] = [];
      for (let p = 1; p <= advance; p += 1) {
        for (const g of ["A", "B", "C", "D"]) codes.push(`${p}${g}`);
      }
      const pairs = pairsOf(...codes);
      const winnerVsWinner = pairs.filter((pair) => {
        const [a, b] = pair.split("-");
        return a.startsWith("1") && b.startsWith("1");
      });
      assert.deepEqual(winnerVsWinner, [], `advance=${advance}`);
      noSameGroup(pairs);
    }
  });

  test("three groups of two avoid the same-group clash", () => {
    // Straight seeding would give 1B v 2B here.
    const pairs = pairsOf("1A", "1B", "1C", "2A", "2B", "2C");
    noSameGroup(pairs);
    assert.equal(pairs.length, 3);
  });

  test("three qualifying from two groups still avoids a clash", () => {
    const pairs = pairsOf("1A", "1B", "2A", "2B", "3A", "3B");
    noSameGroup(pairs);
    assert.equal(pairs.length, 3);
  });

  test("the best team plays the weakest qualifier", () => {
    const pairs = pairsOf("1A", "1B", "1C", "1D", "2A", "2B", "2C", "2D");
    assert.equal(pairs[0], "1A-2D");
  });

  test("an odd number of qualifiers leaves one bye, not a dropped team", () => {
    const pairs = pairsOf("1A", "1B", "1C", "2A", "2B");
    assert.equal(pairs.length, 3);
    assert.equal(pairs.filter((p) => p.endsWith("-bye")).length, 1);
    const named = pairs.join("-").split("-").filter((n) => n !== "bye");
    assert.equal(new Set(named).size, 5, "every qualifier appears exactly once");
  });

  test("keeps every team and never repeats one", () => {
    const codes = ["1A", "1B", "1C", "1D", "2A", "2B", "2C", "2D"];
    const named = pairsOf(...codes).join("-").split("-");
    assert.deepEqual([...named].sort(), [...codes].sort());
  });

  test("copes with a single qualifier", () => {
    assert.deepEqual(pairsOf("1A"), ["1A-bye"]);
    assert.deepEqual(seedKnockoutPairs([]), []);
  });

  test("one per group pairs the winners, since that is all there is", () => {
    const pairs = pairsOf("1A", "1B", "1C", "1D");
    assert.equal(pairs.length, 2);
    noSameGroup(pairs);
  });
});

describe("groupPlaceholderPairs", () => {
  test("labels the bracket before anyone has played", () => {
    const pairs = groupPlaceholderPairs(["Group A", "Group B"], 2).map(
      ([a, b]) => `${a} / ${b}`,
    );
    assert.deepEqual(pairs, [
      "Group A winner / Group B runner-up",
      "Group B winner / Group A runner-up",
    ]);
  });

  test("placeholders cross groups at three per group too", () => {
    const pairs = groupPlaceholderPairs(["A", "B", "C", "D"], 3);
    for (const [a, b] of pairs) {
      if (!b) continue;
      assert.notEqual(a.split(" ")[0], b.split(" ")[0]);
    }
  });
});
