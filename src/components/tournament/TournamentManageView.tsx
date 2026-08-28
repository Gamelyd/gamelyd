"use client";

import { useState } from "react";
import { CatalogImage } from "@/components/ui/CatalogImage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { AddParticipants, upsertParticipant } from "@/components/tournament/AddParticipants";
import {
  EditTournamentSettings,
  ManagerSettings,
} from "@/components/tournament/TournamentSettings";
import { TournamentStageControls } from "@/components/tournament/TournamentStageControls";
import { SelectQualifiers } from "@/components/tournament/SelectQualifiers";
import { DisqualifyTeams } from "@/components/tournament/DisqualifyTeams";
import { TournamentAnnouncements } from "@/components/tournament/TournamentAnnouncements";
import { HostInvitePanel } from "@/components/tournament/HostInvitePanel";
import { deleteTournamentAction } from "@/server/actions/tournamentActions";
import type { Tournament, GroupQualifier } from "@/lib/schemas/tournament";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { Draw } from "@/lib/schemas/draw";
import { isGroupDraw, isKnockoutDraw } from "@/lib/drawKind";
import { computeLeagueStandings } from "@/lib/leagueStandings";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { rosterSize } from "@/lib/schemas/common";
import { PageTour } from "@/components/help/PageTour";
import { MANAGE_TOUR } from "@/components/help/tours";
import { helpTarget } from "@/lib/help";

export function TournamentManageView({
  tournament,
  initialParticipants,
  initialDraws,
  isPlatformAdmin,
  canAdminister,
}: {
  tournament: Tournament;
  initialParticipants: RegisterTournament[];
  initialDraws: Draw[];
  isPlatformAdmin: boolean;
  canAdminister: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [participants, setParticipants] =
    useState<RegisterTournament[]>(initialParticipants);
  const [qualifiers, setQualifiers] = useState<GroupQualifier[]>(
    tournament.Qualifiers ?? [],
  );
  const [disqualifiedTeams, setDisqualifiedTeams] = useState(
    tournament.DisqualifiedTeams ?? [],
  );
  const [announcements, setAnnouncements] = useState(
    tournament.Announcements ?? [],
  );
  const [draws, setDraws] = useState(initialDraws);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canAdd =
    isPlatformAdmin || (canAdminister && tournament.OwnerCanAddParticipants);
  const needed = rosterSize(tournament.Team, tournament.RosterCount);
  const groupDraws = draws.filter(isGroupDraw);
  const knockoutDrawn = draws.some(isKnockoutDraw);
  const allGroupPlayed =
    groupDraws.length > 0 && groupDraws.every((d) => d.Played);
  const showQualifierPicker =
    tournament.TournamentMode === "GROUPS" &&
    tournament.OwnerCanSelectQualifiers &&
    (tournament.Groups ?? []).length > 0;

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
    <div className="mx-auto max-w-4xl px-page py-10">
      <PageTour tour={MANAGE_TOUR} />
      <Link
        href={`/tournament/${tournament.TournamentId}`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        ← Back to tournament
      </Link>

      <div className="mb-8 flex flex-wrap items-start gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
          <CatalogImage
            src={resolveIcon(tournament.icon, FALLBACKS.tournament)}
            alt=""
            fill
            className="object-cover"
            sizes="64px"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
            Manage
          </p>
          <h1 className="mt-1 font-display text-3xl text-white">
            {tournament.Name}
          </h1>
          <p className="mt-1 text-sm text-body">
            {tournament.GameName} · {tournament.TournamentMode} ·{" "}
            {tournament.Date}
          </p>
        </div>
        <Link href={`/tournament/${tournament.TournamentId}`}>
          <Button variant="outline">View tournament</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-6">
        <div {...helpTarget("manage-announce")}>
          <h2 className="mb-1 text-lg font-semibold text-white">
            Announcements
          </h2>
          <p className="mb-4 text-sm text-body">
            Posts show on the tournament page and notify everyone in this event.
          </p>
          <TournamentAnnouncements
            tournamentId={tournament.TournamentId}
            announcements={announcements}
            canPost={
              canAdminister &&
              !tournament.Winner?.TeamName?.trim()
            }
            closed={Boolean(tournament.Winner?.TeamName?.trim())}
            onChange={setAnnouncements}
          />
        </div>
        <div {...helpTarget("manage-invite")}>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Invite players
          </h2>
          <HostInvitePanel
            tournamentId={tournament.TournamentId}
            tournamentType={tournament.TournamentType}
            started={tournament.Start}
            registeredCount={participants.length}
            tournamentSize={tournament.TournamentSize}
            excludeIds={participants.flatMap((p) =>
              (p.Players ?? []).map((pl) => pl.User_id),
            )}
          />
        </div>
        <div {...helpTarget("tour-stages")}>
          <TournamentStageControls
            key={disqualifiedTeams.join("|")}
            tournament={tournament}
            initialDraws={draws}
            qualifiers={qualifiers}
            disqualifiedTeams={disqualifiedTeams}
          />
        </div>
        {showQualifierPicker ? (
          <SelectQualifiers
            tournamentId={tournament.TournamentId}
            groups={tournament.Groups ?? []}
            sections={(tournament.Groups ?? []).map((group) => ({
              name: group.GroupName,
              standings: computeLeagueStandings(
                group.Teams,
                draws.filter((d) => d.Group === group.GroupName),
                tournament.PointSystem,
                tournament.TieBreaker,
              ),
            }))}
            advancePerGroup={tournament.AdvancePerGroup || 2}
            initialQualifiers={qualifiers}
            disqualifiedTeams={disqualifiedTeams}
            canEdit={canAdminister}
            allGroupPlayed={allGroupPlayed}
            knockoutDrawn={knockoutDrawn}
            onSaved={setQualifiers}
          />
        ) : null}
        {canAdminister ? (
          <div className="rounded-2xl border border-surface-2 bg-surface p-5">
            <h2 className="mb-1 text-lg font-semibold text-white">
              {tournament.Start ? "Disqualify a team" : "Remove a team"}
            </h2>
            <p className="mb-4 text-sm text-body">
              {tournament.Start
                ? "They lose every remaining match 3-0. In knockout, their opponent goes through."
                : "Take a team off the roster before the tournament starts."}
            </p>
            <DisqualifyTeams
              tournamentId={tournament.TournamentId}
              started={tournament.Start}
              participants={participants}
              disqualifiedTeams={disqualifiedTeams}
              onDisqualified={({ tournament: next, draws: nextDraws }) => {
                setDisqualifiedTeams(next.DisqualifiedTeams ?? []);
                if (nextDraws) setDraws(nextDraws);
                router.refresh();
              }}
              onRemoved={({ teamName }) => {
                setParticipants((prev) =>
                  prev.filter((p) => p.TeamName !== teamName),
                );
                router.refresh();
              }}
              onPlayerRemoved={({ teamName, players }) => {
                setParticipants((prev) =>
                  players.length === 0
                    ? prev.filter((p) => p.TeamName !== teamName)
                    : prev.map((p) =>
                        p.TeamName === teamName ? { ...p, Players: players } : p,
                      ),
                );
                router.refresh();
              }}
            />
          </div>
        ) : null}
        {canAdminister ? (
          <div {...helpTarget("manage-settings")}>
            <EditTournamentSettings
              tournament={tournament}
              started={tournament.Start}
              registeredCount={participants.length}
              fixturesDrawn={draws.length > 0}
              knockoutDrawn={knockoutDrawn}
              onSaved={() => router.refresh()}
            />
          </div>
        ) : null}

        {canAdminister ? (
          <ManagerSettings
            tournamentId={tournament.TournamentId}
            hasOrg={Boolean(tournament.OrgId)}
            orgName={tournament.OrgName}
          />
        ) : null}

        {canAdminister ? (
          <div className="rounded-2xl border border-surface-2 bg-surface p-5">
            <h2 className="mb-1 text-lg font-semibold text-white">
              Add players
            </h2>
            <p className="mb-4 text-sm text-body">
              Add a new team, or add players to a team that still has
              roster spots. They join the roster immediately, without an
              invite. A team cannot have more than {needed}{" "}
              {needed === 1 ? "player" : "players"}.
            </p>
            {canAdd ? (
              <AddParticipants
                tournamentId={tournament.TournamentId}
                teamSize={tournament.Team}
                rosterCount={tournament.RosterCount}
                started={tournament.Start}
                participants={participants}
                existingUserIds={participants.flatMap((p) =>
                  (p.Players ?? []).map((pl) => pl.User_id),
                )}
                onAdded={(registration) =>
                  setParticipants((prev) =>
                    upsertParticipant(prev, registration),
                  )
                }
              />
            ) : (
              <p className="text-sm text-body">
                Adding players isn&apos;t enabled for this tournament yet.
              </p>
            )}
          </div>
        ) : null}

        {canAdminister ? (
          <div className="rounded-xl border border-lose/30 bg-surface p-5">
            <h3 className="mb-1 font-semibold text-white">Danger zone</h3>
            <p className="mb-4 text-sm text-body">
              Delete this tournament. This can be toggled.
            </p>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete tournament
            </Button>
          </div>
        ) : null}
      </div>

      <Confirm
        open={confirmDelete}
        title="Delete tournament?"
        message="Are you sure you want to delete this tournament?"
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={busy}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!busy) setConfirmDelete(false);
        }}
      />
    </div>
  );
}
