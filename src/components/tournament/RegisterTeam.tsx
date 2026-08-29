"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { IconPicker } from "@/components/ui/IconPicker";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { registerForTournamentAction } from "@/server/actions/tournamentActions";
import { startEntryCheckoutAction } from "@/server/actions/paymentActions";
import { FALLBACKS } from "@/lib/icons";
import { useIcons } from "@/hooks/useIcons";
import type { Player } from "@/lib/schemas/draw";
import type { RegisterTournament } from "@/lib/schemas/register";
import { parseCurrency } from "@/lib/currency";
import { FeeSummary } from "@/components/tournament/FeeSummary";
import type { Payment, TeamSize } from "@/lib/schemas/common";
import { rosterSize } from "@/lib/schemas/common";
import type { SavedTeam } from "@/lib/schemas/savedTeam";
import { mySavedTeamsAction } from "@/server/actions/savedTeamActions";
import { canReceivePayoutAction } from "@/server/actions/payoutActions";

function playerFromUser(u: {
  user_name?: string;
  first_name?: string;
  user_id: string;
  email?: string;
  icon?: string;
  verified?: boolean;
}): Player {
  const userName = u.user_name || u.first_name || "Player";
  return {
    UserName: userName,
    GameUserName: "",
    User_id: u.user_id,
    Email: u.email || "",
    Icon: u.icon || FALLBACKS.player,
    Verified: Boolean(u.verified),
  };
}

export function RegisterTeam({
  tournamentId,
  teamSize,
  rosterCount = 0,
  usesInGameName = true,
  payment = "FREE",
  currency = "USD",
  entryFee = 0,
  feeBps,
  onRegistered,
}: {
  tournamentId: string;
  teamSize: TeamSize;
  rosterCount?: number;
  usesInGameName?: boolean;
  payment?: Payment;
  currency?: string;
  entryFee?: number;
  feeBps?: number;
  onRegistered: (registration: RegisterTournament) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const { icons: teamIcons, loading: teamIconsLoading } = useIcons("team");
  const [teamName, setTeamName] = useState("");
  const [icon, setIcon] = useState<string>(FALLBACKS.team);
  const [iconOpen, setIconOpen] = useState(false);
  const [gameUserName, setGameUserName] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedTeams, setSavedTeams] = useState<SavedTeam[]>([]);
  const [savedTeamId, setSavedTeamId] = useState("");
  /** null while we are still checking, so the button does not flicker. */
  const [payoutReady, setPayoutReady] = useState<boolean | null>(null);
  const needed = rosterSize(teamSize, rosterCount);

  useEffect(() => {
    if (teamIcons.length === 0) return;
    setIcon((prev) =>
      teamIcons.some((item) => item.url === prev) ? prev : teamIcons[0].url,
    );
  }, [teamIcons]);

  // Only teams the player captains can be entered, and only ones that fit.
  useEffect(() => {
    if (!user) return;
    void mySavedTeamsAction().then((result) => {
      if (!result.ok) return;
      setSavedTeams(
        result.data.filter(
          (team) => team.isCaptain && team.members.length <= needed,
        ),
      );
    });
  }, [user, needed]);

  const chosenTeam = savedTeams.find((team) => team.team_id === savedTeamId);

  // Paid events pay the team's prize to the captain, so checkout refuses without
  // a payout account. Ask up front rather than letting them hit that wall.
  useEffect(() => {
    if (!user || payment !== "PAID") return;
    void canReceivePayoutAction(currency).then((result) => {
      if (result.ok) setPayoutReady(result.data);
    });
  }, [user, payment, currency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const me = playerFromUser(user);
    me.GameUserName = gameUserName;
    // With a saved team the server resolves the roster, name and icon from the
    // stored team, so these fields are only placeholders for validation.
    const roster = savedTeamId
      ? {
          Players: [me],
          TeamName: chosenTeam?.name ?? teamName,
          Icon: chosenTeam?.icon || FALLBACKS.team,
          SavedTeamId: savedTeamId,
        }
      : {
          Players: [me],
          TeamName: teamName,
          Icon: icon || FALLBACKS.team,
        };
    if (payment === "PAID") {
      const checkout = await startEntryCheckoutAction(tournamentId, roster);
      setLoading(false);
      if (checkout.ok) {
        toast.success("Redirecting to pay entry fee");
        window.location.href = checkout.data.checkoutUrl;
        return;
      }
      toast.error(checkout.error);
      return;
    }
    const result = await registerForTournamentAction(tournamentId, {
      ...roster,
      RefNumber: "",
      PaymentChannel: "",
      Amount: 0,
    });
    setLoading(false);
    if (result.ok) {
      toast.success(result.message ?? "Registered");
      onRegistered(result.data);
      setTeamName("");
      setSavedTeamId("");
      setIcon(teamIcons[0]?.url ?? FALLBACKS.team);
    } else {
      toast.error(result.error);
    }
  };

  if (!user) {
    return (
      <p className="rounded-xl border border-surface-2 bg-surface p-6 text-body">
        Please sign in to register a team.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      {savedTeams.length > 0 && needed > 1 ? (
        <Select
          label="Enter a saved team"
          value={savedTeamId}
          onChange={(e) => setSavedTeamId(e.target.value)}
          options={[
            { value: "", label: "Register on my own" },
            ...savedTeams.map((team) => ({
              value: team.team_id,
              label: `${team.name} (${team.members.length} player${team.members.length === 1 ? "" : "s"})`,
            })),
          ]}
        />
      ) : null}

      {chosenTeam ? (
        <div className="rounded-xl border border-primary/35 bg-primary/10 p-4">
          <p className="text-sm text-white">
            Entering <span className="font-semibold">{chosenTeam.name}</span>{" "}
            with {chosenTeam.members.length} player
            {chosenTeam.members.length === 1 ? "" : "s"}.
          </p>
          <p className="mt-1 text-xs text-body">
            {chosenTeam.members
              .map((m) => m.user_name || m.first_name)
              .join(", ")}
          </p>
          <p className="mt-2 text-xs text-body">
            They join straight away, with no separate invites needed.
          </p>
        </div>
      ) : null}

      <Input
        label="Team name"
        value={chosenTeam ? chosenTeam.name : teamName}
        onChange={(e) => setTeamName(e.target.value)}
        disabled={Boolean(chosenTeam)}
        required={!chosenTeam}
      />
      <div className={chosenTeam ? "hidden" : ""}>
        <p className="mb-2 text-sm text-label">Team icon</p>
        <button
          type="button"
          onClick={() => setIconOpen(true)}
          className="flex items-center gap-3 rounded-xl border border-primary/25 bg-input px-3 py-2.5 text-left transition-colors hover:border-primary"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={icon || FALLBACKS.team}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-white">
              Choose team icon
            </span>
            <span className="block text-xs text-body">Tap to change</span>
          </span>
        </button>
      </div>
      <Modal
        open={iconOpen}
        onClose={() => setIconOpen(false)}
        title="Team icon"
        width="max-w-2xl"
      >
        <IconPicker
          label="Pick an icon"
          icons={teamIcons}
          value={icon}
          onChange={(url) => {
            setIcon(url);
            setIconOpen(false);
          }}
          loading={teamIconsLoading}
        />
      </Modal>
      {usesInGameName ? (
        <Input
          label="Your in-game username"
          value={gameUserName}
          onChange={(e) => setGameUserName(e.target.value)}
        />
      ) : null}
      {needed > 1 ? (
        <p className="text-sm text-body">
          {chosenTeam
            ? `Teams are limited to ${needed} players. Everyone on ${chosenTeam.name} is entered together.`
            : `Teams are limited to ${needed} players. You register as captain, then invite teammates by username. They are not on the roster until they accept. A player can only be on one team.`}
        </p>
      ) : (
        <p className="text-sm text-body">
          Solo tournament. The host set 1 player per team.
        </p>
      )}

      {payment === "PAID" && entryFee > 0 ? (
        <FeeSummary
          audience="player"
          kind="PAID"
          currency={parseCurrency(currency)}
          entryFee={entryFee}
          feeBps={feeBps}
        />
      ) : null}

      {payment === "PAID" && payoutReady === false ? (
        <div className="rounded-xl border border-yellow/40 bg-yellow/10 p-5">
          <h3 className="font-display text-lg text-yellow">
            Add a payout account first
          </h3>
          <p className="mt-1 text-sm text-body">
            This event pays prize money to the team captain, which is you.
            Connect the account your winnings should land in before you pay the
            entry fee. It takes a minute, and you only do it once.
          </p>
          <Link
            href={`/profile/${user.user_id}?tab=payouts`}
            className="mt-4 inline-block rounded-lg bg-yellow px-4 py-2 text-sm font-semibold text-[#221a00]"
          >
            Add payout account
          </Link>
        </div>
      ) : null}

      <Button
        type="submit"
        loading={loading}
        disabled={payment === "PAID" && payoutReady === false}
      >
        {payment === "PAID" ? "Pay and register" : "Register team"}
      </Button>
    </form>
  );
}
