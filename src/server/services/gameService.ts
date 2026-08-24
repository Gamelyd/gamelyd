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

export async function listGames(activeOnly = false): Promise<Game[]> {
  const col = await games();
  // Treat missing `active` as selectable so admin-created games always appear
  // unless they were explicitly deactivated.
  const filter = activeOnly ? { active: { $ne: false } } : {};
  const docs = await col.find(filter).sort({ name: 1 }).limit(500).toArray();
  return docs.map(serializeGame);
}

export async function getGameById(gameId: string): Promise<Game | null> {
  const col = await games();
  const found = await col.findOne({ game_id: gameId });
  return found ? serializeGame(found) : null;
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
