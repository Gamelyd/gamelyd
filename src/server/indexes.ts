import type { Db, IndexDescription } from "mongodb";
import { Collections } from "./collections";

/**
 * Single source of truth for the secondary indexes that back our hot query
 * paths. Index keys mirror the fields the services actually filter/sort on.
 *
 * Consumed by:
 *  - the Next runtime (`getDb()` in `db.ts`), which creates them once per
 *    process on first DB access; and
 *  - the standalone setup script (`scripts/create-indexes.ts`) you can run
 *    against a fresh database.
 *
 * NOTE: keys cover both PascalCase (new app writes) and lowercase (Go/mgo
 * legacy documents). Mongo ignores missing fields, so both sets are safe.
 */
export const INDEX_SPECS: Record<string, IndexDescription[]> = {
  [Collections.user]: [
    { key: { user_id: 1 } },
    { key: { email: 1 } },
    { key: { user_name: 1 } },
    { key: { phone: 1 } },
  ],
  [Collections.tournament]: [
    { key: { TournamentId: 1 } },
    { key: { tournamentid: 1 } },
    { key: { User_id: 1, _id: -1 } },
    { key: { user_id: 1, _id: -1 } },
    { key: { OrgId: 1, IsDeleted: 1, _id: -1 } },
    { key: { orgid: 1, isdeleted: 1, _id: -1 } },
    { key: { TournamentType: 1, IsDeleted: 1, _id: -1 } },
    { key: { tournamenttype: 1, isdeleted: 1, _id: -1 } },
    { key: { Payment: 1, TournamentMode: 1, IsDeleted: 1, _id: -1 } },
    { key: { payment: 1, tournamentmode: 1, isdeleted: 1, _id: -1 } },
    { key: { Payment: 1, IsDeleted: 1, _id: -1 } },
    { key: { payment: 1, isdeleted: 1, _id: -1 } },
  ],
  [Collections.registerTournament]: [
    { key: { TournamentId: 1 } },
    { key: { tournamentid: 1 } },
    { key: { "Players.User_id": 1, _id: -1 } },
    { key: { "players.user_id": 1, _id: -1 } },
    { key: { TournamentId: 1, TeamName: 1 } },
    { key: { tournamentid: 1, teamname: 1 } },
  ],
  [Collections.draw]: [
    { key: { TournamentId: 1 } },
    { key: { tournamentid: 1 } },
    { key: { DrawId: 1 } },
    { key: { drawid: 1 } },
  ],
  [Collections.notification]: [{ key: { user_id: 1, _id: -1 } }],
  [Collections.inviteTournament]: [
    { key: { tournament_id: 1 } },
    { key: { user_id: 1 } },
  ],
  [Collections.contact]: [{ key: { ContactId: 1 } }],
  [Collections.reportAbuse]: [{ key: { ReportAbuseId: 1 } }],
  [Collections.org]: [
    { key: { org_id: 1 } },
    { key: { owner_id: 1 } },
    { key: { name: 1 } },
  ],
  [Collections.orgMember]: [
    { key: { org_id: 1, user_id: 1 } },
    { key: { user_id: 1 } },
    { key: { org_id: 1, role: 1 } },
  ],
  [Collections.orgInvite]: [
    { key: { invite_id: 1 } },
    { key: { invitee_id: 1, status: 1, _id: -1 } },
    { key: { org_id: 1, invitee_id: 1, status: 1 } },
  ],
  [Collections.game]: [
    { key: { game_id: 1 } },
    { key: { active: 1, name: 1 } },
  ],
  [Collections.platform]: [
    { key: { platform_id: 1 } },
    { key: { active: 1, name: 1 } },
  ],
};

/**
 * Ensure all secondary indexes exist. `createIndexes` is idempotent, so this is
 * safe to run repeatedly (on every boot, or as a deploy/setup step). Returns the
 * per-collection index names that were ensured.
 */
export async function ensureIndexes(
  db: Db,
): Promise<Record<string, string[]>> {
  const entries = await Promise.all(
    Object.entries(INDEX_SPECS).map(async ([name, indexes]) => {
      const created = await db.collection(name).createIndexes(indexes);
      return [name, created] as const;
    }),
  );
  return Object.fromEntries(entries);
}
