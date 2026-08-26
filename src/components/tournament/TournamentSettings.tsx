"use client";

import { useEffect, useState } from "react";
import type { Tournament, TournamentManager } from "@/lib/schemas/tournament";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
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
  onSaved,
}: {
  tournament: Tournament;
  started: boolean;
  registeredCount: number;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busyField, setBusyField] = useState<"" | "shuffle" | "type" | "size">(
    "",
  );
  const [shuffle, setShuffle] = useState(tournament.Shuffle);
  const [type, setType] = useState(tournament.TournamentType);
  const [size, setSize] = useState(String(tournament.TournamentSize));
  const [confirmVisibility, setConfirmVisibility] = useState(false);

  if (started) {
    return (
      <div className="rounded-xl border border-surface-2 bg-surface p-5">
        <h3 className="mb-1 font-semibold text-white">Tournament settings</h3>
        <p className="text-sm text-body">
          The tournament has started, so its settings are locked. You can still
          record results from the Run and Fixtures tabs.
        </p>
      </div>
    );
  }

  const save = async (
    field: "shuffle" | "type" | "size",
    patch: Record<string, unknown>,
  ) => {
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
          Editable while registration is open. Changes save automatically.
        </p>
      </div>

      <Select
        label={busyField === "shuffle" ? "Draw order — saving…" : "Draw order"}
        value={shuffle}
        disabled={Boolean(busyField)}
        onChange={(e) => changeShuffle(e.target.value as Tournament["Shuffle"])}
        options={[
          { label: "Automatic", value: "AUTOMATIC" },
          { label: "Manual", value: "MANUAL" },
        ]}
      />

      <Select
        label={busyField === "type" ? "Visibility — saving…" : "Visibility"}
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
          busyField === "size" ? "Tournament size — saving…" : "Tournament size"
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
        Add people from your organization who can help run this tournament —
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
