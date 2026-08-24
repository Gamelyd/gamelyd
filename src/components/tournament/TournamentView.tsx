"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Tournament } from "@/lib/schemas/tournament";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { Draw } from "@/lib/schemas/draw";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Confirm } from "@/components/ui/Confirm";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { TeamCard } from "./TeamCard";
import { Fixture, roundLabel } from "./Fixture";
import { RegisterTeam } from "./RegisterTeam";
import {
  drawBrAction,
  getDrawsAction,
  newDrawAction,
} from "@/server/actions/drawActions";
import {
  deleteTournamentAction,
  groupTournamentAction,
} from "@/server/actions/tournamentActions";
import { hydrateDrawIcons, iconMapFromTeams } from "@/lib/teamIcons";

type Tab = "details" | "teams" | "fixtures" | "register" | "manage";

export function TournamentView({
  tournament,
  initialParticipants,
  initialDraws,
}: {
  tournament: Tournament;
  initialParticipants: RegisterTournament[];
  initialDraws: Draw[];
}) {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("details");
  const [participants, setParticipants] =
    useState<RegisterTournament[]>(initialParticipants);
  const [draws, setDraws] = useState<Draw[]>(initialDraws);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOwner = user?.user_id === tournament.User_id;
  const canManage = isOwner || user?.user_type === "ADMIN";

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "details", label: "Details", show: true },
    { id: "teams", label: `Teams (${participants.length})`, show: true },
    { id: "fixtures", label: "Fixtures", show: true },
    { id: "register", label: "Register", show: !!user },
    { id: "manage", label: "Manage", show: canManage },
  ];

  const teamIcons = useMemo(
    () => iconMapFromTeams(participants),
    [participants],
  );

  const drawsByStage = useMemo(() => {
    const map = new Map<number, Draw[]>();
    for (const d of draws) {
      const list = map.get(d.Stage) ?? [];
      list.push(hydrateDrawIcons(d, teamIcons));
      map.set(d.Stage, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [draws, teamIcons]);

  const refreshDraws = async () => {
    const result = await getDrawsAction(tournament.TournamentId);
    if (result.ok) setDraws(result.data);
  };

  const handleDraw = async () => {
    setBusy(true);
    const action =
      tournament.TournamentMode === "BATTLEROYALE"
        ? drawBrAction
        : newDrawAction;
    const result = await action({ TournamentId: tournament.TournamentId });
    setBusy(false);
    if (result.ok) {
      toast.success("Draw created");
      await refreshDraws();
      setTab("fixtures");
    } else {
      toast.error(result.error);
    }
  };

  const handleGroup = async () => {
    setBusy(true);
    const result = await groupTournamentAction(tournament.TournamentId);
    setBusy(false);
    if (result.ok) toast.success("Groups created");
    else toast.error(result.error);
  };

  const handleDelete = async () => {
    setBusy(true);
    const result = await deleteTournamentAction(tournament.TournamentId);
    setBusy(false);
    setConfirmDelete(false);
    if (result.ok) {
      toast.success("Tournament updated");
      router.push("/");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div>
      <section className="gradient-brand-page">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="flex flex-wrap items-center gap-3">
            <Tag payment={tournament.Payment} />
            <span className="rounded-full bg-black/20 px-3 py-1 text-xs text-white">
              {tournament.TournamentMode}
            </span>
          </div>
          <h1 className="mt-4 font-display text-4xl text-white md:text-5xl">
            {tournament.Name}
          </h1>
          <p className="mt-2 text-white/80">
            {tournament.GameName} · {tournament.Date}
          </p>
          {tournament.OrgId && tournament.OrgName && (
            <Link
              href={`/org/${tournament.OrgId}`}
              className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-black/20 px-3 py-1.5 text-sm text-white transition-colors hover:bg-black/30"
            >
              {tournament.OrgIcon && (
                <Image
                  src={tournament.OrgIcon}
                  alt={tournament.OrgName}
                  width={20}
                  height={20}
                  className="rounded-full object-cover"
                />
              )}
              Hosted by {tournament.OrgName}
            </Link>
          )}
        </div>
      </section>

      <div className="border-b border-surface-2 bg-nav">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap border-b-2 px-4 py-4 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-body hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-5 py-10">
        {tab === "details" && <Details tournament={tournament} />}

        {tab === "teams" && (
          <div className="flex flex-wrap justify-center gap-5 py-2">
            {participants.length === 0 ? (
              <p className="w-full py-16 text-center text-body">
                No registered teams yet
              </p>
            ) : (
              participants.map((p) => (
                <TeamCard key={p.RegisterTournamentId || p._id} team={p} />
              ))
            )}
          </div>
        )}

        {tab === "fixtures" && (
          <div className="space-y-10">
            {drawsByStage.length === 0 ? (
              <p className="py-16 text-center text-body">
                No draws available, come back later
              </p>
            ) : (
              drawsByStage.map(([stage, stageDraws]) => (
                <div key={stage}>
                  <div className="mb-8 bg-primary-panel px-4 py-5 text-center font-display text-[23px] leading-none tracking-wide text-white">
                    {roundLabel(stageDraws.length, stage)}
                  </div>
                  <div className="flex flex-col items-center gap-8">
                    {stageDraws.map((d) => (
                      <Fixture
                        key={d.DrawId || d._id}
                        draw={d}
                        canManage={canManage}
                        onUpdated={(updated) =>
                          setDraws((prev) =>
                            prev.map((x) =>
                              x.DrawId === updated.DrawId ? updated : x,
                            ),
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "register" && (
          <RegisterTeam
            tournamentId={tournament.TournamentId}
            teamSize={tournament.Team}
            onRegistered={(reg) => {
              setParticipants((prev) => [...prev, reg]);
              toast.success("Team registered");
              setTab("teams");
            }}
          />
        )}

        {tab === "manage" && canManage && (
          <div className="flex max-w-md flex-col gap-4">
            <div className="rounded-xl border border-surface-2 bg-surface p-5">
              <h3 className="mb-1 font-semibold text-white">Draw fixtures</h3>
              <p className="mb-4 text-sm text-body">
                Generate {tournament.Shuffle.toLowerCase()} fixtures from the
                registered teams.
              </p>
              <Button loading={busy} onClick={handleDraw}>
                {draws.length > 0 ? "Draw next stage" : "Create draw"}
              </Button>
            </div>

            {tournament.TournamentMode === "GROUPS" && (
              <div className="rounded-xl border border-surface-2 bg-surface p-5">
                <h3 className="mb-1 font-semibold text-white">Group teams</h3>
                <p className="mb-4 text-sm text-body">
                  Split registered teams into groups (min 7 teams).
                </p>
                <Button variant="active" loading={busy} onClick={handleGroup}>
                  Create groups
                </Button>
              </div>
            )}

            <div className="rounded-xl border border-lose/30 bg-surface p-5">
              <h3 className="mb-1 font-semibold text-white">Danger zone</h3>
              <p className="mb-4 text-sm text-body">
                Delete this tournament. This can be toggled.
              </p>
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete tournament
              </Button>
            </div>
          </div>
        )}
      </section>

      <Confirm
        open={confirmDelete}
        message="Are you sure you want to delete this tournament?"
        confirmLabel="Delete"
        loading={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function Details({ tournament }: { tournament: Tournament }) {
  const rows: { label: string; value: string }[] = [
    { label: "Game", value: tournament.GameName },
    { label: "Mode", value: tournament.TournamentMode },
    { label: "Team size", value: tournament.Team },
    { label: "Visibility", value: tournament.TournamentType },
    { label: "Payment", value: tournament.Payment },
    { label: "Draw", value: tournament.Shuffle },
    { label: "Size", value: `${tournament.TournamentSize} teams` },
    { label: "Date", value: tournament.Date },
    { label: "Platform", value: tournament.Platform || "—" },
    {
      label: "Registration fee",
      value:
        tournament.Payment === "PAID"
          ? `₦${tournament.RegistrationAmount.toLocaleString()}`
          : "Free",
    },
    {
      label: "Prize pool",
      value: tournament.Amount ? `₦${tournament.Amount.toLocaleString()}` : "—",
    },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h3 className="mb-3 text-lg font-semibold text-white">About</h3>
        <p className="whitespace-pre-line text-body">{tournament.Note}</p>
      </div>
      <div className="rounded-xl border border-surface-2 bg-surface p-5">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-surface-2 last:border-0">
                <td className="py-2.5 text-body">{r.label}</td>
                <td className="py-2.5 text-right font-medium text-white">
                  {r.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
