"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
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
  const needed = rosterSize(teamSize, rosterCount);

  useEffect(() => {
    if (teamIcons.length === 0) return;
    setIcon((prev) =>
      teamIcons.some((item) => item.url === prev) ? prev : teamIcons[0].url,
    );
  }, [teamIcons]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const me = playerFromUser(user);
    me.GameUserName = gameUserName;
    const roster = {
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
      <Input
        label="Team name"
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        required
      />
      <div>
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
          Teams are limited to {needed} players. You register as captain, then
          invite teammates by username. They are not on the roster until they
          accept. A player can only be on one team.
        </p>
      ) : (
        <p className="text-sm text-body">
          Solo tournament. The host set 1 player per team.
        </p>
      )}

      {payment === "PAID" && entryFee > 0 ? (
        <FeeSummary
          kind="PAID"
          currency={parseCurrency(currency)}
          entryFee={entryFee}
          feeBps={feeBps}
        />
      ) : null}

      <Button type="submit" loading={loading}>
        {payment === "PAID" ? "Pay and register" : "Register team"}
      </Button>
    </form>
  );
}
