import "server-only";
import { ObjectId } from "mongodb";
import { games } from "../db";
import type { GameDoc } from "../documents";
import { serializeGame } from "../serialize";
import { ServiceError } from "./userService";
import type {
  CreateGameInput,
  Game,
  UpdateGameInput,
} from "@/lib/schemas/game";
import type { Paginated } from "@/lib/result";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function gamesFilter(
  activeOnly: boolean,
  search = "",
  kind = "",
): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = [];
  if (activeOnly) clauses.push({ active: { $ne: false } });
  const q = search.trim();
  if (q) {
    clauses.push({ name: { $regex: escapeRegex(q), $options: "i" } });
  }
  const slug = kind.trim().toLowerCase();
  if (slug && slug !== "all") {
    if (slug === "games") {
      clauses.push({
        $or: [{ kind: "games" }, { kind: { $exists: false } }, { kind: "" }],
      });
    } else {
      clauses.push({ kind: slug });
    }
  }
  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

export async function listGames(
  activeOnly = false,
  kind = "",
): Promise<Game[]> {
  const col = await games();
  const docs = await col
    .find(gamesFilter(activeOnly, "", kind))
    .sort({ name: 1 })
    .limit(500)
    .toArray();
  return docs.map(serializeGame);
}

export async function listGamesPage({
  activeOnly = true,
  search = "",
  page = 1,
  perPage = 12,
  kind = "",
}: {
  activeOnly?: boolean;
  search?: string;
  page?: number;
  perPage?: number;
  kind?: string;
}): Promise<Paginated<Game>> {
  const col = await games();
  const safePage = Math.max(page, 1);
  const size = Math.min(Math.max(perPage, 1), 48);
  const filter = gamesFilter(activeOnly, search, kind);
  const total = await col.countDocuments(filter);
  const docs = await col
    .find(filter)
    .sort({ name: 1 })
    .skip((safePage - 1) * size)
    .limit(size)
    .toArray();
  return {
    total,
    page: safePage,
    last_page: Math.max(Math.ceil(total / size), 1),
    items: docs.map(serializeGame),
  };
}

export async function getGameById(gameId: string): Promise<Game | null> {
  const col = await games();
  const found = await col.findOne({ game_id: gameId });
  return found ? serializeGame(found) : null;
}

export async function getGameByName(name: string): Promise<Game | null> {
  const col = await games();
  const found = await col.findOne({
    name: { $regex: `^${escapeRegex(name.trim())}$`, $options: "i" },
  });
  return found ? serializeGame(found) : null;
}

/** Create the game if the name is new. Image can be empty and filled in later. */
export async function ensureGame(name: string): Promise<{
  game: Game;
  created: boolean;
}> {
  const existing = await getGameByName(name);
  if (existing) return { game: existing, created: false };
  return {
    game: await createGame({
      name: name.trim(),
      image: "",
      platforms: [],
      active: true,
    }),
    created: true,
  };
}

export async function createGame(input: CreateGameInput): Promise<Game> {
  const col = await games();
  const exists = await col.countDocuments({ name: input.name });
  if (exists > 0) {
    throw new ServiceError("A game with that name already exists");
  }

  const now = new Date().toISOString();
  const _id = new ObjectId();
  const doc: GameDoc = {
    _id,
    game_id: _id.toHexString(),
    name: input.name,
    image: input.image,
    platforms: input.platforms,
    kind: input.kind || "games",
    formats: input.formats ?? [],
    allowDraw: input.allowDraw !== false,
    scoreLabel: input.scoreLabel === "Points" ? "Points" : "Goals",
    active: input.active,
    created_at: now,
    updated_at: now,
  };
  await col.insertOne(doc);
  return serializeGame(doc);
}

export async function updateGame(
  gameId: string,
  input: UpdateGameInput,
): Promise<Game> {
  const col = await games();
  if (input.name) {
    const taken = await col.countDocuments({
      name: input.name,
      game_id: { $ne: gameId },
    });
    if (taken > 0) {
      throw new ServiceError("A game with that name already exists");
    }
  }

  const updated = await col.findOneAndUpdate(
    { game_id: gameId },
    { $set: { ...input, updated_at: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Game not found");
  return serializeGame(updated);
}

export async function toggleGameActive(gameId: string): Promise<boolean> {
  const col = await games();
  const found = await col.findOne({ game_id: gameId });
  if (!found) throw new ServiceError("Game not found");
  const next = !found.active;
  await col.updateOne(
    { game_id: gameId },
    { $set: { active: next, updated_at: new Date().toISOString() } },
  );
  return next;
}

export async function deleteGame(gameId: string): Promise<void> {
  const col = await games();
  const res = await col.deleteOne({ game_id: gameId });
  if (res.deletedCount === 0) throw new ServiceError("Game not found");
}
