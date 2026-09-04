"use client";

import { useMemo, useState } from "react";
import type {
  GroupQualifier,
  TournamentGroup,
} from "@/lib/schemas/tournament";
import type { LeagueStanding } from "@/lib/leagueStandings";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { useToast } from "@/components/ui/Toast";
import { setGroupQualifiersAction } from "@/server/actions/tournamentActions";
import {
  asDisqualifiedSet,
  groupQualifiersComplete,
  qualifiersForGroup,
  tiesNeedingPicks,
  type GroupTieBreak,
} from "@/lib/groupQualifiers";

type Slot = { teamName: string; reason: string };

function slotsForTie(tie: GroupTieBreak, picks: GroupQualifier[]): Slot[] {
  const saved = qualifiersForGroup(picks, tie.groupName);
  return Array.from({ length: tie.remainingSlots }, (_, i) => ({
    teamName: saved[i]?.TeamName ?? "",
    reason: saved[i]?.Reason ?? "",
  }));
}

export function QualifierList({
  groups,
  qualifiers,
}: {
  groups: TournamentGroup[];
  qualifiers: GroupQualifier[];
}) {
  if (qualifiers.length === 0) return null;
  return (
    <div className="rounded-2xl border border-surface-2 bg-surface p-5">
      <h3 className="mb-1 text-lg font-semibold text-white">
        Tie-break decisions
      </h3>
      <p className="mb-4 text-sm text-body">
        These teams were picked to go through after finishing level on points.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {groups.map((group) => {
          const picks = qualifiersForGroup(qualifiers, group.GroupName);
          if (picks.length === 0) return null;
          return (
            <div key={group.GroupName}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                {group.GroupName}
              </p>
              <ul className="space-y-2">
                {picks.map((pick) => (
                  <li key={`${pick.GroupName}-${pick.TeamName}`}>
                    <p className="font-medium text-white">{pick.TeamName}</p>
                    <p className="text-sm text-body">{pick.Reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SelectQualifiers({
  tournamentId,
  groups,
  sections,
  advancePerGroup,
  initialQualifiers,
  disqualifiedTeams = [],
  canEdit,
  allGroupPlayed,
  knockoutDrawn,
  onSaved,
}: {
  tournamentId: string;
  groups: TournamentGroup[];
  sections: { name: string; standings: LeagueStanding[] }[];
  advancePerGroup: number;
  initialQualifiers: GroupQualifier[];
  disqualifiedTeams?: string[];
  canEdit: boolean;
  allGroupPlayed: boolean;
  knockoutDrawn: boolean;
  onSaved?: (qualifiers: GroupQualifier[]) => void;
}) {
  const toast = useToast();
  const count = Math.max(1, advancePerGroup);
  const dq = useMemo(
    () => asDisqualifiedSet(disqualifiedTeams),
    [disqualifiedTeams],
  );
  const ties = useMemo(
    () => tiesNeedingPicks(sections, count, dq),
    [sections, count, dq],
  );

  const [slots, setSlots] = useState<Record<string, Slot[]>>(() => {
    const next: Record<string, Slot[]> = {};
    for (const tie of ties) {
      next[tie.groupName] = slotsForTie(tie, initialQualifiers);
    }
    return next;
  });
  const [busy, setBusy] = useState(false);

  const savedComplete = groupQualifiersComplete(
    sections,
    initialQualifiers,
    count,
    dq,
    true,
  );

  const updateSlot = (
    groupName: string,
    index: number,
    patch: Partial<Slot>,
  ) => {
    setSlots((prev) => {
      const list = [...(prev[groupName] ?? [])];
      list[index] = { ...list[index], ...patch };
      return { ...prev, [groupName]: list };
    });
  };

  const handleSave = async () => {
    const payload: GroupQualifier[] = [];
    for (const tie of ties) {
      const groupSlots = slots[tie.groupName] ?? slotsForTie(tie, []);
      const filled = groupSlots.filter((s) => s.teamName);
      if (filled.length !== tie.remainingSlots) {
        toast.error(
          `Pick ${tie.remainingSlots} team${
            tie.remainingSlots === 1 ? "" : "s"
          } from the tie in ${tie.groupName}.`,
        );
        return;
      }
      const names = new Set(filled.map((s) => s.teamName));
      if (names.size !== filled.length) {
        toast.error(`Each pick in ${tie.groupName} must be a different team.`);
        return;
      }
      if (filled.some((s) => s.reason.trim().length < 3)) {
        toast.error(
          "Add a short public reason for each tied team you send through.",
        );
        return;
      }
      filled.forEach((slot, index) => {
        payload.push({
          GroupName: tie.groupName,
          TeamName: slot.teamName,
          Reason: slot.reason.trim(),
          Seed: tie.autoQualified.length + index + 1,
        });
      });
    }
    setBusy(true);
    const result = await setGroupQualifiersAction(tournamentId, {
      Qualifiers: payload,
    });
    setBusy(false);
    if (result.ok) {
      toast.success("Tie-break saved");
      onSaved?.(result.data);
    } else {
      toast.error(result.error);
    }
  };

  const editorReady =
    canEdit && allGroupPlayed && !knockoutDrawn && ties.length > 0;

  const hint = useMemo(() => {
    if (knockoutDrawn) return null;
    if (ties.length === 0) {
      return "No teams are level on points. The table decides who qualifies.";
    }
    if (!canEdit) {
      return savedComplete
        ? null
        : "The organiser will pick who goes through from teams level on points.";
    }
    return "Teams finished level on points. Pick who goes through and add a public reason, only for these tied teams.";
  }, [
    canEdit,
    knockoutDrawn,
    savedComplete,
    ties.length,
  ]);

  if (!editorReady && initialQualifiers.length === 0 && !hint) {
    return null;
  }

  return (
    <div className="space-y-3">
      {initialQualifiers.length > 0 && !editorReady ? (
        <QualifierList groups={groups} qualifiers={initialQualifiers} />
      ) : null}

      {editorReady ? (
        <div className="rounded-2xl border border-surface-2 bg-surface p-5">
          <h3 className="mb-1 text-lg font-semibold text-white">
            Break a points tie
          </h3>
          {hint ? <p className="mb-4 text-sm text-body">{hint}</p> : null}
          <div className="space-y-5">
            {ties.map((tie) => {
              const groupSlots =
                slots[tie.groupName] ?? slotsForTie(tie, initialQualifiers);
              const taken = new Set(
                groupSlots.map((s) => s.teamName).filter(Boolean),
              );
              return (
                <section key={tie.groupName}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                    {tie.groupName}
                  </p>
                  <p className="mb-3 text-sm text-body">
                    {tie.autoQualified.length > 0
                      ? `${tie.autoQualified.join(", ")} already through. `
                      : ""}
                    Pick {tie.remainingSlots} of{" "}
                    {tie.candidates.join(", ")} ({tie.points} pts).
                  </p>
                  <div className="space-y-3">
                    {groupSlots.map((slot, index) => (
                      <div
                        key={`${tie.groupName}-${index}`}
                        className="rounded-xl border border-surface-2 bg-bg p-3"
                      >
                        <label className="mb-2 block text-sm text-label">
                          Goes through
                        </label>
                        <select
                          value={slot.teamName}
                          onChange={(e) =>
                            updateSlot(tie.groupName, index, {
                              teamName: e.target.value,
                            })
                          }
                          className="mb-2 w-full rounded-lg border border-primary/25 bg-input px-4 py-3 text-sm text-white outline-none transition-colors focus:border-primary"
                        >
                          <option value="">Select a team</option>
                          {tie.candidates.map((name) => (
                            <option
                              key={name}
                              value={name}
                              disabled={
                                taken.has(name) && name !== slot.teamName
                              }
                            >
                              {name}
                            </option>
                          ))}
                        </select>
                        <TextArea
                          label="Public reason"
                          rows={2}
                          maxLength={280}
                          placeholder="Why this team goes through"
                          value={slot.reason}
                          onChange={(e) =>
                            updateSlot(tie.groupName, index, {
                              reason: e.target.value,
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="mt-5">
            <Button loading={busy} onClick={() => void handleSave()}>
              Save decision
            </Button>
          </div>
        </div>
      ) : hint && (ties.length === 0 || initialQualifiers.length === 0) ? (
        <p className="text-center text-sm text-body">{hint}</p>
      ) : null}
    </div>
  );
}
