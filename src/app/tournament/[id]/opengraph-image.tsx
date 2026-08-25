import { ImageResponse } from "next/og";
import { getTournamentById } from "@/server/services/tournamentService";
import {
  tournamentCoverUrl,
  tournamentShareDescription,
} from "@/lib/tournamentShare";

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
            background: "#1f2731",
            color: "#0bc0b4",
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
          background: "#1f2731",
          color: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 520,
            height: 630,
            background: "#121315",
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
              color: "#0bc0b4",
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
              color: "#b8bcbf",
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
              color: "#0bc0b4",
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
