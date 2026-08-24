import type { Filter, Document } from "mongodb";

/** Cast a casing-tolerant filter onto a typed collection. */
export function asDocFilter<T>(filter: Filter<Document>): Filter<T> {
  return filter as Filter<T>;
}

/** Query helper: match a tournament id stored as PascalCase or Go-lowercase. */
export function byTournamentId(id: string): Filter<Document> {
  return byAnyTournamentId([id]);
}

/** Match any of the given public / hex ids against both stored casings. */
export function byAnyTournamentId(ids: string[]): Filter<Document> {
  const unique = [...new Set(ids.filter((id) => id.length > 0))];
  const clauses: Filter<Document>[] = [];
  for (const id of unique) {
    clauses.push({ TournamentId: id }, { tournamentid: id });
  }
  if (clauses.length === 0) return { _id: { $exists: false } };
  return { $or: clauses };
}

/** Query helper: match a draw id stored as PascalCase or Go-lowercase. */
export function byDrawId(id: string): Filter<Document> {
  return { $or: [{ DrawId: id }, { drawid: id }] };
}

/** Nested player user id — Go stored `players.user_id`. */
export function byPlayerUserId(userId: string): Filter<Document> {
  return {
    $or: [{ "Players.User_id": userId }, { "players.user_id": userId }],
  };
}

export function byUserId(userId: string): Filter<Document> {
  return { $or: [{ User_id: userId }, { user_id: userId }] };
}

export function byTeamName(name: string): Filter<Document> {
  return { $or: [{ TeamName: name }, { teamname: name }] };
}

export function byOrgId(orgId: string): Filter<Document> {
  return { $or: [{ OrgId: orgId }, { orgid: orgId }] };
}

/** Matches docs that are not deleted in either casing (missing counts as not deleted). */
export function notDeleted(): Filter<Document> {
  return {
    $and: [{ IsDeleted: { $ne: true } }, { isdeleted: { $ne: true } }],
  };
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function readString(
  doc: Record<string, unknown>,
  keys: string[],
  fallback = "",
): string {
  for (const key of keys) {
    const value = doc[key];
    if (typeof value === "string") return value;
  }
  return fallback;
}

export function readBool(
  doc: Record<string, unknown>,
  keys: string[],
): boolean {
  for (const key of keys) {
    const value = doc[key];
    if (typeof value === "boolean") return value;
  }
  return false;
}

export function readNumber(
  doc: Record<string, unknown>,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    const value = doc[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return fallback;
}

export function readDate(
  doc: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = doc[key];
    if (typeof value === "string") return value;
    if (value instanceof Date) return value.toISOString();
  }
  return "";
}

export function readArray(doc: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = doc[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}
