import type { EditTournamentInput } from "@/lib/schemas/tournament";
import type { PendingSettingChange } from "@/lib/schemas/tournament";
import { knockoutFormatLabel } from "@/lib/knockoutSeries";

/** Fields that change how a started tournament is played or scheduled. */
export const SERIOUS_SETTING_KEYS = [
  "Shuffle",
  "TournamentSize",
  "Date",
  "ReturnLeg",
  "AdvancePerGroup",
  "GroupCount",
  "PointSystem",
  "OwnerCanSelectQualifiers",
  "KnockoutFormat",
  "KnockoutFinalsSeries",
  "ThirdPlace",
  "TieBreaker",
  "BrLobbyCount",
  "BrKillPoints",
  "BrFirstBloodPoints",
  "BrPlacementPoints",
  "RegistrationDeadline",
  "CheckInRequired",
  "CheckInOpens",
  "CheckInCloses",
  "FirstMatchAt",
  "MatchIntervalMinutes",
] as const;

const SERIOUS = new Set<string>(SERIOUS_SETTING_KEYS);

export function isSeriousSettingPatch(
  patch: Record<string, unknown> | EditTournamentInput,
): boolean {
  return Object.keys(patch).some(
    (key) => SERIOUS.has(key) && patch[key as keyof typeof patch] !== undefined,
  );
}

export function settingChangeReady(change: PendingSettingChange): boolean {
  if (change.RequiredUserIds.length === 0) return true;
  const accepted = new Set(change.AcceptedUserIds);
  return change.RequiredUserIds.every((id) => accepted.has(id));
}

export function summarizeSettingPatch(
  patch: Record<string, unknown> | EditTournamentInput,
): string {
  const parts: string[] = [];
  const value = patch as Record<string, unknown>;

  if (value.Shuffle !== undefined) {
    parts.push(
      value.Shuffle === "MANUAL" ? "Manual draw order" : "Automatic draw order",
    );
  }
  if (value.TournamentSize !== undefined) {
    parts.push(`Size ${String(value.TournamentSize)}`);
  }
  if (value.Date !== undefined) {
    parts.push(`Date ${String(value.Date)}`);
  }
  if (value.ReturnLeg !== undefined) {
    parts.push(value.ReturnLeg ? "Home and away" : "Single round (no return leg)");
  }
  if (value.AdvancePerGroup !== undefined) {
    parts.push(`Advance ${String(value.AdvancePerGroup)} per group`);
  }
  if (value.GroupCount !== undefined) {
    parts.push(
      Number(value.GroupCount) === 0
        ? "Auto group count"
        : `${String(value.GroupCount)} groups`,
    );
  }
  if (value.PointSystem && typeof value.PointSystem === "object") {
    const points = value.PointSystem as { Win?: number; Draw?: number };
    parts.push(`Points ${points.Win ?? 3} win / ${points.Draw ?? 1} draw`);
  }
  if (value.OwnerCanSelectQualifiers !== undefined) {
    parts.push(
      value.OwnerCanSelectQualifiers
        ? "Host can pick tied qualifiers"
        : "Table decides qualifiers",
    );
  }
  if (value.KnockoutFormat !== undefined) {
    parts.push(knockoutFormatLabel(value.KnockoutFormat as never));
  }
  if (value.KnockoutFinalsSeries !== undefined) {
    parts.push(
      value.KnockoutFinalsSeries
        ? "Final uses the knockout series format"
        : "Final is one match",
    );
  }
  if (value.ThirdPlace !== undefined) {
    parts.push(value.ThirdPlace ? "3rd place match" : "No 3rd place match");
  }
  if (value.TieBreaker !== undefined) {
    parts.push(
      value.TieBreaker === "HEAD_TO_HEAD"
        ? "Tie-break: head to head"
        : "Tie-break: goal difference",
    );
  }
  if (value.BrLobbyCount !== undefined) {
    parts.push(`${String(value.BrLobbyCount)} lobbies`);
  }
  if (value.BrKillPoints !== undefined) {
    parts.push(`${String(value.BrKillPoints)} points per kill`);
  }
  if (value.BrFirstBloodPoints !== undefined) {
    parts.push(`${String(value.BrFirstBloodPoints)} first-blood points`);
  }
  if (value.BrPlacementPoints !== undefined) {
    parts.push("New placement points");
  }
  if (value.RegistrationDeadline !== undefined) {
    parts.push(
      value.RegistrationDeadline
        ? `Registration deadline ${String(value.RegistrationDeadline)}`
        : "No registration deadline",
    );
  }
  if (value.CheckInRequired !== undefined) {
    parts.push(value.CheckInRequired ? "Check-in required" : "No check-in");
  }
  if (value.CheckInOpens !== undefined || value.CheckInCloses !== undefined) {
    parts.push("Updated check-in window");
  }
  if (value.FirstMatchAt !== undefined) {
    parts.push(
      value.FirstMatchAt
        ? `First match ${String(value.FirstMatchAt)}`
        : "No first-match time",
    );
  }
  if (value.MatchIntervalMinutes !== undefined) {
    parts.push(`${String(value.MatchIntervalMinutes)} min between matches`);
  }

  return parts.join(" · ") || "Tournament settings";
}
