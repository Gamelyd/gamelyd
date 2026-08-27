import { ImageResponse } from "next/og";
import { getTournamentById } from "@/server/services/tournamentService";
import {
  tournamentCoverUrl,
  tournamentShareDescription,
} from "@/lib/tournamentShare";
import { ds } from "@/lib/designSystem";

export const runtime = "nodejs";
export const alt = "Tournament";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await getTournamentById(id);
  if (!tournament) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            background: ds.bgPrimary,
            color: ds.primary,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
          }}
        >
          Gamelyd
        </div>
      ),
      size,
    );
  }

  const cover = tournamentCoverUrl(tournament);
  const mode =
    tournament.TournamentMode === "BATTLEROYALE"
      ? "Battle Royale"
      : tournament.TournamentMode === "GROUPS"
        ? "Groups"
        : tournament.TournamentMode === "LEAGUE"
          ? "League"
          : "Knockout";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: ds.bgPrimary,
          color: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 520,
            height: 630,
            background: ds.bgPrimary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={cover}
            alt=""
            width={520}
            height={630}
            style={{ objectFit: "contain" }}
          />
        </div>
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
            padding: 56,
          }}
        >
          <div
            style={{
              display: "flex",
              color: ds.primary,
              fontSize: 28,
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            {tournament.GameName}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 58,
              lineHeight: 1.1,
              marginTop: 16,
              fontWeight: 700,
            }}
          >
            {tournament.Name}
          </div>
          <div
            style={{
              display: "flex",
              color: ds.textMuted,
              fontSize: 26,
              marginTop: 24,
            }}
          >
            {mode}
            {tournament.Platform ? ` · ${tournament.Platform}` : ""}
            {tournament.Date ? ` · ${tournament.Date}` : ""}
          </div>
          <div
            style={{
              display: "flex",
              color: ds.primary,
              fontSize: 22,
              marginTop: 36,
            }}
          >
            {tournamentShareDescription(tournament).slice(0, 120)}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
