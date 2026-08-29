"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import type { SavedTeam } from "@/lib/schemas/savedTeam";
import {
  alertCaptainAboutTournamentAction,
  mySavedTeamsAction,
} from "@/server/actions/savedTeamActions";

/**
 * Lets a player nudge the captain of one of their saved teams to enter this
 * tournament. Only shown for teams the viewer does NOT captain - a captain can
 * simply register the team themselves.
 */
export function AlertCaptain({ tournamentId }: { tournamentId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const [teams, setTeams] = useState<SavedTeam[]>([]);
  const [teamId, setTeamId] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    void mySavedTeamsAction().then((result) => {
      if (!result.ok) return;
      setTeams(result.data.filter((team) => !team.isCaptain));
    });
  }, [user]);

  if (!user || teams.length === 0) return null;

  const chosen = teamId || teams[0].team_id;
  const alreadySent = sent.includes(chosen);

  const send = async () => {
    setSending(true);
    const result = await alertCaptainAboutTournamentAction(
      chosen,
      tournamentId,
    );
    setSending(false);
    if (result.ok) {
      toast.success(result.message ?? "Your captain has been notified");
      setSent((prev) => [...prev, chosen]);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="rounded-xl border border-surface-2 bg-surface p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
        Want your team here?
      </h3>
      <p className="mt-1 text-sm text-body">
        Send your captain a heads-up. They can enter the whole roster in one
        click from their notifications.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        {teams.length > 1 ? (
          <div className="min-w-55 flex-1">
            <Select
              label="Team"
              value={chosen}
              onChange={(e) => setTeamId(e.target.value)}
              options={teams.map((team) => ({
                value: team.team_id,
                label: team.name,
              }))}
            />
          </div>
        ) : null}
        <Button
          loading={sending}
          disabled={alreadySent}
          onClick={() => void send()}
        >
          {alreadySent ? "Captain notified" : "Tell my captain"}
        </Button>
      </div>
    </div>
  );
}
