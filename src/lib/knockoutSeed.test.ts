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

  test("an even number of groups gets the classic World Cup pairing", () => {
    // Groups link two by two: A with B, C with D.
    const pairs = pairsOf("1A", "1B", "1C", "1D", "2A", "2B", "2C", "2D");
    assert.deepEqual(pairs, ["1A-2B", "1B-2A", "1C-2D", "1D-2C"]);
    noSameGroup(pairs);
  });

  test("an odd number rotates the last three instead of pairing one alone", () => {
    // Five groups: A/B pair up as usual, then C, D and E go round in a ring.
    // The old code paired the leftover group with itself -- 1E v 2E.
    const pairs = pairsOf(
      "1A", "1B", "1C", "1D", "1E", "2A", "2B", "2C", "2D", "2E",
    );
    assert.deepEqual(pairs, [
      "1A-2B", "1B-2A", "1C-2D", "1D-2E", "1E-2C",
    ]);
    noSameGroup(pairs);
  });

  test("three groups are all rotation, no pairs at all", () => {
    assert.deepEqual(pairsOf("1A", "1B", "1C", "2A", "2B", "2C"), [
      "1A-2B", "1B-2C", "1C-2A",
    ]);
  });

  test("seven groups: two normal pairs then a ring", () => {
    const codes: string[] = [];
    for (const p of [1, 2]) {
      for (const g of ["A", "B", "C", "D", "E", "F", "G"]) codes.push(`${p}${g}`);
    }
    const pairs = pairsOf(...codes);
    assert.equal(pairs.length, 7);
    assert.deepEqual(pairs.slice(0, 4), ["1A-2B", "1B-2A", "1C-2D", "1D-2C"]);
    assert.deepEqual(pairs.slice(4), ["1E-2F", "1F-2G", "1G-2E"]);
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

  test("three qualifying from two groups still avoids a clash", () => {
    const pairs = pairsOf("1A", "1B", "2A", "2B", "3A", "3B");
    noSameGroup(pairs);
    assert.equal(pairs.length, 3);
  });

  test("once best losers fill in, seeding takes over from the pairing", () => {
    // Three through per group has no partner structure, so it falls back to
    // strongest against weakest -- and still avoids a same-group tie.
    const codes: string[] = [];
    for (const p of [1, 2, 3]) {
      for (const g of ["A", "B", "C", "D"]) codes.push(`${p}${g}`);
    }
    const pairs = pairsOf(...codes);
    // Group winners lead their ties and never meet each other.
    assert.ok(pairs.every((pair) => pair.startsWith("1") || pair.startsWith("2")));
    assert.deepEqual(
      pairs.filter((pair) => {
        const [a, b] = pair.split("-");
        return a[0] === b[0];
      }),
      [],
      "nobody meets a team that finished where they did",
    );
    noSameGroup(pairs);
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

describe("clashes when best losers fill the bracket", () => {
  /** `2B` = runner-up of group B. Best losers keep their real finishing place. */
  function config(groups: number, advance: number, fillers: number) {
    const letters = "ABCDEFGH".split("");
    const codes: string[] = [];
    for (let p = 1; p <= advance; p += 1) {
      for (let g = 0; g < groups; g += 1) codes.push(`${p}${letters[g]}`);
    }
    for (let i = 0; i < fillers; i += 1) {
      codes.push(`${advance + 1}${letters[i]}`);
    }
    return seedKnockoutPairs(entries(...codes));
  }

  function faults(pairs: [string, string | undefined][]) {
    const sameGroup = pairs.filter(([a, b]) => b && a.slice(1) === b.slice(1));
    const samePlace = pairs.filter(([a, b]) => b && a[0] === b[0]);
    return { sameGroup, samePlace };
  }

  test("two runners-up never meet in the first round", () => {
    // Six groups with the top two plus four best thirds seeded out as
    // 2A v 2D and 2B v 2C, even though a clash-free pairing exists.
    const { sameGroup, samePlace } = faults(config(6, 2, 4));
    assert.deepEqual(samePlace, []);
    assert.deepEqual(sameGroup, []);
  });

  test("nor in the smaller fill cases", () => {
    for (const [groups, advance, fill] of [
      [3, 2, 2],
      [5, 2, 6],
      [4, 3, 4],
    ]) {
      const { sameGroup, samePlace } = faults(config(groups, advance, fill));
      assert.deepEqual(samePlace, [], `${groups}/${advance}/${fill} same place`);
      assert.deepEqual(sameGroup, [], `${groups}/${advance}/${fill} same group`);
    }
  });

  test("across every realistic shape, nobody meets their own kind", () => {
    for (let groups = 2; groups <= 8; groups += 1) {
      for (let advance = 2; advance <= 4; advance += 1) {
        for (let fill = 0; fill <= groups; fill += 1) {
          const pairs = config(groups, advance, fill);
          const { sameGroup, samePlace } = faults(pairs);
          const where = `${groups} groups, top ${advance}, +${fill}`;
          assert.equal(sameGroup.length, 0, `${where}: same group`);
          assert.equal(samePlace.length, 0, `${where}: same place`);

          // And nothing is lost or duplicated while swapping opponents around.
          const named = pairs.flatMap(([a, b]) => (b ? [a, b] : [a]));
          assert.equal(new Set(named).size, named.length, `${where}: duplicate`);
        }
      }
    }
  });

  test("the better-placed team is listed first", () => {
    for (const [a, b] of config(3, 2, 2)) {
      if (!b) continue;
      assert.ok(Number(a[0]) <= Number(b[0]), `${a} should not trail ${b}`);
    }
  });
});
