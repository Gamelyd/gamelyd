"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { IconPicker } from "@/components/ui/IconPicker";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { registerForTournamentAction } from "@/server/actions/tournamentActions";
import { startEntryCheckoutAction } from "@/server/actions/paymentActions";
import { FALLBACKS, playerIconFor, type AppIcon } from "@/lib/icons";
import { useIcons } from "@/hooks/useIcons";
import type { Player } from "@/lib/schemas/draw";
import type { RegisterTournament } from "@/lib/schemas/register";
import { parseCurrency } from "@/lib/currency";
import { FeeSummary } from "@/components/tournament/FeeSummary";
import type { Payment, TeamSize } from "@/lib/schemas/common";
import { rosterSize } from "@/lib/schemas/common";

function playerFromUser(
  u: {
    user_name?: string;
    first_name?: string;
    user_id: string;
    email?: string;
    icon?: string;
    verified?: boolean;
  },
  playerIcons: AppIcon[],
): Player {
  const userName = u.user_name || u.first_name || "Player";
  return {
    UserName: userName,
    GameUserName: "",
    User_id: u.user_id,
    Email: u.email || "",
    Icon: u.icon || playerIconFor(u.user_id, playerIcons),
    Verified: Boolean(u.verified),
  };
}

export function RegisterTeam({
  tournamentId,
  teamSize,
  payment = "FREE",
  currency = "USD",
  entryFee = 0,
  feeBps,
  onRegistered,
}: {
  tournamentId: string;
  teamSize: TeamSize;
  payment?: Payment;
  currency?: string;
  entryFee?: number;
  feeBps?: number;
  onRegistered: (registration: RegisterTournament) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const { icons: teamIcons, loading: teamIconsLoading } = useIcons("team");
  const { icons: playerIcons, loading: playerIconsLoading } = useIcons("player");
  const [teamName, setTeamName] = useState("");
  const [icon, setIcon] = useState<string>(FALLBACKS.team);
  const [playerIcon, setPlayerIcon] = useState<string>("");
  const [gameUserName, setGameUserName] = useState("");
  const [loading, setLoading] = useState(false);
  const needed = rosterSize(teamSize);

  useEffect(() => {
    if (teamIcons.length === 0) return;
    setIcon((prev) =>
      teamIcons.some((item) => item.url === prev) ? prev : teamIcons[0].url,
    );
  }, [teamIcons]);

  useEffect(() => {
    if (!user) return;
    const preferred =
      user.icon || playerIconFor(user.user_id, playerIcons) || FALLBACKS.player;
    setPlayerIcon((prev) => {
      if (playerIcons.length === 0) return prev || preferred;
      if (prev && playerIcons.some((item) => item.url === prev)) return prev;
      return (
        playerIcons.find((item) => item.url === preferred)?.url ??
        playerIcons[0].url
      );
    });
  }, [user, playerIcons]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const me = playerFromUser(user, playerIcons);
    me.GameUserName = gameUserName;
    if (playerIcon) me.Icon = playerIcon;
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
      <IconPicker
        label="Team icon"
        icons={teamIcons}
        value={icon}
        onChange={setIcon}
        loading={teamIconsLoading}
      />
      <IconPicker
        label="Your player icon"
        icons={playerIcons}
        value={playerIcon}
        onChange={setPlayerIcon}
        loading={playerIconsLoading}
        size="sm"
      />
      <Input
        label="Your in-game username"
        value={gameUserName}
        onChange={(e) => setGameUserName(e.target.value)}
      />
      {needed > 1 ? (
        <p className="text-sm text-body">
          You register as captain. After this, invite teammates by username.
          They are not on the roster until they accept. A player can only be on
          one team.
        </p>
      ) : (
        <p className="text-sm text-body">Solo tournament. You register alone.</p>
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
