/*
 * Satori renders this card, not the browser, so next/image has no role here and
 * a raw <img> is correct. The disable sits at file level because a JSX comment
 * inside an ImageResponse tree breaks the route.
 */
/* eslint-disable @next/next/no-img-element */
import { ds } from "@/lib/designSystem";
import {
  BRACKET_COL_GAP,
  BRACKET_COL_MIN,
  BRACKET_FORK_W,
  BRACKET_TROPHY_W,
  EXPORT_VIEW_LABEL,
  TEAMS_PER_ROW,
  type ExportColumn,
  type ExportFinal,
  type ExportLayout,
  type ExportModel,
  type ExportPlace,
  type ExportSide,
  type ExportTable,
  type ExportTeam,
  type ExportView,
} from "@/lib/exportViews";

/**
 * Markup for the images a host downloads off a tournament page.
 *
 * Rendered by Satori, not a browser: every node must set `display: flex`, there
 * is no grid, and no CSS variables. Sizes are fixed rather than responsive
 * because the whole point is that a phone and a desktop produce the same wide
 * picture.
 *
 * These are made to be shared, so the frame carries the tournament name and the
 * Gamelyd credit. A bracket screenshotted into a group chat should say where it
 * came from without anybody having to explain it.
 */

const MUTED = "#93a1ad";
const FORK = "rgba(11,192,180,0.45)";
const LINE = "rgba(255,255,255,0.10)";
const PANEL = "rgba(255,255,255,0.04)";

/** Two letters is enough to tell teams apart without loading any images. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function fit(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * The team's own crest, exactly as the page shows it. Initials only stand in
 * when a team genuinely has no icon -- an export full of two-letter circles
 * looked nothing like the tournament it came from.
 */
function Crest({
  name,
  size,
  icon,
  ring,
  won,
}: {
  name: string;
  size: number;
  icon?: string;
  ring?: string;
  /** A side that went through gets the solid ring the page gives it. */
  won?: boolean;
}) {
  const border = ring ?? (won ? ds.primary : "rgba(11,192,180,0.25)");
  // Satori cannot fetch a URL: an icon has to arrive already inlined as a data
  // URI or it throws and takes the whole picture down. Anything else falls back
  // to initials, so a missed crest costs a monogram rather than the image.
  if (icon && icon.startsWith("data:")) {
    return (
      <img
        src={icon}
        alt=""
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          border: `${ring ? 3 : 1}px solid ${border}`,
          objectFit: "cover",
        }}
      />
    );
  }
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: size / 2,
        background: ring
          ? "rgba(255,255,255,0.06)"
          : won
            ? "rgba(11,192,180,0.30)"
            : "rgba(0,0,0,0.25)",
        border: `${ring ? 3 : 1}px solid ${border}`,
        color: ring ?? ds.primary,
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {initials(name)}
    </div>
  );
}

/* ------------------------------- Bracket ------------------------------- */

/**
 * One round, plus the forks joining its pairs to the round after it.
 *
 * The page draws those forks and the export did not, which is what made a
 * downloaded bracket read as loose stacks of cards rather than a bracket. The
 * fork column mirrors `KnockoutBracket`: a rounded "]" spanning each pair.
 *
 * Everything is sized from `scale` rather than a CSS transform, so a large
 * bracket shrinks to fit one picture and stays crisp.
 */
function BracketColumn({
  column,
  width,
  scale,
  side,
}: {
  column: ExportColumn;
  width: number;
  scale: number;
  side: "left" | "right";
}) {
  const px = (value: number) => Math.max(1, Math.round(value * scale));
  return (
    <div style={{ display: "flex", flexDirection: "column", width }}>
      <div
        style={{
          display: "flex",
          justifyContent: side === "right" ? "flex-end" : "flex-start",
          color: ds.secondary,
          fontSize: px(17),
          fontWeight: 700,
          letterSpacing: Math.max(0, 2 * scale),
          marginBottom: px(14),
        }}
      >
        {column.label}
      </div>
      <div
        style={{
          display: "flex",
          flexGrow: 1,
          alignItems: "stretch",
          flexDirection: side === "right" ? "row-reverse" : "row",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-around",
            flexGrow: 1,
          }}
        >
          {column.matches.map((match, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                flexDirection: "column",
                background: PANEL,
                border: `1px solid ${LINE}`,
                borderRadius: px(12),
                padding: px(6),
              }}
            >
              <MatchSide side={match.home} scale={scale} wing={side} />
              <div
                style={{
                  display: "flex",
                  height: 1,
                  marginTop: px(3),
                  marginBottom: px(3),
                  background: "rgba(11,192,180,0.12)",
                }}
              />
              <MatchSide side={match.away} scale={scale} wing={side} />
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: Math.round(BRACKET_FORK_W * scale),
          }}
        >
            {column.matches.map((_, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  flexGrow: 1,
                  paddingTop: px(12),
                  paddingBottom: px(12),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    borderTop: `2px solid ${FORK}`,
                    borderBottom: `2px solid ${FORK}`,
                    ...(side === "right"
                      ? {
                          borderLeft: `2px solid ${FORK}`,
                          borderTopLeftRadius: 4,
                          borderBottomLeftRadius: 4,
                        }
                      : {
                          borderRight: `2px solid ${FORK}`,
                          borderTopRightRadius: 4,
                          borderBottomRightRadius: 4,
                        }),
                  }}
                />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/** One team on a fixture line, mirrored so the pair reads inward. */
function FixtureSide({
  side,
  align,
}: {
  side: ExportSide;
  align: "left" | "right";
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexGrow: 1,
        justifyContent: align === "right" ? "flex-start" : "flex-end",
        flexDirection: align === "right" ? "row" : "row-reverse",
      }}
    >
      <Crest name={side.name} size={30} icon={side.icon} won={side.won} />
      <div
        style={{
          display: "flex",
          marginLeft: align === "right" ? 10 : 0,
          marginRight: align === "right" ? 0 : 10,
          fontSize: 19,
          fontWeight: side.won ? 700 : 500,
          color: side.won ? "white" : "rgba(255,255,255,0.75)",
        }}
      >
        {fit(side.name, 20)}
      </div>
    </div>
  );
}

function TrophyColumn({
  final,
  scale,
  width,
}: {
  final: ExportFinal | null;
  scale: number;
  width: number;
}) {
  const px = (value: number) => Math.max(1, Math.round(value * scale));
  const champion = final?.champion ?? null;
  const gold = "#f6c945";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          color: ds.secondary,
          fontSize: px(17),
          fontWeight: 700,
          letterSpacing: Math.max(0, 2 * scale),
          marginBottom: px(14),
        }}
      >
        FINAL
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexGrow: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: px(74),
            height: px(74),
            borderRadius: px(37),
            border: `2px solid ${champion ? gold : "rgba(255,255,255,0.14)"}`,
            background: champion ? "rgba(246,201,69,0.14)" : "rgba(255,255,255,0.05)",
            fontSize: px(38),
            color: champion ? gold : "rgba(255,255,255,0.35)",
          }}
        >
          🏆
        </div>
        {champion ? (
          <div
            style={{
              display: "flex",
              marginTop: px(12),
              padding: `${px(5)}px ${px(12)}px`,
              borderRadius: 999,
              background: "rgba(246,201,69,0.15)",
              color: gold,
              fontSize: px(17),
              fontWeight: 700,
            }}
          >
            {fit(champion.name, Math.max(8, Math.round(14 / Math.max(scale, 0.5))))}
          </div>
        ) : null}
        {final ? (
          <div
            style={{
              display: "flex",
              marginTop: px(8),
              fontSize: px(16),
              color: MUTED,
            }}
          >
            {final.played
              ? `${final.home.score} – ${final.away.score}`
              : "To be played"}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One side of a fixture, highlighted the way the page highlights it.
 *
 * The page marks a winner five ways at once -- a tinted row, an accent bar down
 * the inside edge, a solid ring on the crest, the name in white, and the score
 * as a filled pill. The export only did the last two, so a downloaded bracket
 * barely showed who had gone through.
 */
function MatchSide({
  side,
  scale,
  wing,
}: {
  side: ExportSide;
  scale: number;
  wing: "left" | "right";
}) {
  const px = (value: number) => Math.max(1, Math.round(value * scale));
  const font = px(19);
  const bar = (
    <div
      style={{
        display: "flex",
        width: Math.max(2, Math.round(3 * scale)),
        alignSelf: "stretch",
        background: side.won ? ds.primary : "transparent",
        borderRadius: 1,
      }}
    />
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderRadius: px(8),
        background: side.won ? "rgba(11,192,180,0.12)" : "transparent",
        paddingTop: px(5),
        paddingBottom: px(5),
        flexDirection: wing === "right" ? "row-reverse" : "row",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexDirection: wing === "right" ? "row-reverse" : "row",
        }}
      >
        {bar}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginLeft: wing === "right" ? 0 : px(8),
            marginRight: wing === "right" ? px(8) : 0,
            flexDirection: wing === "right" ? "row-reverse" : "row",
          }}
        >
          <Crest name={side.name} size={px(26)} icon={side.icon} won={side.won} />
          <div
            style={{
              display: "flex",
              marginLeft: wing === "right" ? 0 : px(10),
              marginRight: wing === "right" ? px(10) : 0,
              fontSize: font,
              fontWeight: side.won ? 700 : 500,
              color: side.won ? "white" : "rgba(255,255,255,0.62)",
            }}
          >
            {fit(side.name, Math.max(8, Math.round(15 / Math.max(scale, 0.5))))}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: px(26),
          borderRadius: px(6),
          paddingTop: px(2),
          paddingBottom: px(2),
          paddingLeft: px(7),
          paddingRight: px(7),
          marginLeft: wing === "right" ? px(8) : 0,
          marginRight: wing === "right" ? 0 : px(8),
          background: side.won ? ds.primary : "rgba(0,0,0,0.30)",
          color: side.won ? ds.bgPrimary : "rgba(255,255,255,0.55)",
          fontSize: font,
          fontWeight: 700,
        }}
      >
        {side.score}
      </div>
    </div>
  );
}

/* -------------------------------- Tables -------------------------------- */

function Table({
  table,
  width,
}: {
  table: ExportTable;
  width: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        background: PANEL,
        border: `1px solid ${LINE}`,
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            color: ds.secondary,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          {table.name}
        </div>
        <div style={{ display: "flex" }}>
          {table.headers.map((header) => (
            <div
              key={header}
              style={{
                display: "flex",
                width: 46,
                justifyContent: "flex-end",
                color: MUTED,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {header}
            </div>
          ))}
        </div>
      </div>

      {table.rows.map((row) => (
        <div
          key={row.name}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${LINE}`,
            paddingTop: 10,
            paddingBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                width: 26,
                color: row.position <= 2 ? ds.primary : MUTED,
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              {row.position}
            </div>
            <Crest name={row.name} size={28} icon={row.icon} />
            <div
              style={{
                display: "flex",
                marginLeft: 10,
                color: "white",
                fontSize: 19,
                fontWeight: 600,
              }}
            >
              {fit(row.name, 18)}
            </div>
          </div>
          <div style={{ display: "flex" }}>
            {row.cells.map((cell, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  width: 46,
                  justifyContent: "flex-end",
                  fontSize: 18,
                  fontWeight: index === row.cells.length - 1 ? 700 : 500,
                  color: index === row.cells.length - 1 ? "white" : MUTED,
                }}
              >
                {cell}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Teams --------------------------------- */

function TeamCard({
  team,
  width,
}: {
  team: ExportTeam;
  width: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        background: PANEL,
        border: `1px solid ${LINE}`,
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <Crest name={team.name} size={38} icon={team.icon} />
        <div
          style={{
            display: "flex",
            marginLeft: 12,
            color: "white",
            fontSize: 21,
            fontWeight: 700,
          }}
        >
          {fit(team.name, 16)}
        </div>
      </div>
      {team.players.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 10,
          }}
        >
          {team.players.slice(0, 3).map((player) => (
            <div
              key={player.name}
              style={{
                display: "flex",
                alignItems: "center",
                color: MUTED,
                fontSize: 16,
                marginTop: 4,
              }}
            >
              <Crest name={player.name} size={20} icon={player.icon} />
              <div style={{ display: "flex", marginLeft: 8 }}>
                {fit(player.name, 20)}
              </div>
            </div>
          ))}
          {team.players.length > 3 ? (
            <div style={{ display: "flex", color: MUTED, fontSize: 15, marginTop: 3 }}>
              +{team.players.length - 3} more
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ Champions ------------------------------- */

const PLACE_COLOR: Record<number, string> = {
  1: "#f6c945",
  2: "#cbd5e1",
  3: "#cd7f32",
};

/**
 * The champions poster, built to match the celebration modal rather than the
 * wide sheets the other views use: same gold/silver/bronze, same ringed crest
 * over a tiered bar, same champion roster underneath. There is little to show,
 * so it is portrait -- which is also the shape people actually share.
 */
function PodiumCol({ place }: { place: ExportPlace }) {
  const color = PLACE_COLOR[place.place] ?? MUTED;
  const first = place.place === 1;
  const crest = first ? 168 : 124;
  const bar = first ? 220 : place.place === 2 ? 150 : 110;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        width: 272,
        marginLeft: 20,
        marginRight: 20,
      }}
    >
      <Crest name={place.name} size={crest} icon={place.icon} ring={color} />
      <div
        style={{
          display: "flex",
          marginTop: 14,
          color: "white",
          fontSize: first ? 34 : 28,
          fontWeight: 700,
        }}
      >
        {fit(place.name, 15)}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 4,
          color,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        {place.label}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
          height: bar,
          marginTop: 16,
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          background: `linear-gradient(180deg, ${color} 0%, ${color}bb 100%)`,
        }}
      >
        <div
          style={{
            display: "flex",
            marginTop: 12,
            fontSize: 46,
            fontWeight: 700,
            color: "rgba(0,0,0,0.7)",
          }}
        >
          {place.place}
        </div>
      </div>
    </div>
  );
}

function ChampionPoster({
  places,
  tournamentName,
  meta,
}: {
  places: ExportPlace[];
  tournamentName: string;
  meta: string;
}) {
  // Runner-up, champion, third -- the order the modal stands them in.
  const order = [2, 1, 3];
  const columns = order
    .map((place) => places.find((row) => row.place === place))
    .filter((row): row is ExportPlace => Boolean(row));
  const champion = places.find((row) => row.place === 1);
  const roster = champion?.players ?? [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        height: "100%",
        padding: 56,
        background: ds.bgPrimary,
        backgroundImage: `linear-gradient(160deg, ${ds.bgSecondary} 0%, ${ds.bgPrimary} 60%)`,
        color: "white",
      }}
    >
      <Wordmark />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexGrow: 1,
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            color: ds.secondary,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 8,
            textTransform: "uppercase",
          }}
        >
          Final standings
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 12,
            fontSize: 52,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          {fit(tournamentName, 30)}
        </div>
        {meta ? (
          <div style={{ display: "flex", marginTop: 8, fontSize: 22, color: MUTED }}>
            {meta}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            marginTop: 56,
          }}
        >
          {columns.map((place) => (
            <PodiumCol key={place.place} place={place} />
          ))}
        </div>

        {roster.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: 48,
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                color: MUTED,
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              Champion roster
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: 16,
                gap: 14,
              }}
            >
              {roster.slice(0, 12).map((player) => (
                <div
                  key={player.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    borderRadius: 999,
                    border: `1px solid ${LINE}`,
                    background: PANEL,
                    padding: "8px 16px 8px 8px",
                  }}
                >
                  <Crest name={player.name} size={28} icon={player.icon} />
                  <div
                    style={{
                      display: "flex",
                      marginLeft: 10,
                      fontSize: 20,
                      color: "white",
                    }}
                  >
                    {fit(player.name, 18)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <Credit />
    </div>
  );
}

/* -------------------------------- Frame --------------------------------- */

function Wordmark() {
  return (
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
          color: "white",
        }}
      >
        Gamelyd
      </div>
    </div>
  );
}

function Body({
  model,
  width,
  scale,
}: {
  model: ExportModel;
  width: number;
  scale: number;
}) {
  if (model.kind === "bracket") {
    const trophy = Math.round(BRACKET_TROPHY_W * scale);
    const columnWidth = Math.round(BRACKET_COL_MIN * scale);
    const gap = Math.round(BRACKET_COL_GAP * scale);
    return (
      <div
        style={{
          display: "flex",
          flexGrow: 1,
          alignItems: "stretch",
          justifyContent: "center",
          gap,
        }}
      >
        {model.left.map((column, index) => (
          <BracketColumn
            key={`l-${column.label}-${index}`}
            column={column}
            width={columnWidth}
            scale={scale}
            side="left"
          />
        ))}
        <TrophyColumn final={model.final} scale={scale} width={trophy} />
        {/* Outermost round sits furthest from the centre on this side too. */}
        {[...model.right].reverse().map((column, index) => (
          <BracketColumn
            key={`r-${column.label}-${index}`}
            column={column}
            width={columnWidth}
            scale={scale}
            side="right"
          />
        ))}
      </div>
    );
  }

  if (model.kind === "fixtures") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          gap: 18,
        }}
      >
        {model.sections.map((section) => (
          <div
            key={section.label}
            style={{
              display: "flex",
              flexDirection: "column",
              background: PANEL,
              border: `1px solid ${LINE}`,
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                color: ds.secondary,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              {section.label}
            </div>
            {section.matches.map((match, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderTop: index === 0 ? "none" : `1px solid ${LINE}`,
                  paddingTop: 11,
                  paddingBottom: 11,
                }}
              >
                <FixtureSide side={match.home} align="left" />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: 190,
                  }}
                >
                  <div style={{ display: "flex", fontSize: 15, color: MUTED }}>
                    {match.played
                      ? `${match.home.score} – ${match.away.score}`
                      : "v"}
                  </div>
                  {match.when ? (
                    <div style={{ display: "flex", fontSize: 14, color: MUTED }}>
                      {match.when}
                    </div>
                  ) : null}
                </div>
                <FixtureSide side={match.away} align="right" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (model.kind === "tables") {
    // One block spans the page; several sit two across. Widths stay a little
    // under half so rounding can never tip a pair onto separate rows.
    const blockWidth = model.tables.length === 1 ? width - 96 : 740;
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          width: "100%",
          alignContent: "flex-start",
          gap: 18,
        }}
      >
        {model.tables.map((table, index) => (
          <Table key={`${table.name}-${index}`} table={table} width={blockWidth} />
        ))}
      </div>
    );
  }

  if (model.kind === "teams") {
    const cardWidth = Math.floor(
      (width - 96 - 16 * (TEAMS_PER_ROW - 1)) / TEAMS_PER_ROW,
    );
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          width: "100%",
          alignContent: "flex-start",
          gap: 16,
        }}
      >
        {model.teams.map((team) => (
          <TeamCard key={team.name} team={team} width={cardWidth} />
        ))}
      </div>
    );
  }

  // Champions never reaches here: it renders as its own poster.
  return null;
}

function Credit({ page = 1, pages = 1 }: { page?: number; pages?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        paddingTop: 16,
        borderTop: `1px solid ${LINE}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            width: 8,
            height: 8,
            borderRadius: 4,
            background: ds.primary,
          }}
        />
        <div style={{ display: "flex", marginLeft: 10, fontSize: 19, color: MUTED }}>
          Hosted on Gamelyd
        </div>
        {pages > 1 ? (
          <div style={{ display: "flex", marginLeft: 14, fontSize: 17, color: MUTED }}>
            · Page {page} of {pages}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", fontSize: 19, fontWeight: 600, color: ds.secondary }}>
        gamelyd.com
      </div>
    </div>
  );
}

export function ExportCardMarkup({
  layout,
  view,
  tournamentName,
  meta,
}: {
  layout: ExportLayout;
  view: ExportView;
  tournamentName: string;
  meta: string;
}) {
  if (layout.model.kind === "champions") {
    return (
      <ChampionPoster
        places={layout.model.places}
        tournamentName={tournamentName}
        meta={meta}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: 48,
        background: ds.bgPrimary,
        backgroundImage: `linear-gradient(140deg, ${ds.bgSecondary} 0%, ${ds.bgPrimary} 55%)`,
        color: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          paddingBottom: 20,
          borderBottom: `1px solid ${LINE}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Wordmark />
          <div
            style={{
              display: "flex",
              marginTop: 12,
              fontSize: 42,
              fontWeight: 700,
              color: "white",
            }}
          >
            {fit(tournamentName, 42)}
          </div>
          {meta ? (
            <div style={{ display: "flex", marginTop: 6, fontSize: 20, color: MUTED }}>
              {meta}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            background: ds.primary,
            color: ds.onPrimary,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 1,
            padding: "10px 20px",
            borderRadius: 10,
          }}
        >
          {EXPORT_VIEW_LABEL[view].toUpperCase()}
        </div>
      </div>

      <div style={{ display: "flex", flexGrow: 1, paddingTop: 26, paddingBottom: 18 }}>
        <Body model={layout.model} width={layout.width} scale={layout.scale} />
      </div>

      <Credit pages={layout.pages} page={layout.page} />
    </div>
  );
}
