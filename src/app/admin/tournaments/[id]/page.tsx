"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import type { Tournament } from "@/lib/schemas/tournament";
import type { RegisterTournament } from "@/lib/schemas/register";
import {
  adminGetTournamentAction,
  adminResetTournamentAction,
  adminSetOwnerCanAddParticipantsAction,
  adminSetOwnerCanReshuffleGroupsAction,
  adminSetOwnerCanSelectQualifiersAction,
  adminToggleDeleteTournamentAction,
  adminToggleFeaturedTournamentAction,
  adminToggleSuspendTournamentAction,
} from "@/server/actions/adminActions";
import {
  AddParticipants,
  RegisteredTeamsList,
} from "@/components/tournament/AddParticipants";

type Pending = "reset" | "suspend" | "delete" | "banner" | null;

export default function AdminTournamentManagePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const toast = useToast();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [drawCount, setDrawCount] = useState(0);
  const [participants, setParticipants] = useState<RegisterTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  useEffect(() => {
    let activeReq = true;
    void adminGetTournamentAction(id).then((result) => {
      if (!activeReq) return;
      if (result.ok) {
        setTournament(result.data.tournament);
        setDrawCount(result.data.drawCount);
        setParticipants(result.data.participants);
      } else {
        setTournament(null);
        toast.error(result.error);
      }
      setLoading(false);
    });
    return () => {
      activeReq = false;
    };
  }, [id, reload, toast]);

  const run = async (
    action: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    setPending(null);
    if (result.ok) {
      toast.success(result.message ?? "Done");
      setReload((r) => r + 1);
    } else {
      toast.error(result.error ?? "Something went wrong");
    }
  };

  if (loading && !tournament) {
    return <p className="text-body">Loading…</p>;
  }

  if (!tournament) {
    return <p className="text-body">Tournament not found.</p>;
  }

  const canReset = tournament.Start || tournament.IsDrawn || drawCount > 0;

  return (
    <div>
      <Link
        href="/admin/tournaments"
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        ← All tournaments
      </Link>

      <div className="mb-8 flex flex-wrap items-start gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
          {tournament.icon ? (
            <Image
              src={tournament.icon}
              alt=""
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl text-white">{tournament.Name}</h1>
          <p className="mt-1 text-sm text-body">
            {tournament.GameName} · {tournament.TournamentMode} ·{" "}
            {tournament.Date}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusChip
              label={tournament.Start ? "Started" : "Open"}
              tone={tournament.Start ? "warn" : "ok"}
            />
            {tournament.IsDrawn ? (
              <StatusChip label="Draws generated" tone="warn" />
            ) : null}
            {tournament.Featured ? (
              <StatusChip label="On banner" tone="ok" />
            ) : null}
            {tournament.IsSuspended ? (
              <StatusChip label="Suspended" tone="warn" />
            ) : null}
            {tournament.IsDeleted ? (
              <StatusChip label="Deleted" tone="bad" />
            ) : null}
          </div>
        </div>
        <Link href={`/tournament/${tournament._id}`}>
          <Button variant="outline">View tournament</Button>
        </Link>
      </div>

      <div className="mb-6 rounded-2xl border border-surface-2 bg-surface p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Item label="Stage" value={String(tournament.Stage || 0)} />
          <Item label="Draws" value={String(drawCount)} />
          <Item
            label="Size"
            value={`${tournament.TournamentSize} teams`}
          />
          <Item label="Shuffle" value={tournament.Shuffle} />
          {tournament.OrgName ? (
            <Item label="Organization" value={tournament.OrgName} />
          ) : null}
          <Item label="Registered" value={`${participants.length} teams`} />
        </dl>
      </div>

      <div className="mb-6 rounded-2xl border border-surface-2 bg-surface p-5">
        <h2 className="mb-1 text-lg font-semibold text-white">
          Owner permissions
        </h2>
        <p className="mb-4 text-sm text-body">
          Turn these on if the tournament owner should be able to do them.
          When they are off, only you can.
        </p>
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm text-white">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={tournament.OwnerCanAddParticipants}
              disabled={busy}
              onChange={(e) => {
                const enabled = e.target.checked;
                void run(async () => {
                  const result =
                    await adminSetOwnerCanAddParticipantsAction(id, enabled);
                  if (result.ok) {
                    setTournament((t) =>
                      t
                        ? { ...t, OwnerCanAddParticipants: result.data }
                        : t,
                    );
                  }
                  return result;
                });
              }}
            />
            Allow owners to add players
          </label>
          {tournament.TournamentMode === "GROUPS" ? (
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-3 text-sm text-white">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={tournament.OwnerCanReshuffleGroups}
                  disabled={busy}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    void run(async () => {
                      const result =
                        await adminSetOwnerCanReshuffleGroupsAction(
                          id,
                          enabled,
                        );
                      if (result.ok) {
                        setTournament((t) =>
                          t
                            ? { ...t, OwnerCanReshuffleGroups: result.data }
                            : t,
                        );
                      }
                      return result;
                    });
                  }}
                />
                Allow owners to reshuffle groups
              </label>
              <label className="flex cursor-pointer items-center gap-3 text-sm text-white">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={Boolean(tournament.OwnerCanSelectQualifiers)}
                  disabled={busy}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    void run(async () => {
                      const result =
                        await adminSetOwnerCanSelectQualifiersAction(
                          id,
                          enabled,
                        );
                      if (result.ok) {
                        setTournament((t) =>
                          t
                            ? { ...t, OwnerCanSelectQualifiers: result.data }
                            : t,
                        );
                      }
                      return result;
                    });
                  }}
                />
                Let the organiser break points ties
              </label>
              <p className="-mt-1 ml-7 text-xs text-body">
                On: if teams finish level on points, the organiser picks who
                goes through and why. Off: the table order decides.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-surface-2 bg-surface p-5">
        <h2 className="mb-1 text-lg font-semibold text-white">
          Add players
        </h2>
        <p className="mb-4 text-sm text-body">
          Add existing users to this tournament without them registering
          themselves. Only possible before the tournament starts.
        </p>
        <AddParticipants
          tournamentId={tournament.TournamentId || id}
          teamSize={tournament.Team}
          started={tournament.Start}
          existingUserIds={participants.flatMap((p) =>
            (p.Players ?? []).map((pl) => pl.User_id),
          )}
          onAdded={(registration) =>
            setParticipants((prev) => [...prev, registration])
          }
        />
        <RegisteredTeamsList participants={participants} />
      </div>

      <div className="mb-6 rounded-2xl border border-surface-2 bg-surface p-5">
        <h2 className="mb-1 text-lg font-semibold text-white">
          Reset start
        </h2>
        <p className="mb-4 text-sm text-body">
          Use this if the tournament was started by mistake. All generated
          draws and fixtures are deleted, the tournament is marked as not
          started, and new teams can join again. Registered teams are kept.
        </p>
        <Button
          variant="danger"
          disabled={!canReset}
          onClick={() => setPending("reset")}
        >
          Reset tournament
        </Button>
        {!canReset ? (
          <p className="mt-3 text-xs text-body">
            This tournament has not been started and has no draws.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={tournament.Featured ? "active" : "dark"}
          onClick={() => setPending("banner")}
        >
          {tournament.Featured ? "Remove banner" : "Add to banner"}
        </Button>
        <Button variant="dark" onClick={() => setPending("suspend")}>
          {tournament.IsSuspended ? "Unsuspend" : "Suspend"}
        </Button>
        <Button
          variant={tournament.IsDeleted ? "dark" : "danger"}
          onClick={() => setPending("delete")}
        >
          {tournament.IsDeleted ? "Restore" : "Delete"}
        </Button>
      </div>

      <Confirm
        open={pending === "reset"}
        title="Reset this tournament?"
        message="All generated draws and fixtures will be deleted. The tournament will go back to open registration. Registered teams are kept. This cannot be undone."
        confirmLabel="Yes, reset"
        loading={busy}
        onConfirm={() => run(() => adminResetTournamentAction(id))}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
      />
      <Confirm
        open={pending === "banner"}
        title={
          tournament.Featured ? "Remove from banner?" : "Add to home banner?"
        }
        message={
          tournament.Featured
            ? "This tournament will no longer appear on the home banner."
            : "This tournament will appear on the home banner. Adding a third replaces the oldest."
        }
        confirmLabel={tournament.Featured ? "Remove" : "Add to banner"}
        confirmVariant="default"
        loading={busy}
        onConfirm={() => run(() => adminToggleFeaturedTournamentAction(id))}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
      />
      <Confirm
        open={pending === "suspend"}
        title={
          tournament.IsSuspended
            ? "Unsuspend this tournament?"
            : "Suspend this tournament?"
        }
        message={
          tournament.IsSuspended
            ? "The tournament will be visible and usable again."
            : "The tournament will be hidden from public listings until you unsuspend it."
        }
        confirmLabel={tournament.IsSuspended ? "Unsuspend" : "Suspend"}
        confirmVariant={tournament.IsSuspended ? "default" : "danger"}
        loading={busy}
        onConfirm={() => run(() => adminToggleSuspendTournamentAction(id))}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
      />
      <Confirm
        open={pending === "delete"}
        title={
          tournament.IsDeleted
            ? "Restore this tournament?"
            : "Delete this tournament?"
        }
        message={
          tournament.IsDeleted
            ? "The tournament will be restored and visible again."
            : "The tournament will be marked as deleted. You can restore it later."
        }
        confirmLabel={tournament.IsDeleted ? "Restore" : "Delete"}
        confirmVariant={tournament.IsDeleted ? "default" : "danger"}
        loading={busy}
        onConfirm={() => run(() => adminToggleDeleteTournamentAction(id))}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
      />
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-body">{label}</dt>
      <dd className="mt-0.5 font-medium text-white">{value}</dd>
    </div>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "warn" | "bad";
}) {
  const cls =
    tone === "ok"
      ? "text-win"
      : tone === "bad"
        ? "text-lose"
        : "text-pink";
  return (
    <span className={`rounded-full bg-black/20 px-2.5 py-1 text-xs ${cls}`}>
      {label}
    </span>
  );
}
