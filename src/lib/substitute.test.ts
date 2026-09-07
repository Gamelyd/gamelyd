import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  hasUnplayedFixtures,
  planSubstitution,
  substituteInGroups,
  substitutedDraw,
} from "@/lib/substitute";
import type { Draw, Teams } from "@/lib/schemas/draw";
import type { TournamentGroup } from "@/lib/schemas/tournament";

const team = (TeamName: string) =>
  ({ TeamName, Players: [], Icon: "" }) as unknown as Teams;

function draw(o: Partial<Draw> & { DrawId: string }): Draw {
  return {
    Stage: 1, Group: "", Kind: "", BRTeams: [],
    Team1Score: 0, Team2Score: 0, Winner: "", Played: false,
    ...o,
  } as Draw;
}

describe("planSubstitution", () => {
  const draws = [
    draw({ DrawId: "d1", Team1: team("Ghost"), Team2: team("B"), Played: true, Winner: "Team1" }),
    draw({ DrawId: "d2", Team1: team("C"), Team2: team("Ghost") }),
    draw({ DrawId: "d3", Team1: team("D"), Team2: team("E") }),
  ];

  test("takes over every fixture still to be played", () => {
    const { swaps } = planSubstitution(draws, "Ghost");
    assert.deepEqual(swaps, [{ drawId: "d2", side: "Team2" }]);
  });

  test("leaves played matches as they happened", () => {
    // Rewriting a finished match would show a team winning a game it never
    // played, so the record keeps the team that actually played it.
    const { playedLeftAlone } = planSubstitution(draws, "Ghost");
    assert.equal(playedLeftAlone, 1);
  });

  test("matches the team name whatever its casing or spacing", () => {
    const { swaps } = planSubstitution(draws, "  ghost ");
    assert.equal(swaps.length, 1);
  });

  test("a team with nothing left to play has nothing to swap", () => {
    assert.deepEqual(planSubstitution(draws, "B").swaps, []);
    assert.equal(hasUnplayedFixtures(draws, "B"), false);
    assert.equal(hasUnplayedFixtures(draws, "Ghost"), true);
  });

  test("a team not in the tournament changes nothing", () => {
    assert.deepEqual(planSubstitution(draws, "Nobody"), {
      swaps: [],
      playedLeftAlone: 0,
    });
  });
});

describe("substitutedDraw", () => {
  test("puts the replacement in the slot", () => {
    const d = draw({ DrawId: "d1", Team1: team("Ghost"), Team2: team("B") });
    const patch = substitutedDraw(d, "Team1", team("Sub"));
    assert.equal((patch.Team1 as Teams).TeamName, "Sub");
    assert.equal(patch.Team2, undefined, "the other side is untouched");
  });

  test("does not hand over a win the replacement never earned", () => {
    // A walkover recorded against the slot must not follow the new team in.
    const d = draw({ DrawId: "d1", Team1: team("Ghost"), Team2: team("B"), Winner: "Team1" });
    assert.equal(substitutedDraw(d, "Team1", team("Sub")).Winner, "");
  });

  test("leaves a win that belongs to the other side", () => {
    const d = draw({ DrawId: "d1", Team1: team("Ghost"), Team2: team("B"), Winner: "Team2" });
    assert.equal(substitutedDraw(d, "Team1", team("Sub")).Winner, undefined);
  });
});

describe("substituteInGroups", () => {
  const groups = [
    { GroupName: "A", Teams: [team("Ghost"), team("B")] },
    { GroupName: "B", Teams: [team("C")] },
  ] as TournamentGroup[];

  test("swaps the team in its own group only", () => {
    const out = substituteInGroups(groups, "Ghost", team("Sub"));
    assert.deepEqual(out[0].Teams.map((t) => t.TeamName), ["Sub", "B"]);
    assert.deepEqual(out[1].Teams.map((t) => t.TeamName), ["C"]);
  });

  test("leaves the groups alone when the team is not in them", () => {
    const out = substituteInGroups(groups, "Nobody", team("Sub"));
    assert.deepEqual(out, groups);
  });

  test("copes with a group that has no teams yet", () => {
    const empty = [{ GroupName: "A" }] as unknown as TournamentGroup[];
    assert.deepEqual(substituteInGroups(empty, "Ghost", team("Sub")), [
      { GroupName: "A", Teams: [] },
    ]);
  });
});
