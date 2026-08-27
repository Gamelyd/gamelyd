import "server-only";
import { ObjectId } from "mongodb";
import { draws, games, icons, registrations, tournaments } from "../db";
import type {
  DrawDoc,
  IconDoc,
  IconKind,
  RegisterTournamentDoc,
  TournamentDoc,
} from "../documents";
import { serializeIcon, serializeDraw, serializeRegistration } from "../serialize";
import {
  asDocFilter,
  asRecord,
  byAnyTournamentId,
  readArray,
  readString,
} from "../legacy";
import { ServiceError } from "./userService";
import {
  FALLBACKS,
  PLAYER_ICONS,
  TEAM_ICONS,
  TOURNAMENT_ICONS,
  catalogToAppIcon,
  pickStableIcon,
  seedGameTests,
  type AppIcon,
} from "@/lib/icons";
import type {
  CreateIconInput,
  IconAsset,
  UpdateIconInput,
} from "@/lib/schemas/icon";
import type { Player, Teams } from "@/lib/schemas/draw";

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "icon";
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const col = await icons();
  let slug = base;
  let n = 2;
  while (true) {
    const taken = await col.findOne({
      slug,
      ...(excludeId ? { icon_id: { $ne: excludeId } } : {}),
    });
    if (!taken) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

function seedRows(): {
  slug: string;
  kind: IconKind;
  name: string;
  url: string;
}[] {
  return [
    ...TOURNAMENT_ICONS.map((icon) => ({
      slug: icon.id,
      kind: "tournament" as const,
      name: icon.label,
      url: icon.url,
    })),
    ...TEAM_ICONS.map((icon) => ({
      slug: icon.id,
      kind: "team" as const,
      name: icon.label,
      url: icon.url,
    })),
    ...PLAYER_ICONS.map((icon) => ({
      slug: icon.id,
      kind: "player" as const,
      name: icon.label,
      url: icon.url,
    })),
  ];
}

function seedAsAssets(kind?: IconKind): IconAsset[] {
  return seedRows()
    .filter((row) => !kind || row.kind === kind)
    .map((row) => ({
      _id: row.slug,
      icon_id: row.slug,
      slug: row.slug,
      kind: row.kind,
      name: row.name,
      url: row.url,
      gameIds: [],
      archived: false,
      created_at: "",
      updated_at: "",
    }));
}

export async function seedIconsFromApp(): Promise<{
  inserted: number;
  updated: number;
  total: number;
}> {
  const col = await icons();
  const gameCol = await games();
  const gameDocs = await gameCol
    .find({ active: { $ne: false } })
    .project({ game_id: 1, name: 1 })
    .toArray();

  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;

  for (const row of seedRows()) {
    const tests =
      row.kind === "tournament"
        ? seedGameTests({ id: row.slug, label: row.name, url: row.url })
        : [];
    const gameIds = gameDocs
      .filter((game) => tests.some((test) => test.test(game.name)))
      .map((game) => game.game_id);

    const existing = await col.findOne({ slug: row.slug });
    if (!existing) {
      const _id = new ObjectId();
      const doc: IconDoc = {
        _id,
        icon_id: _id.toHexString(),
        slug: row.slug,
        kind: row.kind,
        name: row.name,
        url: row.url,
        gameIds,
        archived: false,
        created_at: now,
        updated_at: now,
      };
      await col.insertOne(doc);
      inserted += 1;
      continue;
    }

    const nextGameIds =
      existing.gameIds?.length > 0 ? existing.gameIds : gameIds;
    await col.updateOne(
      { _id: existing._id },
      {
        $set: {
          url: row.url,
          kind: row.kind,
          gameIds: nextGameIds,
          updated_at: now,
        },
      },
    );
    updated += 1;
  }

  return { inserted, updated, total: inserted + updated };
}

type IconQuery = {
  kind?: IconKind;
  gameId?: string;
  search?: string;
  includeArchived?: boolean;
};

export async function listIcons(input: IconQuery = {}): Promise<IconAsset[]> {
  const col = await icons();
  const filter: Record<string, unknown> = {};
  if (input.kind) filter.kind = input.kind;
  if (!input.includeArchived) filter.archived = { $ne: true };

  const docs = await col.find(filter).sort({ name: 1 }).limit(500).toArray();
  if (docs.length === 0) {
    if (input.includeArchived) return [];
    return filterSeed(seedAsAssets(input.kind), input);
  }

  return filterCatalog(docs.map(serializeIcon), input);
}

function filterSeed(items: IconAsset[], input: IconQuery): IconAsset[] {
  return filterCatalog(items, { ...input, gameId: undefined });
}

function filterCatalog(items: IconAsset[], input: IconQuery): IconAsset[] {
  let next = items;
  const search = input.search?.trim().toLowerCase();
  if (search) {
    next = next.filter((icon) => icon.name.toLowerCase().includes(search));
  }
  if (input.gameId && input.kind === "tournament") {
    const tagged = next.filter((icon) => icon.gameIds.includes(input.gameId!));
    if (tagged.length > 0) return tagged;
    return next.filter((icon) => icon.gameIds.length === 0);
  }
  return next;
}

export async function listAppIcons(
  kind: IconKind,
  gameId?: string,
): Promise<AppIcon[]> {
  const items = await listIcons({
    kind,
    gameId,
    includeArchived: false,
  });
  return items.map(catalogToAppIcon);
}

export async function playerIconForUser(userId: string): Promise<string> {
  const iconsList = await listAppIcons("player");
  return pickStableIcon(iconsList, userId, FALLBACKS.player);
}

export async function getIconById(iconId: string): Promise<IconAsset | null> {
  const col = await icons();
  const found = await col.findOne({ icon_id: iconId });
  return found ? serializeIcon(found) : null;
}

export async function createIcon(input: CreateIconInput): Promise<IconAsset> {
  const col = await icons();
  const now = new Date().toISOString();
  const slug = await uniqueSlug(slugify(input.name));
  const _id = new ObjectId();
  const doc: IconDoc = {
    _id,
    icon_id: _id.toHexString(),
    slug,
    kind: input.kind,
    name: input.name.trim(),
    url: input.url.trim(),
    gameIds: input.gameIds ?? [],
    archived: false,
    created_at: now,
    updated_at: now,
  };
  await col.insertOne(doc);
  return serializeIcon(doc);
}

export async function updateIcon(
  iconId: string,
  input: UpdateIconInput,
): Promise<IconAsset> {
  const col = await icons();
  const found = await col.findOne({ icon_id: iconId });
  if (!found) throw new ServiceError("Image not found");

  const $set: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name) {
    $set.name = input.name.trim();
    if (input.name.trim() !== found.name) {
      $set.slug = await uniqueSlug(slugify(input.name), iconId);
    }
  }
  if (input.url) $set.url = input.url.trim();
  if (input.kind) $set.kind = input.kind;
  if (input.gameIds) $set.gameIds = input.gameIds;

  const updated = await col.findOneAndUpdate(
    { icon_id: iconId },
    { $set },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Image not found");
  return serializeIcon(updated);
}

export async function archiveIcon(
  iconId: string,
  archived: boolean,
): Promise<boolean> {
  const col = await icons();
  const res = await col.updateOne(
    { icon_id: iconId },
    { $set: { archived, updated_at: new Date().toISOString() } },
  );
  if (res.matchedCount === 0) throw new ServiceError("Image not found");
  return archived;
}

export async function deleteIcon(iconId: string): Promise<void> {
  const col = await icons();
  const res = await col.deleteOne({ icon_id: iconId });
  if (res.deletedCount === 0) throw new ServiceError("Image not found");
}

export async function refreshTournamentCatalogIcons(tournamentId: string): Promise<{
  teams: number;
  players: number;
}> {
  const teamIcons = await listAppIcons("team");
  const playerIcons = await listAppIcons("player");
  if (teamIcons.length === 0 || playerIcons.length === 0) {
    throw new ServiceError(
      "Download images into the catalog first, then refresh this tournament",
    );
  }

  const found = await findTournament(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  const ids = relatedIds(found);
  const now = new Date().toISOString();

  const rCol = await registrations();
  const regs = await rCol
    .find(asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)))
    .toArray();

  const teamIconByName = new Map<string, string>();
  const playerIconByUser = new Map<string, string>();
  let teams = 0;
  let players = 0;

  for (const reg of regs) {
    const row = serializeRegistration(reg);
    const teamUrl = pickStableIcon(teamIcons, row.TeamName, FALLBACKS.team);
    teamIconByName.set(row.TeamName, teamUrl);
    const nextPlayers = row.Players.map((player) => {
      const url = pickStableIcon(playerIcons, player.User_id, FALLBACKS.player);
      if (player.User_id) playerIconByUser.set(player.User_id, url);
      players += 1;
      return { ...player, Icon: url };
    });
    await rCol.updateOne(
      { _id: reg._id },
      {
        $set: {
          Icon: teamUrl,
          Players: nextPlayers,
          Updated_at: now,
        },
      },
    );
    teams += 1;
  }

  const dCol = await draws();
  const drawDocs = await dCol
    .find(asDocFilter<DrawDoc>(byAnyTournamentId(ids)))
    .toArray();
  for (const draw of drawDocs) {
    const row = serializeDraw(draw);
    const $set: Record<string, unknown> = { Updated_at: now };
    if (row.Team1) {
      $set.Team1 = patchTeam(row.Team1, teamIconByName, playerIconByUser);
    }
    if (row.Team2) {
      $set.Team2 = patchTeam(row.Team2, teamIconByName, playerIconByUser);
    }
    if (row.BRTeams.length > 0) {
      $set.BRTeams = row.BRTeams.map((team) => ({
        ...team,
        Players: patchPlayers(team.Players, playerIconByUser),
      }));
    }
    await dCol.updateOne({ _id: draw._id }, { $set });
  }

  const rawGroups = readArray(asRecord(found), ["Groups", "groups"]);
  const groups = rawGroups.map((group) => {
    const row = asRecord(group);
    return {
      GroupName: readString(row, ["GroupName", "groupname"]),
      Teams: readArray(row, ["Teams", "teams"]).map((team) =>
        patchTeam(teamFromUnknown(team), teamIconByName, playerIconByUser),
      ),
    };
  });
  const rawWinner = asRecord(found).Winner ?? asRecord(found).winner;
  const winner = rawWinner
    ? patchTeam(teamFromUnknown(rawWinner), teamIconByName, playerIconByUser)
    : undefined;

  const tCol = await tournaments();
  await tCol.updateOne(
    { _id: found._id },
    {
      $set: {
        ...(groups.length > 0 ? { Groups: groups, groups } : {}),
        ...(winner ? { Winner: winner } : {}),
        Updated_at: now,
        updated_at: now,
      },
    },
  );

  return { teams, players };
}

function teamFromUnknown(raw: unknown): Teams {
  const t = asRecord(raw);
  return {
    TeamName: readString(t, ["TeamName", "teamname"]),
    Players: readArray(t, ["Players", "players"]).map((player) => {
      const p = asRecord(player);
      return {
        UserName: readString(p, ["UserName", "username"]),
        GameUserName: readString(p, ["GameUserName", "gameusername"]),
        User_id: readString(p, ["User_id", "user_id"]),
        Email: readString(p, ["Email", "email"]),
        Icon: readString(p, ["Icon", "icon"]),
      };
    }),
    Icon: readString(t, ["Icon", "icon"]),
    Points: Number(t.Points ?? t.points ?? 0) || 0,
    GoalsScored: Number(t.GoalsScored ?? t.goalsscored ?? 0) || 0,
    GoalsReceived: Number(t.GoalsReceived ?? t.goalsreceived ?? 0) || 0,
    GoalsDifference: Number(t.GoalsDifference ?? t.goalsdifference ?? 0) || 0,
  };
}

function patchTeam(
  team: Teams,
  teamIcons: Map<string, string>,
  playerIcons: Map<string, string>,
): Teams {
  const name = team.TeamName ?? "";
  return {
    ...team,
    Icon: teamIcons.get(name) ?? team.Icon,
    Players: patchPlayers(team.Players ?? [], playerIcons),
  };
}

function patchPlayers(
  players: Player[],
  playerIcons: Map<string, string>,
): Player[] {
  return players.map((player) => {
    const uid = player.User_id || "";
    const icon = playerIcons.get(uid);
    return icon ? { ...player, Icon: icon } : player;
  });
}

async function findTournament(id: string): Promise<TournamentDoc | null> {
  const col = await tournaments();
  if (ObjectId.isValid(id) && id.length === 24) {
    const byObjectId = await col.findOne({ _id: new ObjectId(id) });
    if (byObjectId) return byObjectId;
  }
  return col.findOne(
    asDocFilter<TournamentDoc>({
      $or: [{ TournamentId: id }, { tournamentid: id }],
    }),
  );
}

function relatedIds(doc: TournamentDoc): string[] {
  const raw = asRecord(doc);
  return [
    ...new Set(
      [
        doc._id.toHexString(),
        readString(raw, ["TournamentId", "tournamentid"]),
      ].filter((id) => id.length > 0),
    ),
  ];
}
