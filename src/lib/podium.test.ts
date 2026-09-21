import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolvePodium } from "@/lib/podium";
import type { Draw, Teams } from "@/lib/schemas/draw";
import type { Tournament } from "@/lib/schemas/tournament";
import type { RegisterTournament } from "@/lib/schemas/register";

const team = (TeamName: string) => ({ TeamName, Players: [] }) as unknown as Teams;
const tournament = (overrides: Partial<Tournament> = {}) =>
  ({ TournamentMode: "MULTIPLAYER", ...overrides }) as Tournament;
const entrants: RegisterTournament[] = [];
const tie = (id: string, a: string, b: string, won: 1 | 2 | 0, stage: number) =>
  ({
    Stage: stage,
    Group: "",
    Kind: "",
    BRTeams: [],
    DrawId: id,
    SeriesId: id,
    Team1: team(a),
    Team2: team(b),
    Team1Score: won === 1 ? 2 : 0,
    Team2Score: won === 2 ? 2 : 0,
    Winner: won === 1 ? "Team1" : won === 2 ? "Team2" : "",
    Played: won !== 0,
  }) as Draw;

describe("resolvePodium", () => {
  // An uneven bracket: one half reaches the final a round before the other, so
  // its last match is the only tie in its round. That is not the final.
  const uneven = [
    tie("q1", "A", "B", 1, 1),
    tie("q2", "C", "D", 1, 1),
    tie("r1", "E", "F", 1, 1),
    tie("r2", "G", "H", 1, 1),
    tie("r3", "I", "J", 1, 1),
    tie("shortHalf", "A", "C", 1, 2),
    tie("longQf", "E", "G", 1, 2),
    tie("longBye", "I", "", 1, 2),
    tie("longHalf", "E", "I", 1, 3),
  ];

  test("no champion while two teams are still in", () => {
    // Every tie is settled, but A and E have not met yet.
    assert.equal(resolvePodium(tournament(), uneven, entrants), null);
  });

  test("the champion is the last team standing once the final is played", () => {
    const played = [...uneven, tie("final", "A", "E", 2, 4)];
    const podium = resolvePodium(tournament(), played, entrants);
    assert.equal(podium?.first.TeamName, "E");
    assert.equal(podium?.second?.TeamName, "A");
  });

  test("no champion while the final is drawn but unplayed", () => {
    const drawn = [...uneven, tie("final", "A", "E", 0, 4)];
    assert.equal(resolvePodium(tournament(), drawn, entrants), null);
  });
});
