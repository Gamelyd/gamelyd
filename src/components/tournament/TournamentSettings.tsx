"use client";

import { useEffect, useState } from "react";
import type { Tournament, TournamentManager } from "@/lib/schemas/tournament";
import { isSeriousSettingPatch } from "@/lib/settingChange";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { CollapsiblePanel } from "@/components/ui/CollapsiblePanel";
import { Input } from "@/components/ui/Input";
import { DateInput, DateTimeInput } from "@/components/ui/DateTimePicker";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { Loader } from "@/components/ui/Loader";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { TournamentCoverPicker } from "@/components/tournament/TournamentCoverPicker";
import { SettingChangePanel } from "@/components/tournament/SettingChangePanel";
import { VerifiedName } from "@/components/ui/VerifiedName";
import {
  addTournamentManagerAction,
  editTournamentSettingsAction,
  listAssignableManagersAction,
  listTournamentManagersAction,
  removeTournamentManagerAction,
} from "@/server/actions/tournamentActions";
import { kindUses, teamSizeFromRoster } from "@/lib/catalog";
import { rosterSize } from "@/lib/schemas/common";
import { eventCity, venuesOf } from "@/lib/venue";
import { PlaceEditor, type VenueDraft } from "@/components/tournament/VenueEditor";

export function EditTournamentSettings({
  tournament,
  started,
  registeredCount,
  fixturesDrawn: _fixturesDrawn,
  knockoutDrawn: _knockoutDrawn,
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
  const { user } = useAuth();
  const isGroups = tournament.TournamentMode === "GROUPS";
  const isTable =
    isGroups || tournament.TournamentMode === "LEAGUE";
  const showCore = true;
  const showReturnLeg = isTable;
  const showGroupCount = isGroups;
  const showAdvance = isGroups;
  const showPoints = isTable;
  const showQualifiers = isGroups;
  const isKnockoutMode =
    isGroups || tournament.TournamentMode === "MULTIPLAYER";
  const showKnockout = isKnockoutMode;
  const showTieBreaker = isTable;
  const showBr = tournament.TournamentMode === "BATTLEROYALE";
  const showSchedule = true;

  type BusyField =
    | ""
    | "shuffle"
    | "type"
    | "size"
    | "roster"
    | "name"
    | "date"
    | "note"
    | "returnLeg"
    | "advance"
    | "groups"
    | "points"
    | "qualifiers"
    | "knockout"
    | "finals"
    | "third"
    | "tie"
    | "br"
    | "schedule"
    | "checkin"
    | "deadline"
    | "venue";

  const [busyField, setBusyField] = useState<BusyField>("");
  const [shuffle, setShuffle] = useState(tournament.Shuffle);
  const [type, setType] = useState(tournament.TournamentType);
  const [size, setSize] = useState(String(tournament.TournamentSize));
  const [roster, setRoster] = useState(
    String(rosterSize(tournament.Team, tournament.RosterCount)),
  );
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
  const [knockoutFinalsSeries, setKnockoutFinalsSeries] = useState(
    tournament.KnockoutFinalsSeries,
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
  const [locationCountry, setLocationCountry] = useState(
    tournament.VenueCountry || "",
  );
  const [locationCity, setLocationCity] = useState(eventCity(tournament));
  const [locationPoint, setLocationPoint] = useState({
    lat: tournament.VenueLat || 0,
    lng: tournament.VenueLng || 0,
  });
  const [venues, setVenues] = useState<VenueDraft[]>(() =>
    venueDraftsOf(tournament),
  );
  const [pendingSave, setPendingSave] = useState<{
    field: BusyField;
    patch: Record<string, unknown>;
    revert: () => void;
  } | null>(null);

  useEffect(() => {
    setShuffle(tournament.Shuffle);
    setType(tournament.TournamentType);
    setSize(String(tournament.TournamentSize));
    setRoster(String(rosterSize(tournament.Team, tournament.RosterCount)));
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
    setKnockoutFinalsSeries(tournament.KnockoutFinalsSeries);
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
    setLocationCountry(tournament.VenueCountry || "");
    setLocationCity(eventCity(tournament));
    setLocationPoint({
      lat: tournament.VenueLat || 0,
      lng: tournament.VenueLng || 0,
    });
    setVenues(venueDraftsOf(tournament));
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

  const askToSave = (
    field: BusyField,
    patch: Record<string, unknown>,
    revert: () => void,
  ) => {
    if (busyField || pendingSave) return;
    setPendingSave({ field, patch, revert });
  };

  const confirmPending = async () => {
    if (!pendingSave || busyField) return;
    const { field, patch, revert } = pendingSave;
    const ok = await save(field, patch);
    if (!ok) revert();
    setPendingSave(null);
  };

  const cancelPending = () => {
    if (busyField) return;
    pendingSave?.revert();
    setPendingSave(null);
  };

  const locked = Boolean(busyField) || Boolean(pendingSave);

  const changeShuffle = (next: Tournament["Shuffle"]) => {
    if (next === tournament.Shuffle || locked) return;
    setShuffle(next);
    askToSave("shuffle", { Shuffle: next }, () =>
      setShuffle(tournament.Shuffle),
    );
  };

  const changeType = (next: Tournament["TournamentType"]) => {
    if (next === tournament.TournamentType || locked) return;
    setType(next);
    askToSave("type", { TournamentType: next }, () =>
      setType(tournament.TournamentType),
    );
  };

  const changeReturnLeg = (next: boolean) => {
    if (next === tournament.ReturnLeg || locked) return;
    setReturnLeg(next);
    askToSave("returnLeg", { ReturnLeg: next }, () =>
      setReturnLeg(tournament.ReturnLeg),
    );
  };

  const changeGroupCount = (next: number) => {
    if (next === (tournament.GroupCount || 0) || locked) return;
    setGroupCount(String(next));
    askToSave("groups", { GroupCount: next }, () =>
      setGroupCount(String(tournament.GroupCount || 0)),
    );
  };

  const changeQualifiers = (next: boolean) => {
    if (next === tournament.OwnerCanSelectQualifiers || locked) return;
    setPickQualifiers(next);
    askToSave("qualifiers", { OwnerCanSelectQualifiers: next }, () =>
      setPickQualifiers(tournament.OwnerCanSelectQualifiers),
    );
  };

  const saveSize = () => {
    if (locked) return;
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
    askToSave("size", { TournamentSize: value }, () =>
      setSize(String(tournament.TournamentSize)),
    );
  };

  const saveRoster = () => {
    if (locked) return;
    const current = rosterSize(tournament.Team, tournament.RosterCount);
    if (roster === String(current)) return;
    const value = Number(roster);
    if (!Number.isFinite(value) || value < 1 || value > 32) {
      toast.error("Players per team must be between 1 and 32");
      setRoster(String(current));
      return;
    }
    askToSave(
      "roster",
      { RosterCount: value, Team: teamSizeFromRoster(value) },
      () => setRoster(String(current)),
    );
  };

  const saveName = () => {
    if (locked) return;
    const next = name.trim();
    if (next === tournament.Name) return;
    if (next.length < 2) {
      toast.error("Name needs at least two characters");
      setName(tournament.Name);
      return;
    }
    askToSave("name", { Name: next }, () => setName(tournament.Name));
  };

  const saveDate = () => {
    if (locked) return;
    if (date === dateInputValue(tournament.Date)) return;
    if (!date) {
      toast.error("Pick a date");
      setDate(dateInputValue(tournament.Date));
      return;
    }
    askToSave("date", { Date: date }, () =>
      setDate(dateInputValue(tournament.Date)),
    );
  };

  const saveNote = () => {
    if (locked) return;
    const next = note.trim();
    if (next === tournament.Note.trim()) return;
    if (next.length < 1) {
      toast.error("Briefing can't be empty");
      setNote(tournament.Note);
      return;
    }
    askToSave("note", { Note: next }, () => setNote(tournament.Note));
  };

  const saveVenue = () => {
    if (locked) return;
    const nextCountry = locationCountry.trim().toUpperCase();
    const nextCity = locationCity.trim();
    const nextVenues = venues.filter((v) => v.location.trim());
    const currentVenues = venueDraftsOf(tournament);
    const key = (rows: VenueDraft[]) =>
      JSON.stringify(
        rows.map((v) => [v.country.toUpperCase(), v.location.trim()]),
      );
    if (
      nextCountry === (tournament.VenueCountry || "") &&
      nextCity === eventCity(tournament) &&
      key(nextVenues) === key(currentVenues)
    ) {
      return;
    }
    askToSave(
      "venue",
      {
        VenueCountry: nextCountry,
        VenueCity: nextCity,
        VenueLat: locationPoint.lat,
        VenueLng: locationPoint.lng,
        Venues: nextVenues,
      },
      () => {
        setLocationCountry(tournament.VenueCountry || "");
        setLocationCity(eventCity(tournament));
        setLocationPoint({
          lat: tournament.VenueLat || 0,
          lng: tournament.VenueLng || 0,
        });
        setVenues(venueDraftsOf(tournament));
      },
    );
  };

  const saveAdvance = () => {
    if (locked) return;
    const value = Number(advancePerGroup);
    if (value === (tournament.AdvancePerGroup || 2)) return;
    if (!Number.isInteger(value) || value < 1 || value > 8) {
      toast.error("Advance per group must be between 1 and 8");
      setAdvancePerGroup(String(tournament.AdvancePerGroup || 2));
      return;
    }
    askToSave("advance", { AdvancePerGroup: value }, () =>
      setAdvancePerGroup(String(tournament.AdvancePerGroup || 2)),
    );
  };

  const savePoints = () => {
    if (locked) return;
    const win = Number(pointsWin);
    const draw =
      tournament.AllowDraw === false ? 0 : Number(pointsDraw);
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
    askToSave("points", { PointSystem: { Win: win, Draw: draw } }, () => {
      setPointsWin(String(tournament.PointSystem?.Win ?? 3));
      setPointsDraw(String(tournament.PointSystem?.Draw ?? 1));
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-surface-2 bg-surface p-5">
      <div>
        <h3 className="mb-1 font-semibold text-white">Tournament settings</h3>
        <p className="text-sm text-body">
          {started
            ? "You can still edit anything. Rules that change how the event is played wait for every registered player to accept, then you apply them."
            : "You'll be asked to confirm each change."}
        </p>
      </div>

      {tournament.PendingSettingChange ? (
        <SettingChangePanel
          tournamentId={tournament.TournamentId}
          change={tournament.PendingSettingChange}
          currentUserId={user?.user_id}
          canApply
          onUpdated={() => onSaved()}
        />
      ) : null}

      <TournamentCoverPicker
        tournamentId={tournament.TournamentId}
        gameName={tournament.GameName}
        value={tournament.icon}
        onSaved={onSaved}
      />

      <CollapsiblePanel
        title="Event details"
        description="Name, date, description, size, and who can register."
        scroll={false}
      >
        <div className="flex flex-col gap-4">
          {showCore ? (
            <>
              <Input
                label={busyField === "name" ? "Name (saving…)" : "Name"}
                value={name}
                disabled={locked}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveName();
                  }
                }}
              />

              <DateInput
                label={busyField === "date" ? "Date (saving…)" : "Date"}
                value={date}
                disabled={locked}
                onChange={(e) => setDate(e.target.value)}
                onBlur={saveDate}
              />

              <TextArea
                label={busyField === "note" ? "Briefing (saving…)" : "Briefing"}
                rows={3}
                value={note}
                disabled={locked}
                onChange={(e) => setNote(e.target.value)}
                onBlur={saveNote}
              />

              {kindUses([], tournament.CatalogKind).usesVenue ? (
                <div className="flex flex-col gap-3">
                  <PlaceEditor
                    country={locationCountry}
                    city={locationCity}
                    cityLat={locationPoint.lat}
                    cityLng={locationPoint.lng}
                    onCountry={setLocationCountry}
                    onCity={setLocationCity}
                    onCityPlace={(place) => {
                      setLocationCity(place.city);
                      if (place.country) setLocationCountry(place.country);
                      setLocationPoint({ lat: place.lat, lng: place.lng });
                    }}
                    venues={venues}
                    onVenues={setVenues}
                    disabled={locked}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="self-start"
                    disabled={locked}
                    loading={busyField === "venue"}
                    onClick={saveVenue}
                  >
                    Save location
                  </Button>
                </div>
              ) : null}

              <Select
                label={
                  busyField === "shuffle" ? "Draw order (saving…)" : "Draw order"
                }
                value={shuffle}
                disabled={locked}
                onChange={(e) =>
                  changeShuffle(e.target.value as Tournament["Shuffle"])
                }
                options={[
                  { label: "Automatic", value: "AUTOMATIC" },
                  { label: "Manual", value: "MANUAL" },
                ]}
              />

              <Select
                label={
                  busyField === "type"
                    ? "Who can register (saving…)"
                    : "Who can register"
                }
                value={type}
                disabled={locked}
                onChange={(e) =>
                  changeType(e.target.value as Tournament["TournamentType"])
                }
                options={[
                  { label: "Invite only", value: "PRIVATE" },
                  { label: "Anyone can join", value: "PUBLIC" },
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
                disabled={locked}
                onChange={(e) => setSize(e.target.value)}
                onBlur={saveSize}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveSize();
                  }
                }}
              />

              <Input
                label={
                  busyField === "roster"
                    ? "Players per team (saving…)"
                    : "Players per team"
                }
                type="number"
                min={1}
                max={32}
                value={roster}
                disabled={locked}
                onChange={(e) => setRoster(e.target.value)}
                onBlur={saveRoster}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveRoster();
                  }
                }}
              />
            </>
          ) : null}
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Format and rules"
        description="How matches are played, scored, and how teams advance."
        scroll={false}
      >
        <div className="flex flex-col gap-4">
          {showReturnLeg ? (
            <Select
              label={
                busyField === "returnLeg" ? "Return leg (saving…)" : "Return leg"
              }
              value={returnLeg ? "true" : "false"}
              disabled={locked}
              onChange={(e) => changeReturnLeg(e.target.value === "true")}
              options={[
                { label: "Single round", value: "false" },
                { label: "Home and away", value: "true" },
              ]}
            />
          ) : null}

          {showPoints ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                type="number"
                min={0}
                max={20}
                label={busyField === "points" ? "Win points (saving…)" : "Win points"}
                value={pointsWin}
                disabled={locked}
                onChange={(e) => setPointsWin(e.target.value)}
                onBlur={savePoints}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    savePoints();
                  }
                }}
              />
              {tournament.AllowDraw !== false ? (
              <Input
                type="number"
                min={0}
                max={20}
                label={
                  busyField === "points" ? "Draw points (saving…)" : "Draw points"
                }
                value={pointsDraw}
                disabled={locked}
                onChange={(e) => setPointsDraw(e.target.value)}
                onBlur={savePoints}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    savePoints();
                  }
                }}
              />
              ) : null}
            </div>
          ) : null}

          {showGroupCount ? (
            <Select
              label={
                busyField === "groups"
                  ? "Number of groups (saving…)"
                  : "Number of groups"
              }
              value={groupCount}
              disabled={locked}
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

          {showAdvance ? (
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
              disabled={locked}
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

          {showQualifiers ? (
            <Select
              label={
                busyField === "qualifiers"
                  ? "Ties on the table (saving…)"
                  : "Ties on the table"
              }
              value={pickQualifiers ? "true" : "false"}
              disabled={locked}
              onChange={(e) => changeQualifiers(e.target.value === "true")}
              options={[
                { label: "Table order decides", value: "false" },
                { label: "Host picks if teams are level", value: "true" },
              ]}
            />
          ) : null}

          {showTieBreaker ? (
            <Select
              label={busyField === "tie" ? "Tie-break (saving…)" : "Table tie-break"}
              value={tieBreaker}
              disabled={locked}
              onChange={(e) => {
                const next = e.target.value as Tournament["TieBreaker"];
                if (next === tournament.TieBreaker || locked) return;
                setTieBreaker(next);
                askToSave("tie", { TieBreaker: next }, () =>
                  setTieBreaker(tournament.TieBreaker || "GOAL_DIFF"),
                );
              }}
              options={[
                { label: "Goal difference", value: "GOAL_DIFF" },
                { label: "Head to head", value: "HEAD_TO_HEAD" },
              ]}
            />
          ) : null}

          {showKnockout ? (
            <>
              <Select
                label={
                  busyField === "knockout"
                    ? "Knockout ties (saving…)"
                    : "Knockout ties"
                }
                value={knockoutFormat}
                disabled={locked}
                onChange={(e) => {
                  const next = e.target.value as Tournament["KnockoutFormat"];
                  if (next === (tournament.KnockoutFormat || "SINGLE") || locked)
                    return;
                  setKnockoutFormat(next);
                  if (next === "SINGLE") setKnockoutFinalsSeries(false);
                  askToSave(
                    "knockout",
                    {
                      KnockoutFormat: next,
                      ...(next === "SINGLE" ? { KnockoutFinalsSeries: false } : {}),
                    },
                    () => {
                      setKnockoutFormat(tournament.KnockoutFormat || "SINGLE");
                      setKnockoutFinalsSeries(tournament.KnockoutFinalsSeries);
                    },
                  );
                }}
                options={[
                  { label: "Single match", value: "SINGLE" },
                  { label: "Two legs (aggregate)", value: "TWO_LEG" },
                  { label: "Best of 3", value: "BO3" },
                  { label: "Best of 5", value: "BO5" },
                ]}
              />
              {knockoutFormat !== "SINGLE" ? (
                <Select
                  label={
                    busyField === "finals"
                      ? "Final (saving…)"
                      : "Final"
                  }
                  value={knockoutFinalsSeries ? "true" : "false"}
                  disabled={locked}
                  onChange={(e) => {
                    const next = e.target.value === "true";
                    if (next === tournament.KnockoutFinalsSeries || locked) return;
                    setKnockoutFinalsSeries(next);
                    askToSave("finals", { KnockoutFinalsSeries: next }, () =>
                      setKnockoutFinalsSeries(tournament.KnockoutFinalsSeries),
                    );
                  }}
                  options={[
                    { label: "One match", value: "false" },
                    {
                      label:
                        knockoutFormat === "TWO_LEG"
                          ? "Two legs"
                          : knockoutFormat === "BO3"
                            ? "Best of 3"
                            : "Best of 5",
                      value: "true",
                    },
                  ]}
                />
              ) : null}
              <Select
                label={
                  busyField === "third" ? "Third place (saving…)" : "Third place"
                }
                value={thirdPlace ? "true" : "false"}
                disabled={locked}
                onChange={(e) => {
                  const next = e.target.value === "true";
                  if (next === tournament.ThirdPlace || locked) return;
                  setThirdPlace(next);
                  askToSave("third", { ThirdPlace: next }, () =>
                    setThirdPlace(tournament.ThirdPlace),
                  );
                }}
                options={[
                  { label: "No 3rd place match", value: "false" },
                  { label: "Play for 3rd", value: "true" },
                ]}
              />
            </>
          ) : null}

          {showBr ? (
            <>
              <Input
                type="number"
                min={1}
                max={20}
                label={busyField === "br" ? "Lobbies (saving…)" : "Lobbies"}
                value={brLobbies}
                disabled={locked}
                onChange={(e) => setBrLobbies(e.target.value)}
                onBlur={() => {
                  const value = Math.min(20, Math.max(1, Number(brLobbies) || 1));
                  if (value === (tournament.BrLobbyCount || 1) || locked) return;
                  askToSave("br", { BrLobbyCount: value }, () =>
                    setBrLobbies(String(tournament.BrLobbyCount || 1)),
                  );
                }}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  type="number"
                  min={0}
                  label="Points per kill"
                  value={brKillPoints}
                  disabled={locked}
                  onChange={(e) => setBrKillPoints(e.target.value)}
                  onBlur={() => {
                    const value = Math.max(0, Number(brKillPoints) || 0);
                    if (value === (tournament.BrKillPoints ?? 1) || locked) return;
                    askToSave("br", { BrKillPoints: value }, () =>
                      setBrKillPoints(String(tournament.BrKillPoints ?? 1)),
                    );
                  }}
                />
                <Input
                  type="number"
                  min={0}
                  label="First blood points"
                  value={brFirstBlood}
                  disabled={locked}
                  onChange={(e) => setBrFirstBlood(e.target.value)}
                  onBlur={() => {
                    const value = Math.max(0, Number(brFirstBlood) || 0);
                    if (value === (tournament.BrFirstBloodPoints ?? 0) || locked)
                      return;
                    askToSave("br", { BrFirstBloodPoints: value }, () =>
                      setBrFirstBlood(String(tournament.BrFirstBloodPoints ?? 0)),
                    );
                  }}
                />
              </div>
              <Input
                label="Placement points (1st, 2nd, …)"
                value={brPlacement}
                disabled={locked}
                onChange={(e) => setBrPlacement(e.target.value)}
                onBlur={() => {
                  if (locked) return;
                  const pts = brPlacement
                    .split(/[,\s]+/)
                    .map((n) => Number(n))
                    .filter((n) => Number.isFinite(n));
                  const current = tournament.BrPlacementPoints ?? [
                    12, 9, 7, 5, 4, 3, 2, 1,
                  ];
                  if (pts.join(",") === current.join(",")) return;
                  askToSave("br", { BrPlacementPoints: pts }, () =>
                    setBrPlacement(current.join(",")),
                  );
                }}
              />
            </>
          ) : null}
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Schedule and check-in"
        description="Registration deadline, check-in window, and match times."
        scroll={false}
      >
        <div className="flex flex-col gap-4">
          {showCore ? (
            <>
              <DateInput
                label={
                  busyField === "deadline"
                    ? "Registration closes (saving…)"
                    : "Registration closes"
                }
                value={deadline}
                disabled={locked}
                onChange={(e) => setDeadline(e.target.value)}
                onBlur={() => {
                  if (
                    locked ||
                    deadline ===
                      dateInputValue(tournament.RegistrationDeadline || "")
                  )
                    return;
                  askToSave("deadline", { RegistrationDeadline: deadline }, () =>
                    setDeadline(
                      dateInputValue(tournament.RegistrationDeadline || ""),
                    ),
                  );
                }}
              />
              <Select
                label={busyField === "checkin" ? "Check-in (saving…)" : "Check-in"}
                value={checkInRequired ? "true" : "false"}
                disabled={locked}
                onChange={(e) => {
                  const next = e.target.value === "true";
                  if (next === tournament.CheckInRequired || locked) return;
                  setCheckInRequired(next);
                  askToSave("checkin", { CheckInRequired: next }, () =>
                    setCheckInRequired(tournament.CheckInRequired),
                  );
                }}
                options={[
                  { label: "No check-in", value: "false" },
                  { label: "Teams must check in", value: "true" },
                ]}
              />
              {checkInRequired ? (
                <DateInput
                  label="Check-in closes"
                  value={checkInCloses}
                  disabled={locked}
                  onChange={(e) => setCheckInCloses(e.target.value)}
                  onBlur={() => {
                    if (
                      locked ||
                      checkInCloses ===
                        dateInputValue(tournament.CheckInCloses || "")
                    )
                      return;
                    askToSave("checkin", { CheckInCloses: checkInCloses }, () =>
                      setCheckInCloses(
                        dateInputValue(tournament.CheckInCloses || ""),
                      ),
                    );
                  }}
                />
              ) : null}
            </>
          ) : null}

          {showSchedule ? (
            <>
              <DateTimeInput
                label={
                  busyField === "schedule" ? "First match (saving…)" : "First match"
                }
                value={firstMatchAt}
                disabled={locked}
                onChange={(e) => setFirstMatchAt(e.target.value)}
                onBlur={() => {
                  if (locked || firstMatchAt === (tournament.FirstMatchAt || ""))
                    return;
                  askToSave("schedule", { FirstMatchAt: firstMatchAt }, () =>
                    setFirstMatchAt(tournament.FirstMatchAt || ""),
                  );
                }}
              />
              <Input
                type="number"
                min={0}
                label="Minutes between matches"
                value={matchInterval}
                disabled={locked}
                onChange={(e) => setMatchInterval(e.target.value)}
                onBlur={() => {
                  const value = Math.max(0, Number(matchInterval) || 0);
                  if (value === (tournament.MatchIntervalMinutes || 0) || locked)
                    return;
                  askToSave("schedule", { MatchIntervalMinutes: value }, () =>
                    setMatchInterval(String(tournament.MatchIntervalMinutes || 0)),
                  );
                }}
              />
            </>
          ) : null}
        </div>
      </CollapsiblePanel>

      <Confirm
        open={Boolean(pendingSave)}
        title={
          started && pendingSave && isSeriousSettingPatch(pendingSave.patch)
            ? "Ask everyone to accept?"
            : "Update this tournament?"
        }
        message={
          started && pendingSave && isSeriousSettingPatch(pendingSave.patch)
            ? "This changes how the tournament runs. It will not apply until every registered player accepts. Then you can apply it."
            : "Are you sure you want to update this?"
        }
        confirmLabel={
          started && pendingSave && isSeriousSettingPatch(pendingSave.patch)
            ? "Ask everyone"
            : "Yes, update"
        }
        confirmVariant="default"
        loading={Boolean(busyField)}
        onConfirm={() => void confirmPending()}
        onCancel={cancelPending}
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
        <Loader variant="compact" />
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
                      <VerifiedName
                        name={managerName(m)}
                        verified={m.verified}
                        className="text-sm text-white"
                      />
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
                      <VerifiedName
                        name={managerName(c)}
                        verified={c.verified}
                        className="text-sm text-white"
                      />
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

/**
 * Venue rows as editable drafts. `venuesOf` already carries the saved
 * coordinates, so a venue the host picked earlier stays pinned through an edit.
 */
function venueDraftsOf(t: Tournament): VenueDraft[] {
  return venuesOf(t).map(({ country, location, lat, lng }) => ({
    country,
    location,
    lat,
    lng,
  }));
}
