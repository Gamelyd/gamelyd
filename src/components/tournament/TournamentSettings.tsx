"use client";

import { useEffect, useState } from "react";
import type { Tournament, TournamentManager } from "@/lib/schemas/tournament";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { useToast } from "@/components/ui/Toast";
import { TournamentCoverPicker } from "@/components/tournament/TournamentCoverPicker";
import {
  addTournamentManagerAction,
  editTournamentSettingsAction,
  listAssignableManagersAction,
  listTournamentManagersAction,
  removeTournamentManagerAction,
} from "@/server/actions/tournamentActions";

export function EditTournamentSettings({
  tournament,
  started,
  registeredCount,
  fixturesDrawn,
  knockoutDrawn,
  onSaved,
}: {
  tournament: Tournament;
  started: boolean;
  registeredCount: number;
  fixturesDrawn: boolean;
  knockoutDrawn: boolean;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isGroups = tournament.TournamentMode === "GROUPS";
  const isTable =
    isGroups || tournament.TournamentMode === "LEAGUE";
  const groupsExist = (tournament.Groups ?? []).length > 0;
  const canEditCore = !started;
  const canEditReturnLeg = isTable && !fixturesDrawn;
  const canEditGroupCount = isGroups && !groupsExist;
  const canEditAdvance = isGroups && !knockoutDrawn;
  const canEditPoints =
    (isGroups && !knockoutDrawn) ||
    (tournament.TournamentMode === "LEAGUE" && !fixturesDrawn);
  const canEditQualifiers = isGroups && !knockoutDrawn;
  const isKnockoutMode =
    isGroups || tournament.TournamentMode === "MULTIPLAYER";
  const canEditKnockout =
    isKnockoutMode &&
    !knockoutDrawn &&
    (isGroups || !fixturesDrawn);
  const canEditTieBreaker = canEditPoints;
  const canEditBr =
    tournament.TournamentMode === "BATTLEROYALE" && !fixturesDrawn;
  const canEditSchedule = !fixturesDrawn;
  const hasAnything =
    canEditCore ||
    canEditReturnLeg ||
    canEditGroupCount ||
    canEditAdvance ||
    canEditPoints ||
    canEditQualifiers ||
    canEditKnockout ||
    canEditBr ||
    canEditSchedule;

  type BusyField =
    | ""
    | "shuffle"
    | "type"
    | "size"
    | "name"
    | "date"
    | "note"
    | "returnLeg"
    | "advance"
    | "groups"
    | "points"
    | "qualifiers"
    | "knockout"
    | "third"
    | "tie"
    | "br"
    | "schedule"
    | "checkin"
    | "deadline";

  const [busyField, setBusyField] = useState<BusyField>("");
  const [shuffle, setShuffle] = useState(tournament.Shuffle);
  const [type, setType] = useState(tournament.TournamentType);
  const [size, setSize] = useState(String(tournament.TournamentSize));
  const [name, setName] = useState(tournament.Name);
  const [date, setDate] = useState(dateInputValue(tournament.Date));
  const [note, setNote] = useState(tournament.Note);
  const [returnLeg, setReturnLeg] = useState(tournament.ReturnLeg);
  const [advancePerGroup, setAdvancePerGroup] = useState(
    String(tournament.AdvancePerGroup || 2),
  );
  const [groupCount, setGroupCount] = useState(
    String(tournament.GroupCount || 0),
  );
  const [pointsWin, setPointsWin] = useState(
    String(tournament.PointSystem?.Win ?? 3),
  );
  const [pointsDraw, setPointsDraw] = useState(
    String(tournament.PointSystem?.Draw ?? 1),
  );
  const [pickQualifiers, setPickQualifiers] = useState(
    tournament.OwnerCanSelectQualifiers,
  );
  const [knockoutFormat, setKnockoutFormat] = useState(
    tournament.KnockoutFormat || "SINGLE",
  );
  const [thirdPlace, setThirdPlace] = useState(tournament.ThirdPlace);
  const [tieBreaker, setTieBreaker] = useState(
    tournament.TieBreaker || "GOAL_DIFF",
  );
  const [brLobbies, setBrLobbies] = useState(String(tournament.BrLobbyCount || 1));
  const [brKillPoints, setBrKillPoints] = useState(
    String(tournament.BrKillPoints ?? 1),
  );
  const [brFirstBlood, setBrFirstBlood] = useState(
    String(tournament.BrFirstBloodPoints ?? 0),
  );
  const [brPlacement, setBrPlacement] = useState(
    (tournament.BrPlacementPoints ?? [12, 9, 7, 5, 4, 3, 2, 1]).join(","),
  );
  const [deadline, setDeadline] = useState(
    dateInputValue(tournament.RegistrationDeadline || ""),
  );
  const [checkInRequired, setCheckInRequired] = useState(
    tournament.CheckInRequired,
  );
  const [checkInCloses, setCheckInCloses] = useState(
    dateInputValue(tournament.CheckInCloses || ""),
  );
  const [firstMatchAt, setFirstMatchAt] = useState(tournament.FirstMatchAt || "");
  const [matchInterval, setMatchInterval] = useState(
    String(tournament.MatchIntervalMinutes || 0),
  );
  const [confirmVisibility, setConfirmVisibility] = useState(false);

  useEffect(() => {
    setShuffle(tournament.Shuffle);
    setType(tournament.TournamentType);
    setSize(String(tournament.TournamentSize));
    setName(tournament.Name);
    setDate(dateInputValue(tournament.Date));
    setNote(tournament.Note);
    setReturnLeg(tournament.ReturnLeg);
    setAdvancePerGroup(String(tournament.AdvancePerGroup || 2));
    setGroupCount(String(tournament.GroupCount || 0));
    setPointsWin(String(tournament.PointSystem?.Win ?? 3));
    setPointsDraw(String(tournament.PointSystem?.Draw ?? 1));
    setPickQualifiers(tournament.OwnerCanSelectQualifiers);
    setKnockoutFormat(tournament.KnockoutFormat || "SINGLE");
    setThirdPlace(tournament.ThirdPlace);
    setTieBreaker(tournament.TieBreaker || "GOAL_DIFF");
    setBrLobbies(String(tournament.BrLobbyCount || 1));
    setBrKillPoints(String(tournament.BrKillPoints ?? 1));
    setBrFirstBlood(String(tournament.BrFirstBloodPoints ?? 0));
    setBrPlacement(
      (tournament.BrPlacementPoints ?? [12, 9, 7, 5, 4, 3, 2, 1]).join(","),
    );
    setDeadline(dateInputValue(tournament.RegistrationDeadline || ""));
    setCheckInRequired(tournament.CheckInRequired);
    setCheckInCloses(dateInputValue(tournament.CheckInCloses || ""));
    setFirstMatchAt(tournament.FirstMatchAt || "");
    setMatchInterval(String(tournament.MatchIntervalMinutes || 0));
  }, [tournament]);

  const save = async (field: BusyField, patch: Record<string, unknown>) => {
    setBusyField(field);
    const result = await editTournamentSettingsAction(
      tournament.TournamentId,
      patch,
    );
    setBusyField("");
    if (result.ok) {
      toast.success(result.message ?? "Settings saved");
      onSaved();
    } else {
      toast.error(result.error);
    }
    return result.ok;
  };

  const changeShuffle = (next: Tournament["Shuffle"]) => {
    if (next === tournament.Shuffle || busyField) return;
    setShuffle(next);
    void save("shuffle", { Shuffle: next }).then((ok) => {
      if (!ok) setShuffle(tournament.Shuffle);
    });
  };

  const changeType = (next: Tournament["TournamentType"]) => {
    if (next === tournament.TournamentType || busyField) return;
    setType(next);
    setConfirmVisibility(true);
  };

  const changeReturnLeg = (next: boolean) => {
    if (next === tournament.ReturnLeg || busyField) return;
    setReturnLeg(next);
    void save("returnLeg", { ReturnLeg: next }).then((ok) => {
      if (!ok) setReturnLeg(tournament.ReturnLeg);
    });
  };

  const changeGroupCount = (next: number) => {
    if (next === (tournament.GroupCount || 0) || busyField) return;
    setGroupCount(String(next));
    void save("groups", { GroupCount: next }).then((ok) => {
      if (!ok) setGroupCount(String(tournament.GroupCount || 0));
    });
  };

  const changeQualifiers = (next: boolean) => {
    if (next === tournament.OwnerCanSelectQualifiers || busyField) return;
    setPickQualifiers(next);
    void save("qualifiers", { OwnerCanSelectQualifiers: next }).then((ok) => {
      if (!ok) setPickQualifiers(tournament.OwnerCanSelectQualifiers);
    });
  };

  const saveSize = () => {
    if (busyField) return;
    if (size === String(tournament.TournamentSize)) return;
    const value = Number(size);
    if (!Number.isFinite(value) || value < 1) {
      toast.error("Enter a valid tournament size");
      setSize(String(tournament.TournamentSize));
      return;
    }
    if (value < registeredCount) {
      toast.error(
        `Size can't be less than the ${registeredCount} team${
          registeredCount === 1 ? "" : "s"
        } already registered`,
      );
      setSize(String(tournament.TournamentSize));
      return;
    }
    void save("size", { TournamentSize: value }).then((ok) => {
      if (!ok) setSize(String(tournament.TournamentSize));
    });
  };

  const saveName = () => {
    if (busyField) return;
    const next = name.trim();
    if (next === tournament.Name) return;
    if (next.length < 2) {
      toast.error("Name needs at least two characters");
      setName(tournament.Name);
      return;
    }
    void save("name", { Name: next }).then((ok) => {
      if (!ok) setName(tournament.Name);
    });
  };

  const saveDate = () => {
    if (busyField) return;
    if (date === dateInputValue(tournament.Date)) return;
    if (!date) {
      toast.error("Pick a date");
      setDate(dateInputValue(tournament.Date));
      return;
    }
    void save("date", { Date: date }).then((ok) => {
      if (!ok) setDate(dateInputValue(tournament.Date));
    });
  };

  const saveNote = () => {
    if (busyField) return;
    const next = note.trim();
    if (next === tournament.Note.trim()) return;
    if (next.length < 1) {
      toast.error("Briefing can't be empty");
      setNote(tournament.Note);
      return;
    }
    void save("note", { Note: next }).then((ok) => {
      if (!ok) setNote(tournament.Note);
    });
  };

  const saveAdvance = () => {
    if (busyField) return;
    const value = Number(advancePerGroup);
    if (value === (tournament.AdvancePerGroup || 2)) return;
    if (!Number.isInteger(value) || value < 1 || value > 8) {
      toast.error("Advance per group must be between 1 and 8");
      setAdvancePerGroup(String(tournament.AdvancePerGroup || 2));
      return;
    }
    void save("advance", { AdvancePerGroup: value }).then((ok) => {
      if (!ok) setAdvancePerGroup(String(tournament.AdvancePerGroup || 2));
    });
  };

  const savePoints = () => {
    if (busyField) return;
    const win = Number(pointsWin);
    const draw = Number(pointsDraw);
    if (
      win === (tournament.PointSystem?.Win ?? 3) &&
      draw === (tournament.PointSystem?.Draw ?? 1)
    ) {
      return;
    }
    if (
      !Number.isFinite(win) ||
      !Number.isFinite(draw) ||
      win < 0 ||
      draw < 0
    ) {
      toast.error("Enter valid point values");
      setPointsWin(String(tournament.PointSystem?.Win ?? 3));
      setPointsDraw(String(tournament.PointSystem?.Draw ?? 1));
      return;
    }
    void save("points", { PointSystem: { Win: win, Draw: draw } }).then(
      (ok) => {
        if (!ok) {
          setPointsWin(String(tournament.PointSystem?.Win ?? 3));
          setPointsDraw(String(tournament.PointSystem?.Draw ?? 1));
        }
      },
    );
  };

  const saveVisibility = async () => {
    setConfirmVisibility(false);
    const ok = await save("type", { TournamentType: type });
    if (!ok) setType(tournament.TournamentType);
  };

  const cancelVisibility = () => {
    if (busyField === "type") return;
    setConfirmVisibility(false);
    setType(tournament.TournamentType);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-surface-2 bg-surface p-5">
      <div>
        <h3 className="mb-1 font-semibold text-white">Tournament settings</h3>
        <p className="text-sm text-body">
          {started
            ? "Cover art can still be changed. Format rules that are locked stay as they are."
            : "Editable until the matching stage is locked. Changes save automatically."}
        </p>
      </div>

      <TournamentCoverPicker
        tournamentId={tournament.TournamentId}
        gameName={tournament.GameName}
        value={tournament.icon}
        onSaved={onSaved}
      />

      {hasAnything ? null : (
        <p className="text-sm text-body">
          Other settings are locked now that the event is underway.
        </p>
      )}

      {canEditCore ? (
        <>
          <Input
            label={busyField === "name" ? "Name (saving…)" : "Name"}
            value={name}
            disabled={Boolean(busyField)}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveName();
              }
            }}
          />

          <Input
            type="date"
            label={busyField === "date" ? "Date (saving…)" : "Date"}
            value={date}
            disabled={Boolean(busyField)}
            onChange={(e) => setDate(e.target.value)}
            onBlur={saveDate}
          />

          <TextArea
            label={busyField === "note" ? "Briefing (saving…)" : "Briefing"}
            rows={3}
            value={note}
            disabled={Boolean(busyField)}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
          />

          <Select
            label={
              busyField === "shuffle" ? "Draw order (saving…)" : "Draw order"
            }
            value={shuffle}
            disabled={Boolean(busyField)}
            onChange={(e) =>
              changeShuffle(e.target.value as Tournament["Shuffle"])
            }
            options={[
              { label: "Automatic", value: "AUTOMATIC" },
              { label: "Manual", value: "MANUAL" },
            ]}
          />

          <Select
            label={busyField === "type" ? "Visibility (saving…)" : "Visibility"}
            value={type}
            disabled={Boolean(busyField)}
            onChange={(e) =>
              changeType(e.target.value as Tournament["TournamentType"])
            }
            options={[
              { label: "Public", value: "PUBLIC" },
              { label: "Private", value: "PRIVATE" },
            ]}
          />

          <Input
            label={
              busyField === "size"
                ? "Tournament size (saving…)"
                : "Tournament size"
            }
            type="number"
            min={Math.max(registeredCount, 1)}
            value={size}
            disabled={Boolean(busyField)}
            onChange={(e) => setSize(e.target.value)}
            onBlur={saveSize}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveSize();
              }
            }}
          />
        </>
      ) : null}

      {canEditReturnLeg ? (
        <Select
          label={
            busyField === "returnLeg" ? "Return leg (saving…)" : "Return leg"
          }
          value={returnLeg ? "true" : "false"}
          disabled={Boolean(busyField)}
          onChange={(e) => changeReturnLeg(e.target.value === "true")}
          options={[
            { label: "Single round", value: "false" },
            { label: "Home and away", value: "true" },
          ]}
        />
      ) : null}

      {canEditPoints ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="number"
            min={0}
            max={20}
            label={busyField === "points" ? "Win points (saving…)" : "Win points"}
            value={pointsWin}
            disabled={Boolean(busyField)}
            onChange={(e) => setPointsWin(e.target.value)}
            onBlur={savePoints}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                savePoints();
              }
            }}
          />
          <Input
            type="number"
            min={0}
            max={20}
            label={
              busyField === "points" ? "Draw points (saving…)" : "Draw points"
            }
            value={pointsDraw}
            disabled={Boolean(busyField)}
            onChange={(e) => setPointsDraw(e.target.value)}
            onBlur={savePoints}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                savePoints();
              }
            }}
          />
        </div>
      ) : null}

      {canEditGroupCount ? (
        <Select
          label={
            busyField === "groups"
              ? "Number of groups (saving…)"
              : "Number of groups"
          }
          value={groupCount}
          disabled={Boolean(busyField)}
          onChange={(e) => changeGroupCount(Number(e.target.value))}
          options={[
            { label: "Auto (about four teams each)", value: "0" },
            ...[2, 3, 4, 5, 6, 7, 8].map((n) => ({
              label: String(n),
              value: String(n),
            })),
          ]}
        />
      ) : null}

      {canEditAdvance ? (
        <Input
          type="number"
          min={1}
          max={8}
          label={
            busyField === "advance"
              ? "Advance per group (saving…)"
              : "Advance per group"
          }
          value={advancePerGroup}
          disabled={Boolean(busyField)}
          onChange={(e) => setAdvancePerGroup(e.target.value)}
          onBlur={saveAdvance}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              saveAdvance();
            }
          }}
        />
      ) : null}

      {canEditQualifiers ? (
        <Select
          label={
            busyField === "qualifiers"
              ? "Ties on the table (saving…)"
              : "Ties on the table"
          }
          value={pickQualifiers ? "true" : "false"}
          disabled={Boolean(busyField)}
          onChange={(e) => changeQualifiers(e.target.value === "true")}
          options={[
            { label: "Table order decides", value: "false" },
            { label: "Host picks if teams are level", value: "true" },
          ]}
        />
      ) : null}

      {canEditTieBreaker ? (
        <Select
          label={busyField === "tie" ? "Tie-break (saving…)" : "Table tie-break"}
          value={tieBreaker}
          disabled={Boolean(busyField)}
          onChange={(e) => {
            const next = e.target.value as Tournament["TieBreaker"];
            if (next === tournament.TieBreaker || busyField) return;
            setTieBreaker(next);
            void save("tie", { TieBreaker: next }).then((ok) => {
              if (!ok) setTieBreaker(tournament.TieBreaker || "GOAL_DIFF");
            });
          }}
          options={[
            { label: "Goal difference", value: "GOAL_DIFF" },
            { label: "Head to head", value: "HEAD_TO_HEAD" },
          ]}
        />
      ) : null}

      {canEditKnockout ? (
        <>
          <Select
            label={
              busyField === "knockout"
                ? "Knockout ties (saving…)"
                : "Knockout ties"
            }
            value={knockoutFormat}
            disabled={Boolean(busyField)}
            onChange={(e) => {
              const next = e.target.value as Tournament["KnockoutFormat"];
              if (next === (tournament.KnockoutFormat || "SINGLE") || busyField)
                return;
              setKnockoutFormat(next);
              void save("knockout", { KnockoutFormat: next }).then((ok) => {
                if (!ok)
                  setKnockoutFormat(tournament.KnockoutFormat || "SINGLE");
              });
            }}
            options={[
              { label: "Single match", value: "SINGLE" },
              { label: "Two legs (aggregate)", value: "TWO_LEG" },
              { label: "Best of 3", value: "BO3" },
              { label: "Best of 5", value: "BO5" },
            ]}
          />
          <Select
            label={
              busyField === "third" ? "Third place (saving…)" : "Third place"
            }
            value={thirdPlace ? "true" : "false"}
            disabled={Boolean(busyField)}
            onChange={(e) => {
              const next = e.target.value === "true";
              if (next === tournament.ThirdPlace || busyField) return;
              setThirdPlace(next);
              void save("third", { ThirdPlace: next }).then((ok) => {
                if (!ok) setThirdPlace(tournament.ThirdPlace);
              });
            }}
            options={[
              { label: "No 3rd place match", value: "false" },
              { label: "Play for 3rd", value: "true" },
            ]}
          />
        </>
      ) : null}

      {canEditBr ? (
        <>
          <Input
            type="number"
            min={1}
            max={20}
            label={busyField === "br" ? "Lobbies (saving…)" : "Lobbies"}
            value={brLobbies}
            disabled={Boolean(busyField)}
            onChange={(e) => setBrLobbies(e.target.value)}
            onBlur={() => {
              const value = Math.min(20, Math.max(1, Number(brLobbies) || 1));
              if (value === (tournament.BrLobbyCount || 1)) return;
              void save("br", { BrLobbyCount: value }).then((ok) => {
                if (!ok) setBrLobbies(String(tournament.BrLobbyCount || 1));
              });
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="number"
              min={0}
              label="Points per kill"
              value={brKillPoints}
              disabled={Boolean(busyField)}
              onChange={(e) => setBrKillPoints(e.target.value)}
              onBlur={() => {
                const value = Math.max(0, Number(brKillPoints) || 0);
                if (value === (tournament.BrKillPoints ?? 1)) return;
                void save("br", { BrKillPoints: value });
              }}
            />
            <Input
              type="number"
              min={0}
              label="First blood points"
              value={brFirstBlood}
              disabled={Boolean(busyField)}
              onChange={(e) => setBrFirstBlood(e.target.value)}
              onBlur={() => {
                const value = Math.max(0, Number(brFirstBlood) || 0);
                if (value === (tournament.BrFirstBloodPoints ?? 0)) return;
                void save("br", { BrFirstBloodPoints: value });
              }}
            />
          </div>
          <Input
            label="Placement points (1st, 2nd, …)"
            value={brPlacement}
            disabled={Boolean(busyField)}
            onChange={(e) => setBrPlacement(e.target.value)}
            onBlur={() => {
              const pts = brPlacement
                .split(/[,\s]+/)
                .map((n) => Number(n))
                .filter((n) => Number.isFinite(n));
              void save("br", { BrPlacementPoints: pts });
            }}
          />
        </>
      ) : null}

      {canEditCore ? (
        <>
          <Input
            type="date"
            label={
              busyField === "deadline"
                ? "Registration closes (saving…)"
                : "Registration closes"
            }
            value={deadline}
            disabled={Boolean(busyField)}
            onChange={(e) => setDeadline(e.target.value)}
            onBlur={() => {
              if (
                deadline ===
                dateInputValue(tournament.RegistrationDeadline || "")
              )
                return;
              void save("deadline", { RegistrationDeadline: deadline });
            }}
          />
          <Select
            label={busyField === "checkin" ? "Check-in (saving…)" : "Check-in"}
            value={checkInRequired ? "true" : "false"}
            disabled={Boolean(busyField)}
            onChange={(e) => {
              const next = e.target.value === "true";
              if (next === tournament.CheckInRequired || busyField) return;
              setCheckInRequired(next);
              void save("checkin", { CheckInRequired: next }).then((ok) => {
                if (!ok) setCheckInRequired(tournament.CheckInRequired);
              });
            }}
            options={[
              { label: "No check-in", value: "false" },
              { label: "Teams must check in", value: "true" },
            ]}
          />
          {checkInRequired ? (
            <Input
              type="date"
              label="Check-in closes"
              value={checkInCloses}
              disabled={Boolean(busyField)}
              onChange={(e) => setCheckInCloses(e.target.value)}
              onBlur={() => {
                if (
                  checkInCloses ===
                  dateInputValue(tournament.CheckInCloses || "")
                )
                  return;
                void save("checkin", { CheckInCloses: checkInCloses });
              }}
            />
          ) : null}
        </>
      ) : null}

      {canEditSchedule ? (
        <>
          <Input
            type="datetime-local"
            label={
              busyField === "schedule" ? "First match (saving…)" : "First match"
            }
            value={firstMatchAt}
            disabled={Boolean(busyField)}
            onChange={(e) => setFirstMatchAt(e.target.value)}
            onBlur={() => {
              if (firstMatchAt === (tournament.FirstMatchAt || "")) return;
              void save("schedule", { FirstMatchAt: firstMatchAt });
            }}
          />
          <Input
            type="number"
            min={0}
            label="Minutes between matches"
            value={matchInterval}
            disabled={Boolean(busyField)}
            onChange={(e) => setMatchInterval(e.target.value)}
            onBlur={() => {
              const value = Math.max(0, Number(matchInterval) || 0);
              if (value === (tournament.MatchIntervalMinutes || 0)) return;
              void save("schedule", { MatchIntervalMinutes: value });
            }}
          />
        </>
      ) : null}

      <Confirm
        open={confirmVisibility}
        title="Change visibility?"
        message={
          type === "PRIVATE"
            ? "Making this tournament private will hide it from public listings and search. Only people with the link can find it."
            : "Making this tournament public will list it in browse and search so anyone can find and join it."
        }
        confirmLabel="Yes, change"
        confirmVariant="default"
        loading={busyField === "type"}
        onConfirm={() => void saveVisibility()}
        onCancel={cancelVisibility}
      />
    </div>
  );
}

function dateInputValue(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";
  const d = new Date(parsed);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function managerName(m: TournamentManager): string {
  const full = `${m.first_name} ${m.last_name}`.trim();
  return full || m.user_name || m.email || "Member";
}

export function ManagerSettings({
  tournamentId,
  hasOrg,
  orgName,
}: {
  tournamentId: string;
  hasOrg: boolean;
  orgName: string;
}) {
  const toast = useToast();
  const [managers, setManagers] = useState<TournamentManager[]>([]);
  const [candidates, setCandidates] = useState<TournamentManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      listTournamentManagersAction(tournamentId),
      listAssignableManagersAction(tournamentId),
    ]).then(([managersResult, candidatesResult]) => {
      if (!active) return;
      if (managersResult.ok) setManagers(managersResult.data);
      else toast.error(managersResult.error);
      if (candidatesResult.ok) setCandidates(candidatesResult.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [tournamentId, toast]);

  const add = async (userId: string) => {
    setBusyId(userId);
    const result = await addTournamentManagerAction(tournamentId, userId);
    setBusyId("");
    if (result.ok) {
      setManagers(result.data);
      setCandidates((prev) => prev.filter((c) => c.user_id !== userId));
      toast.success(result.message ?? "Manager added");
    } else {
      toast.error(result.error);
    }
  };

  const remove = async (member: TournamentManager) => {
    setBusyId(member.user_id);
    const result = await removeTournamentManagerAction(
      tournamentId,
      member.user_id,
    );
    setBusyId("");
    if (result.ok) {
      setManagers(result.data);
      setCandidates((prev) =>
        prev.some((c) => c.user_id === member.user_id)
          ? prev
          : [...prev, member],
      );
      toast.success(result.message ?? "Manager removed");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="rounded-xl border border-surface-2 bg-surface p-5">
      <h3 className="mb-1 font-semibold text-white">Tournament managers</h3>
      <p className="mb-4 text-sm text-body">
        Add people from your organization who can help run this tournament:
        draw fixtures, record scores and create groups. Only the tournament
        owner can manage this list.
      </p>

      {!hasOrg ? (
        <p className="rounded-lg border border-surface-2 bg-surface-2/40 p-4 text-sm text-body">
          Host this tournament under an organization to add managers.
        </p>
      ) : loading ? (
        <p className="text-sm text-body">Loading…</p>
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-body">
              Current managers
            </h4>
            {managers.length === 0 ? (
              <p className="text-sm text-body">
                No managers yet. Add someone from {orgName || "your organization"}
                below.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {managers.map((m) => (
                  <li
                    key={m.user_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-surface-2 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white">
                        {managerName(m)}
                      </span>
                      {m.user_name ? (
                        <span className="block truncate text-xs text-body">
                          @{m.user_name}
                        </span>
                      ) : null}
                    </span>
                    <Button
                      variant="danger"
                      loading={busyId === m.user_id}
                      onClick={() => remove(m)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-body">
              Add from {orgName || "your organization"}
            </h4>
            {candidates.length === 0 ? (
              <p className="text-sm text-body">
                No other organization members to add.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {candidates.map((c) => (
                  <li
                    key={c.user_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-surface-2 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white">
                        {managerName(c)}
                      </span>
                      {c.user_name ? (
                        <span className="block truncate text-xs text-body">
                          @{c.user_name}
                        </span>
                      ) : null}
                    </span>
                    <Button
                      loading={busyId === c.user_id}
                      onClick={() => add(c.user_id)}
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
