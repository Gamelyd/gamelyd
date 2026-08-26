import type { Draw } from "@/lib/schemas/draw";
import type { TournamentMode } from "@/lib/schemas/common";
import { isKnockoutMatchSettled } from "@/lib/knockoutSeed";

export type NextStageKind =
  | "advance"
  | "knockoutNext"
  | "nextStage"
  | "breakTies";

export type NextStagePrompt = {
  kind: NextStageKind;
  title: string;
  message: string;
  confirmLabel: string;
};

function isGroupDraw(draw: Draw): boolean {
  return Boolean(draw.Group?.trim());
}

function isKnockoutDraw(draw: Draw): boolean {
  return !isGroupDraw(draw) && draw.BRTeams.length === 0;
}

function roundTied(round: Draw[]): boolean {
  return round.some(
    (d) =>
      Boolean(d.Team2?.TeamName) &&
      d.Winner === "" &&
      d.Team1Score === d.Team2Score,
  );
}

/** After a newly recorded score, what the manager should do next — if anything. */
export function nextStageAfterScore({
  mode,
  draws,
  scored,
  wasAlreadyPlayed,
  canSelectQualifiers,
  picksComplete,
}: {
  mode: TournamentMode;
  draws: Draw[];
  scored: Draw;
  wasAlreadyPlayed: boolean;
  canSelectQualifiers: boolean;
  picksComplete: boolean;
}): NextStagePrompt | null {
  if (wasAlreadyPlayed || !scored.Played) return null;
  if (mode === "LEAGUE" || mode === "BATTLEROYALE") return null;

  if (mode === "GROUPS" && isGroupDraw(scored)) {
    const groupDraws = draws.filter(isGroupDraw);
    if (groupDraws.length === 0 || groupDraws.some((d) => !d.Played)) {
      return null;
    }
    if (draws.some(isKnockoutDraw)) return null;
    if (canSelectQualifiers && !picksComplete) {
      return {
        kind: "breakTies",
        title: "Break the points tie",
        message:
          "Every group match is in, but some teams finished level on points. Pick who goes through (and why), then you can start the knockout.",
        confirmLabel: "Go to groups",
      };
    }
    return {
      kind: "advance",
      title: "Start knockout?",
      message:
        "Every group match is in. Draw the knockout bracket from the teams that qualified.",
      confirmLabel: "Start knockout",
    };
  }

  if (!isKnockoutDraw(scored)) return null;

  const stage = scored.Stage;
  const round = draws.filter((d) => isKnockoutDraw(d) && d.Stage === stage);
  if (round.length === 0 || round.some((d) => !isKnockoutMatchSettled(d))) {
    return null;
  }
  if (round.length === 1) return null;
  if (draws.some((d) => isKnockoutDraw(d) && d.Stage > stage)) return null;
  if (roundTied(round)) return null;

  if (mode === "GROUPS") {
    return {
      kind: "knockoutNext",
      title: "Draw next knockout round?",
      message:
        "This knockout round is complete. Pair the winners into the next round.",
      confirmLabel: "Draw next round",
    };
  }

  return {
    kind: "nextStage",
    title: "Draw next stage?",
    message:
      "This round is complete. Generate the next round of fixtures from the winners.",
    confirmLabel: "Draw next stage",
  };
}
