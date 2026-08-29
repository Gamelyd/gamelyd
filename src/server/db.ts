import "server-only";
import { MongoClient, type Collection, type Db } from "mongodb";
import { env } from "./env";
import { Collections } from "./collections";
import { ensureIndexes } from "./indexes";
import type {
  ContactUsDoc,
  CatalogKindDoc,
  DrawDoc,
  GameDoc,
  IconDoc,
  InviteTournamentDoc,
  NotificationDoc,
  OrgDoc,
  OrgInviteDoc,
  OrgMemberDoc,
  PaymentDoc,
  PayoutAccountDoc,
  PayoutDoc,
  PlatformDoc,
  RegisterTournamentDoc,
  ReportAbuseDoc,
  SavedTeamDoc,
  SavedTeamInviteDoc,
  SavedTeamMemberDoc,
  SettingsDoc,
  TournamentDoc,
  UserDoc,
} from "./documents";

/**
 * Cache the client across hot reloads in development so we don't exhaust
 * MongoDB connections. In production a single module instance is reused.
 */
const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
  _mongoIndexesReady?: Promise<void>;
};

function clientPromise(): Promise<MongoClient> {
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(env.mongodbUrl, {
      serverSelectionTimeoutMS: 10_000,
    });
    globalForMongo._mongoClientPromise = client.connect();
  }
  return globalForMongo._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise();
  const db = client.db(env.dbName);
  // Create indexes exactly once per process. Fire-and-forget so queries are
  // never blocked on it; failures are logged, not thrown. Set
  // `DB_AUTO_INDEX=false` to skip this (e.g. in prod, where you'd instead run
  // `npm run db:indexes` as a deploy/setup step).
  if (
    process.env.DB_AUTO_INDEX !== "false" &&
    !globalForMongo._mongoIndexesReady
  ) {
    globalForMongo._mongoIndexesReady = ensureIndexes(db)
      .then(() => undefined)
      .catch((err: unknown) => {
        console.error("[db] ensureIndexes failed:", err);
      });
  }
  return db;
}

export { Collections } from "./collections";

export async function users(): Promise<Collection<UserDoc>> {
  return (await getDb()).collection<UserDoc>(Collections.user);
}
export async function tournaments(): Promise<Collection<TournamentDoc>> {
  return (await getDb()).collection<TournamentDoc>(Collections.tournament);
}
export async function registrations(): Promise<
  Collection<RegisterTournamentDoc>
> {
  return (await getDb()).collection<RegisterTournamentDoc>(
    Collections.registerTournament,
  );
}
export async function invites(): Promise<Collection<InviteTournamentDoc>> {
  return (await getDb()).collection<InviteTournamentDoc>(
    Collections.inviteTournament,
  );
}
export async function draws(): Promise<Collection<DrawDoc>> {
  return (await getDb()).collection<DrawDoc>(Collections.draw);
}
export async function contacts(): Promise<Collection<ContactUsDoc>> {
  return (await getDb()).collection<ContactUsDoc>(Collections.contact);
}
export async function reports(): Promise<Collection<ReportAbuseDoc>> {
  return (await getDb()).collection<ReportAbuseDoc>(Collections.reportAbuse);
}
export async function notifications(): Promise<Collection<NotificationDoc>> {
  return (await getDb()).collection<NotificationDoc>(Collections.notification);
}
export async function orgs(): Promise<Collection<OrgDoc>> {
  return (await getDb()).collection<OrgDoc>(Collections.org);
}
export async function orgMembers(): Promise<Collection<OrgMemberDoc>> {
  return (await getDb()).collection<OrgMemberDoc>(Collections.orgMember);
}
export async function orgInvites(): Promise<Collection<OrgInviteDoc>> {
  return (await getDb()).collection<OrgInviteDoc>(Collections.orgInvite);
}
export async function games(): Promise<Collection<GameDoc>> {
  return (await getDb()).collection<GameDoc>(Collections.game);
}
export async function catalogKinds(): Promise<Collection<CatalogKindDoc>> {
  return (await getDb()).collection<CatalogKindDoc>(Collections.catalogKind);
}
export async function platforms(): Promise<Collection<PlatformDoc>> {
  return (await getDb()).collection<PlatformDoc>(Collections.platform);
}
export async function icons(): Promise<Collection<IconDoc>> {
  return (await getDb()).collection<IconDoc>(Collections.icon);
}
export async function payments(): Promise<Collection<PaymentDoc>> {
  return (await getDb()).collection<PaymentDoc>(Collections.payment);
}
export async function payouts(): Promise<Collection<PayoutDoc>> {
  return (await getDb()).collection<PayoutDoc>(Collections.payout);
}
export async function payoutAccounts(): Promise<Collection<PayoutAccountDoc>> {
  return (await getDb()).collection<PayoutAccountDoc>(
    Collections.payoutAccount,
  );
}
export async function settings(): Promise<Collection<SettingsDoc>> {
  return (await getDb()).collection<SettingsDoc>(Collections.settings);
}
export async function savedTeams(): Promise<Collection<SavedTeamDoc>> {
  return (await getDb()).collection<SavedTeamDoc>(Collections.savedTeam);
}
export async function savedTeamMembers(): Promise<
  Collection<SavedTeamMemberDoc>
> {
  return (await getDb()).collection<SavedTeamMemberDoc>(
    Collections.savedTeamMember,
  );
}
export async function savedTeamInvites(): Promise<
  Collection<SavedTeamInviteDoc>
> {
  return (await getDb()).collection<SavedTeamInviteDoc>(
    Collections.savedTeamInvite,
  );
}
