"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { IconPicker } from "@/components/ui/IconPicker";
import { useToast } from "@/components/ui/Toast";
import { useIcons } from "@/hooks/useIcons";
import { getGamesAction } from "@/server/actions/gameActions";
import { editTournamentSettingsAction } from "@/server/actions/tournamentActions";

export function TournamentCoverPicker({
  tournamentId,
  gameName,
  value,
  onSaved,
}: {
  tournamentId: string;
  gameName: string;
  value: string;
  onSaved?: (icon: string) => void;
}) {
  const toast = useToast();
  const [gameId, setGameId] = useState("");
  const [icon, setIcon] = useState(value);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { icons, loading } = useIcons("tournament", {
    gameId,
    taggedOnly: true,
  });

  useEffect(() => {
    setIcon(value);
  }, [value]);

  useEffect(() => {
    let active = true;
    void getGamesAction().then((result) => {
      if (!active || !result.ok) return;
      const match = result.data.find(
        (game) => game.name.toLowerCase() === gameName.trim().toLowerCase(),
      );
      setGameId(match?.game_id ?? "");
    });
    return () => {
      active = false;
    };
  }, [gameName]);

  const dirty = icon !== value;

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    const result = await editTournamentSettingsAction(tournamentId, {
      icon,
    });
    setSaving(false);
    if (result.ok) {
      toast.success(result.message ?? "Cover updated");
      setConfirm(false);
      onSaved?.(icon);
    } else {
      toast.error(result.error);
      setIcon(value);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <IconPicker
        label={saving ? "Cover art (saving…)" : "Cover art"}
        icons={icons}
        value={icon}
        onChange={setIcon}
        loading={loading}
        emptyHint={
          gameName
            ? "No covers tagged for this game yet. Tag some under Admin → Images."
            : "No cover images in the catalog yet."
        }
      />
      <div>
        <Button
          type="button"
          disabled={!dirty || saving}
          loading={saving}
          onClick={() => setConfirm(true)}
        >
          Save cover
        </Button>
      </div>
      <Confirm
        open={confirm}
        title="Update this tournament?"
        message="Are you sure you want to update this?"
        confirmLabel="Yes, update"
        confirmVariant="default"
        loading={saving}
        onConfirm={() => void save()}
        onCancel={() => {
          if (!saving) setConfirm(false);
        }}
      />
    </div>
  );
}
