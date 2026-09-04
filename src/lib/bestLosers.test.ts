import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  bestLosers,
  losersFromGroup,
  nextPowerOfTwo,
  rankLosers,
  slotsToFill,
  type LoserCandidate,
} from "@/lib/bestLosers";
import type { LeagueStanding } from "@/lib/leagueStandings";

function candidate(
  teamName: string,
  position: number,
  points: number,
  goalDifference = 0,
  goalsFor = 0,
): LoserCandidate {
  return { group: teamName[0], teamName, position, points, goalDifference, goalsFor };
}

describe("slotsToFill", () => {
  test("a clean bracket needs nothing", () => {
    for (const n of [2, 4, 8, 16, 32]) assert.equal(slotsToFill(n), 0);
  });

  test("twelve qualifiers need four more to reach sixteen", () => {
    assert.equal(slotsToFill(12), 4);
  });

  test("ten qualifiers need six", () => {
    // The 20-team case: four groups, ten through, six short of sixteen.
    assert.equal(slotsToFill(10), 6);
  });

  test("six need two", () => {
    assert.equal(slotsToFill(6), 2);
  });

  test("nothing to build below two teams", () => {
    assert.equal(slotsToFill(0), 0);
    assert.equal(slotsToFill(1), 0);
  });

  test("nextPowerOfTwo", () => {
    assert.equal(nextPowerOfTwo(1), 1);
    assert.equal(nextPowerOfTwo(5), 8);
    assert.equal(nextPowerOfTwo(8), 8);
    assert.equal(nextPowerOfTwo(9), 16);
  });
});

describe("rankLosers", () => {
  test("every third-placed team outranks every fourth", () => {
    // This is what makes it "best third-placed teams" rather than "best of the
    // rest": a third on 1 point still goes ahead of a fourth on 9.
    const ranked = rankLosers([
      candidate("Delta", 4, 9, 20, 30),
      candidate("Alpha", 3, 1, -8, 2),
    ]);
    assert.deepEqual(ranked.map((r) => r.teamName), ["Alpha", "Delta"]);
  });

  test("within a place, points then goal difference then goals for", () => {
    const ranked = rankLosers([
      candidate("Cee", 3, 4, 1, 5),
      candidate("Aye", 3, 7, 0, 1),
      candidate("Bee", 3, 4, 3, 1),
      candidate("Dee", 3, 4, 1, 9),
    ]);
    assert.deepEqual(ranked.map((r) => r.teamName), ["Aye", "Bee", "Dee", "Cee"]);
  });

  test("a complete tie still gives a stable order", () => {
    const twice = () =>
      rankLosers([candidate("Zed", 3, 3), candidate("Ann", 3, 3)]).map(
        (r) => r.teamName,
      );
    assert.deepEqual(twice(), ["Ann", "Zed"]);
    assert.deepEqual(twice(), twice());
  });
});

describe("bestLosers", () => {
  const pool = [
    candidate("Aye", 3, 7),
    candidate("Bee", 3, 5),
    candidate("Cee", 3, 2),
    candidate("Dee", 4, 9),
  ];

  test("takes only what the bracket is short of", () => {
    assert.deepEqual(bestLosers(pool, 2).map((r) => r.teamName), ["Aye", "Bee"]);
  });

  test("asking for none takes none", () => {
    assert.deepEqual(bestLosers(pool, 0), []);
    assert.deepEqual(bestLosers(pool, -1), []);
  });

  test("asking for more than exist takes everyone", () => {
    assert.equal(bestLosers(pool, 99).length, 4);
  });
});

describe("losersFromGroup", () => {
  const standings = [
    { TeamName: "One", Points: 9, GoalDifference: 5, GoalsFor: 7 },
    { TeamName: "Two", Points: 6, GoalDifference: 2, GoalsFor: 5 },
    { TeamName: "Three", Points: 3, GoalDifference: -1, GoalsFor: 3 },
    { TeamName: "Four", Points: 0, GoalDifference: -6, GoalsFor: 1 },
  ] as LeagueStanding[];

  test("returns whoever did not go through, with their real place", () => {
    const out = losersFromGroup("A", standings, new Set(["One", "Two"]));
    assert.deepEqual(
      out.map((r) => [r.teamName, r.position]),
      [["Three", 3], ["Four", 4]],
    );
  });

  test("a team the host picked on a tie is never offered again", () => {
    const out = losersFromGroup("A", standings, new Set(["One", "Three"]));
    assert.deepEqual(out.map((r) => r.teamName), ["Two", "Four"]);
    // Two finished second, and keeps that place when ranked against other groups.
    assert.equal(out[0].position, 2);
  });

  test("carries the group through so seeding can avoid a rematch", () => {
    const out = losersFromGroup("Group B", standings, new Set());
    assert.ok(out.every((r) => r.group === "Group B"));
  });
});
