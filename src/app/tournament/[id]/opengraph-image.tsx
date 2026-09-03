import { ImageResponse } from "next/og";
import { getTournamentById } from "@/server/services/tournamentService";
import { tournamentCoverUrl } from "@/lib/tournamentShare";
import { ogIconSrc } from "@/server/ogIcon";
import { formatMoney } from "@/lib/currency";
import { ds } from "@/lib/designSystem";

export const runtime = "nodejs";
export const alt = "Tournament";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MODE_LABEL: Record<string, string> = {
  BATTLEROYALE: "Battle royale",
  GROUPS: "Groups",
  LEAGUE: "League",
  MULTIPLAYER: "Knockout",
};

const TEAM_LABEL: Record<string, string> = {
  DUO: "Duo",
  SQUAD: "Squad",
  SOLO: "Solo",
};

function shareDate(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Trim a long name so it cannot push the meta line off the card. */
function fit(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

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

  const cover = await ogIconSrc(tournamentCoverUrl(tournament));
  const meta = [
    MODE_LABEL[tournament.TournamentMode] ?? "Knockout",
    TEAM_LABEL[tournament.Team] ?? "Solo",
    tournament.Platform || "Cross platform",
    shareDate(tournament.Date),
  ]
    .filter(Boolean)
    .join("  ·  ");

  const prize = tournament.Prizes?.[0]?.Amount ?? 0;
  const showPrize = tournament.Payment === "SPONSORED" && prize > 0;

  /*
   * The cover fills its column: `contain` letterboxed most covers, leaving
   * half the card empty and everything else small.
   *
   * Keep comments out of the JSX below. A comment node inside an
   * ImageResponse tree makes the route return a non-Response and 500.
   */
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
        <div style={{ display: "flex", width: 470, height: 630, overflow: "hidden" }}>
          <img
            src={cover}
            alt=""
            width={470}
            height={630}
            style={{ objectFit: "cover", width: 470, height: 630 }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 56,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                width: 12,
                height: 12,
                borderRadius: 6,
                background: ds.primary,
              }}
            />
            <div
              style={{
                display: "flex",
                marginLeft: 12,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 5,
                textTransform: "uppercase",
              }}
            >
              Gamelyd
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                color: ds.primary,
                fontSize: 26,
                letterSpacing: 5,
                textTransform: "uppercase",
              }}
            >
              {fit(tournament.GameName, 28)}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 62,
                lineHeight: 1.06,
                marginTop: 14,
                fontWeight: 700,
              }}
            >
              {fit(tournament.Name, 42)}
            </div>
            <div
              style={{
                display: "flex",
                color: ds.textMuted,
                fontSize: 26,
                marginTop: 22,
              }}
            >
              {meta}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                background: ds.primary,
                color: ds.onPrimary,
                fontSize: 24,
                fontWeight: 700,
                padding: "12px 22px",
                borderRadius: 10,
              }}
            >
              Free entry
            </div>
            {showPrize ? (
              <div
                style={{
                  display: "flex",
                  marginLeft: 16,
                  color: ds.secondary,
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                Win {formatMoney(prize, tournament.Currency)}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
