import { ImageResponse } from "next/og";
import {
  getTournamentById,
  listParticipants,
} from "@/server/services/tournamentService";
import { getDrawsByTournament } from "@/server/services/drawService";
import {
  buildExportModel,
  exportViewSchema,
  layoutExport,
  EXPORT_VIEW_LABEL,
  type ExportModel,
} from "@/lib/exportViews";
import { ogIconSrc } from "@/server/ogIcon";
import { ExportCardMarkup } from "@/lib/exportCard";
import { exportFileName } from "@/lib/exportImage";

export const runtime = "nodejs";

const MODE_LABEL: Record<string, string> = {
  BATTLEROYALE: "Battle royale",
  GROUPS: "Groups",
  LEAGUE: "League",
  MULTIPLAYER: "Knockout",
};

function eventDate(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * A downloadable picture of one part of a tournament: the bracket, the group
 * tables, the standings, the teams, or the podium.
 *
 * Drawn here rather than captured from the page on purpose. A host on a phone
 * would otherwise get their own narrow layout, and a bracket in a 390px column
 * is not worth sending to anyone; rendering server-side means the same wide
 * image comes back whatever asked for it.
 */
/**
 * Satori cannot fetch an app-relative URL, so every crest is inlined as a data
 * URI first. Each distinct icon is read once, however many teams share it.
 */
async function inlineIcons(model: ExportModel): Promise<ExportModel> {
  const sources = new Set<string>();
  const collect = (icon: string) => {
    if (icon) sources.add(icon);
  };

  if (model.kind === "bracket") {
    for (const column of [...model.left, ...model.right]) {
      for (const match of column.matches) {
        collect(match.home.icon);
        collect(match.away.icon);
      }
    }
    if (model.final) {
      collect(model.final.home.icon);
      collect(model.final.away.icon);
      if (model.final.champion) collect(model.final.champion.icon);
    }
  } else if (model.kind === "tables") {
    for (const table of model.tables) for (const row of table.rows) collect(row.icon);
  } else if (model.kind === "teams") {
    for (const team of model.teams) {
      collect(team.icon);
      for (const player of team.players) collect(player.icon);
    }
  } else {
    for (const place of model.places) {
      collect(place.icon);
      for (const player of place.players) collect(player.icon);
    }
  }

  const resolved = new Map<string, string>();
  await Promise.all(
    [...sources].map(async (src) => {
      try {
        resolved.set(src, await ogIconSrc(src));
      } catch {
        // A crest that will not load must not take the whole picture down; the
        // card falls back to initials for that team.
        resolved.set(src, "");
      }
    }),
  );
  // Anything that did not become a data URI cannot be fetched by Satori either,
  // so drop it rather than render a broken image box.
  const swap = (icon: string) => {
    const next = resolved.get(icon) ?? "";
    return next.startsWith("data:") ? next : "";
  };

  if (model.kind === "bracket") {
    const wing = (columns: typeof model.left) =>
      columns.map((column) => ({
        ...column,
        matches: column.matches.map((match) => ({
          ...match,
          home: { ...match.home, icon: swap(match.home.icon) },
          away: { ...match.away, icon: swap(match.away.icon) },
        })),
      }));
    return {
      kind: "bracket",
      left: wing(model.left),
      right: wing(model.right),
      final: model.final
        ? {
            ...model.final,
            home: { ...model.final.home, icon: swap(model.final.home.icon) },
            away: { ...model.final.away, icon: swap(model.final.away.icon) },
            champion: model.final.champion
              ? {
                  ...model.final.champion,
                  icon: swap(model.final.champion.icon),
                }
              : null,
          }
        : null,
    };
  }
  if (model.kind === "tables") {
    return {
      kind: "tables",
      tables: model.tables.map((table) => ({
        ...table,
        rows: table.rows.map((row) => ({ ...row, icon: swap(row.icon) })),
      })),
    };
  }
  const swapRoster = (players: { name: string; icon: string }[]) =>
    players.map((player) => ({ ...player, icon: swap(player.icon) }));

  if (model.kind === "teams") {
    return {
      kind: "teams",
      teams: model.teams.map((team) => ({
        ...team,
        icon: swap(team.icon),
        players: swapRoster(team.players),
      })),
    };
  }
  return {
    kind: "champions",
    places: model.places.map((place) => ({
      ...place,
      icon: swap(place.icon),
      players: swapRoster(place.players),
    })),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; view: string }> },
) {
  const { id, view } = await params;

  const parsed = exportViewSchema.safeParse(view);
  if (!parsed.success) {
    return new Response("Unknown view", { status: 404 });
  }

  const tournament = await getTournamentById(id);
  if (!tournament || tournament.IsDeleted) {
    return new Response("Not found", { status: 404 });
  }

  const [participants, draws] = await Promise.all([
    listParticipants(id),
    getDrawsByTournament(id),
  ]);

  const model = buildExportModel(parsed.data, tournament, draws, participants);
  // Nothing to draw yet: a blank picture is worse than an honest 404, and the
  // page only offers views that have content anyway.
  if (!model) {
    return new Response("Nothing to export yet", { status: 404 });
  }

  const meta = [
    tournament.GameName,
    MODE_LABEL[tournament.TournamentMode] ?? "",
    eventDate(tournament.Date),
  ]
    .filter(Boolean)
    .join("  ·  ");

  // The canvas is sized to the content rather than fixed, and rolls onto
  // further pages rather than ever cutting content off.
  const requested = Number(new URL(request.url).searchParams.get("page") ?? "1");
  const layout = layoutExport(
    await inlineIcons(model),
    Number.isFinite(requested) ? requested : 1,
  );

  const image = new ImageResponse(
    (
      <ExportCardMarkup
        layout={layout}
        view={parsed.data}
        tournamentName={tournament.Name}
        meta={meta}
      />
    ),
    { width: layout.width, height: layout.height },
  );

  // `download` on the link names the file, but setting it here too means the
  // URL still saves sensibly when opened directly or shared.
  const fileName = exportFileName(
    tournament.Name,
    layout.pages > 1
      ? `${EXPORT_VIEW_LABEL[parsed.data]} ${layout.page} of ${layout.pages}`
      : EXPORT_VIEW_LABEL[parsed.data],
  );
  const headers = new Headers(image.headers);
  headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");

  return new Response(image.body, { status: 200, headers });
}
