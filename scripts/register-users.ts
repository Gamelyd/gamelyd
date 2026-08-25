/**
 * Bulk-register existing users to a tournament (for seeding / testing).
 *
 * Inserts registration docs directly into the `registerTournament` collection,
 * so it does NOT send confirmation emails. It still enforces the same core
 * rules as the app: tournament must exist and be open (not started / deleted /
 * suspended), team names + players must be unique per tournament, and each team
 * gets the right roster size (SINGLE=1, DUO=2, SQUAD=4).
 *
 * Usage:
 *   npx tsx scripts/register-users.ts <tournamentId> [userCount]
 *   npx tsx scripts/register-users.ts 6a8d7c742c5f585bdae3e608 20
 */
import { MongoClient, ObjectId, type Document } from "mongodb";

function loadEnvFiles(): void {
  for (const file of [".env", ".env.local"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // ignore missing files; env may already be set
    }
  }
}

function readString(doc: Document, keys: string[]): string {
  for (const k of keys) {
    const v = doc[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}

function readBool(doc: Document, keys: string[]): boolean {
  for (const k of keys) {
    if (typeof doc[k] === "boolean") return doc[k] as boolean;
  }
  return false;
}

function rosterSize(team: string): number {
  if (team === "DUO") return 2;
  if (team === "SQUAD") return 4;
  return 1;
}

async function main(): Promise<void> {
  loadEnvFiles();

  const tournamentId = process.argv[2];
  const userCount = Number(process.argv[3] ?? "20");
  if (!tournamentId || tournamentId.startsWith("--")) {
    console.error(
      "Usage: npx tsx scripts/register-users.ts <tournamentId> [userCount]",
    );
    process.exit(1);
  }
  if (!Number.isFinite(userCount) || userCount < 1) {
    console.error("userCount must be a positive number");
    process.exit(1);
  }

  const url = process.env.MONGODB_URL;
  const dbName = process.env.DB_NAME ?? "cluster0";
  if (!url) {
    console.error(
      "Missing MONGODB_URL (set it in .env.local or the environment).",
    );
    process.exit(1);
  }

  const client = new MongoClient(url, { serverSelectionTimeoutMS: 10_000 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const tournaments = db.collection("tournament");
    const registrations = db.collection("registerTournament");
    const users = db.collection("user");

    // Find the tournament by ObjectId or by public TournamentId field.
    const or: Document[] = [
      { TournamentId: tournamentId },
      { tournamentid: tournamentId },
    ];
    if (ObjectId.isValid(tournamentId)) {
      or.push({ _id: new ObjectId(tournamentId) });
    }
    const tournament = await tournaments.findOne({ $or: or });
    if (!tournament) {
      console.error(`No tournament found for id: ${tournamentId}`);
      process.exit(1);
    }

    const publicId = readString(tournament, ["TournamentId", "tournamentid"]);
    const name = readString(tournament, ["Name", "name"]);
    const team = readString(tournament, ["Team", "team"]) || "SINGLE";
    const size = rosterSize(team);

    if (readBool(tournament, ["Start", "start"])) {
      console.error(`"${name}" has already started — registration is closed.`);
      process.exit(1);
    }
    if (readBool(tournament, ["IsDeleted", "isdeleted"])) {
      console.error(`"${name}" is deleted.`);
      process.exit(1);
    }
    if (readBool(tournament, ["IsSuspended", "issuspended"])) {
      console.error(`"${name}" is suspended.`);
      process.exit(1);
    }

    // Existing registrations for this tournament (to skip dup teams/players).
    const existingRegs = await registrations
      .find({
        $or: [{ TournamentId: publicId }, { tournamentid: publicId }],
      })
      .toArray();
    const takenTeamNames = new Set<string>();
    const registeredUserIds = new Set<string>();
    for (const reg of existingRegs) {
      const tn = readString(reg, ["TeamName", "teamname"]);
      if (tn) takenTeamNames.add(tn.toLowerCase());
      const players = (reg.Players ?? reg.players ?? []) as Document[];
      for (const p of players) {
        const uid = readString(p, ["User_id", "user_id"]);
        if (uid) registeredUserIds.add(uid);
      }
    }

    // Pull candidate users: active, with a public user_id, not already in.
    const candidates = await users
      .find({
        $and: [
          { $or: [{ isDeleted: { $ne: true } }] },
          { $or: [{ isSuspended: { $ne: true } }] },
        ],
      })
      .toArray();

    const eligible = candidates.filter((u) => {
      const uid = readString(u, ["user_id", "User_id"]);
      return uid && !registeredUserIds.has(uid);
    });

    const teamsToCreate = Math.floor(eligible.length / size) >= 1;
    if (!teamsToCreate) {
      console.error(
        `Not enough eligible users (${eligible.length}) to form a team of ${size}.`,
      );
      process.exit(1);
    }

    const maxTeams = Math.floor(userCount / size);
    const usableTeams = Math.min(maxTeams, Math.floor(eligible.length / size));
    if (usableTeams < 1) {
      console.error(
        `userCount ${userCount} is too small for a team of ${size}.`,
      );
      process.exit(1);
    }

    const now = new Date().toISOString();
    const tIcon = readString(tournament, ["icon", "Icon", "TournamentIcon"]);
    const tDate = readString(tournament, ["Date", "date"]);
    const defaultIcon = tIcon || "https://gamelyd.co/default-avatar.png";

    const docs: Document[] = [];
    let cursor = 0;
    for (let i = 0; i < usableTeams; i++) {
      const roster = eligible.slice(cursor, cursor + size);
      cursor += size;

      const lead = roster[0];
      const leadName =
        readString(lead, ["user_name", "first_name"]) || "Player";

      // Build a unique team name for this tournament.
      let teamName = size > 1 ? `${leadName}'s Team` : leadName;
      let suffix = 2;
      while (takenTeamNames.has(teamName.toLowerCase())) {
        teamName = `${leadName} ${suffix}`;
        suffix += 1;
      }
      takenTeamNames.add(teamName.toLowerCase());

      const players = roster.map((u) => ({
        UserName: readString(u, ["user_name", "first_name"]) || "Player",
        GameUserName: readString(u, ["user_name"]),
        User_id: readString(u, ["user_id", "User_id"]),
        Email: readString(u, ["email"]),
        Icon: defaultIcon,
      }));

      const _id = new ObjectId();
      docs.push({
        _id,
        Players: players,
        Created_at: now,
        Updated_at: now,
        TournamentId: publicId,
        TournamentName: name,
        TournamentIcon: tIcon,
        TournamentDate: tDate,
        RegisterTournamentId: _id.toHexString(),
        TeamName: teamName,
        RefNumber: "",
        PaymentChannel: "",
        Amount: 0,
        Icon: defaultIcon,
      });
    }

    if (docs.length === 0) {
      console.error("Nothing to register.");
      process.exit(1);
    }

    await registrations.insertMany(docs);

    console.log(
      `Registered ${docs.length} team${docs.length === 1 ? "" : "s"} (${
        docs.length * size
      } player${docs.length * size === 1 ? "" : "s"}) to "${name}" [${team}].`,
    );
    for (const d of docs) {
      const names = (d.Players as Document[])
        .map((p) => p.UserName)
        .join(", ");
      console.log(`  • ${d.TeamName} — ${names}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  console.error("register-users failed:", err);
  process.exit(1);
});
