import "server-only";
import { ObjectId } from "mongodb";
import { draws, orgMembers, registrations, tournaments, invites, users } from "../db";
import type {
  DrawDoc,
  RegisterTournamentDoc,
  TournamentDoc,
} from "../documents";
import {
  serializeDraw,
  serializeRegistration,
  serializeTournament,
} from "../serialize";
import {
  asDocFilter,
  asRecord,
  byAnyTournamentId,
  byPlayerUserId,
  byTeamName,
  byTournamentId,
  byUserId,
  notDeleted,
  readString,
} from "../legacy";
import { ServiceError, getUserById } from "./userService";
import { getMembership, getOrgById, isMember } from "./orgService";
import {
  hydrateDraws,
  hydrateRegistrations,
  hydrateTournament,
} from "../hydrateVerified";
import { sendEmail } from "../email/mailer";
import {
  announcementEmail,
  createTournamentEmail,
  registerTournamentEmail,
  settingChangeEmail,
} from "../email/templates";
import { createNotifications } from "./notificationService";
import type { Tournament, PendingSettingChange } from "@/lib/schemas/tournament";
import { browseStatusClause, tournamentBrowsePhase } from "@/lib/tournamentStatus";
import { catalogKindClause } from "@/lib/catalog";
import { parseCountryCode } from "@/lib/countries";
import { geocodeVenue } from "../geocode";
import type { BrowseLocation } from "@/lib/venue";
import { nearestVenueKm } from "@/lib/venue";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { Player, Teams, Draw } from "@/lib/schemas/draw";
import type {
  AdminAddParticipantsInput,
  TournamentAnnouncement,
  SetGroupQualifiersInput,
  TournamentGroup,
  TournamentManager,
} from "@/lib/schemas/tournament";
import type { Paginated } from "@/lib/result";
import type {
  EditTournamentInput,
  SaveTournamentInput,
  SetGroupsInput,
  UpdateTournamentInput,
} from "@/lib/schemas/tournament";
import { editTournamentInputSchema } from "@/lib/schemas/tournament";
import type { RegisterTournamentInput } from "@/lib/schemas/register";
import {
  rosterOverCapMessage,
  rosterSize,
  rosterSpotsLeftMessage,
} from "@/lib/schemas/common";
import { PLATFORM_FEE_BPS } from "@/lib/fees";
import {
  asDisqualifiedSet,
  groupQualifiersComplete,
} from "@/lib/groupQualifiers";
import { computeLeagueStandings, standingToTeam } from "@/lib/leagueStandings";
import { checkInWindowOpen, registrationDeadlinePassed } from "@/lib/tournamentWindow";
import { FALLBACKS } from "@/lib/icons";
import { playerIconForUser } from "@/server/services/iconService";
import {
  isSeriousSettingPatch,
  settingChangeReady,
  summarizeSettingPatch,
} from "@/lib/settingChange";

const PER_PAGE = 10;
const EARTH_KM = 6378.1;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type VenueDoc = NonNullable<TournamentDoc["Venues"]>[number];

type ResolvedPlace = {
  Venues: VenueDoc[];
  VenueCountry: string;
  VenueCity: string;
  VenueLocation: string;
  VenueLat: number;
  VenueLng: number;
  VenueGeo?: { type: "Point"; coordinates: [number, number] };
};

async function resolveEventPlace(
  countryRaw: string | undefined,
  cityRaw: string | undefined,
  rows: { country?: string; location?: string }[],
): Promise<ResolvedPlace> {
  const country = parseCountryCode(countryRaw);
  const city = (cityRaw ?? "").trim();
  const point = city ? await geocodeVenue(city, country) : null;
  const venues: VenueDoc[] = [];
  for (const row of rows) {
    const place = (row.location ?? "").trim();
    if (!place) continue;
    const rowCountry = parseCountryCode(row.country) || country;
    const venuePoint = await geocodeVenue(place, rowCountry);
    venues.push({
      Country: rowCountry,
      Location: place,
      Lat: venuePoint?.lat ?? 0,
      Lng: venuePoint?.lng ?? 0,
      ...(venuePoint
        ? {
            Geo: {
              type: "Point" as const,
              coordinates: [venuePoint.lng, venuePoint.lat] as [number, number],
            },
          }
        : {}),
    });
  }
  const geo = point
    ? { type: "Point" as const, coordinates: [point.lng, point.lat] as [number, number] }
    : venues.find((row) => row.Geo)?.Geo;
  return {
    Venues: venues,
    VenueCountry: country,
    VenueCity: city,
    VenueLocation: city,
    VenueLat: point?.lat ?? venues[0]?.Lat ?? 0,
    VenueLng: point?.lng ?? venues[0]?.Lng ?? 0,
    ...(geo ? { VenueGeo: geo } : {}),
  };
}

function venueBrowseClause(
  loc: BrowseLocation | undefined,
): Record<string, unknown> | null {
  if (!loc) return null;
  const clauses: Record<string, unknown>[] = [];
  if (loc.country) {
    clauses.push({
      $or: [
        { "Venues.Country": loc.country },
        { VenueCountry: loc.country },
        { venuecountry: loc.country },
      ],
    });
  }
  if (loc.place) {
    const regex = { $regex: escapeRegex(loc.place), $options: "i" };
    clauses.push({
      $or: [
        { "Venues.Location": regex },
        { VenueLocation: regex },
        { venuelocation: regex },
        { VenueCity: regex },
        { venuecity: regex },
      ],
    });
  }
  if (loc.lat != null && loc.lng != null) {
    const geo = {
      $geoWithin: {
        $centerSphere: [[loc.lng, loc.lat], loc.radius / EARTH_KM],
      },
    };
    clauses.push({
      $or: [{ "Venues.Geo": geo }, { VenueGeo: geo }],
    });
  }
  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

function fundedPublicClause(): Record<string, unknown> {
  return {
    $nor: [
      {
        $and: [
          { $or: [{ Payment: "SPONSORED" }, { payment: "SPONSORED" }] },
          { PurseFunded: false },
        ],
      },
    ],
  };
}

export async function saveTournament(
  uid: string,
  input: SaveTournamentInput,
): Promise<Tournament> {
  const col = await tournaments();
  const now = new Date().toISOString();
  const _id = new ObjectId();

  // If hosting under an org, the caller must be a member of it.
  let orgId = "";
  let orgName = "";
  let orgIcon = "";
  let orgVerified = false;
  if (input.OrgId) {
    const membership = await getMembership(input.OrgId, uid);
    if (!membership) {
      throw new ServiceError("You are not a member of that organization");
    }
    const org = await getOrgById(input.OrgId);
    if (!org) throw new ServiceError("Organization not found");
    orgId = org.org_id;
    orgName = org.name;
    orgIcon = org.image;
    orgVerified = org.verified;
  }

  if (input.Payment === "PAID" && input.RegistrationAmount <= 0) {
    throw new ServiceError("Set an entry fee greater than zero");
  }
  if (input.Payment === "SPONSORED") {
    const total = (input.Prizes ?? []).reduce(
      (sum, prize) => sum + (prize.Amount || 0),
      0,
    );
    if (total <= 0) {
      throw new ServiceError("Set prize amounts greater than zero");
    }
  }

  const venue = await resolveEventPlace(
    input.VenueCountry,
    input.VenueCity || input.VenueLocation,
    input.Venues ?? [],
  );

  const doc: TournamentDoc = {
    _id,
    Name: input.Name,
    GameName: input.GameName,
    icon: input.icon,
    TournamentType: input.TournamentType,
    Payment: input.Payment,
    Currency: input.Payment === "FREE" ? "USD" : input.Currency,
    TournamentMode: input.TournamentMode,
    TournamentSize: input.TournamentSize,
    Team: input.Team,
    Shuffle: input.Shuffle,
    Created_at: now,
    Updated_at: now,
    TournamentId: _id.toHexString(),
    User_id: uid,
    OrgId: orgId,
    OrgName: orgName,
    OrgIcon: orgIcon,
    OrgVerified: orgVerified,
    Active: true,
    IsDeleted: false,
    IsSuspended: false,
    Start: false,
    Link: input.Link,
    Date: input.Date,
    IsPaid: input.Payment === "PAID",
    IsDrawn: false,
    RefNumber: input.RefNumber,
    PaymentChannel: input.PaymentChannel,
    Amount:
      input.Payment === "SPONSORED" && input.Prizes?.length
        ? input.Prizes.reduce((sum, prize) => sum + (prize.Amount || 0), 0)
        : input.Amount,
    RegistrationAmount:
      input.Payment === "PAID" ? input.RegistrationAmount : 0,
    Prizes: input.Payment === "SPONSORED" || input.Payment === "PAID"
      ? (input.Prizes ?? [])
      : [],
    PlatformFeeBps: PLATFORM_FEE_BPS,
    PurseFunded: input.Payment !== "SPONSORED",
    PotNet: 0,
    FeeCollected: 0,
    SettlementStatus: "NONE",
    Note: input.Note,
    Announcements: [],
    AcceptedInvites: [],
    Platform: input.Platform,
    CatalogKind: input.CatalogKind || "games",
    FormatName: input.FormatName || "",
    RosterCount: input.RosterCount || 0,
    AllowDraw: input.AllowDraw !== false,
    ScoreLabel: input.ScoreLabel === "Points" ? "Points" : "Goals",
    Stage: 0,
    Groups: [],
    PointSystem: {
      Win: input.PointSystem?.Win ?? 3,
      Draw: input.AllowDraw === false ? 0 : (input.PointSystem?.Draw ?? 1),
    },
    ReturnLeg:
      input.TournamentMode === "LEAGUE" || input.TournamentMode === "GROUPS"
        ? Boolean(input.ReturnLeg)
        : false,
    Featured: false,
    Managers: [],
    OwnerCanReshuffleGroups: true,
    OwnerCanAddParticipants: false,
    OwnerCanSelectQualifiers:
      input.TournamentMode === "GROUPS"
        ? Boolean(input.OwnerCanSelectQualifiers)
        : false,
    Qualifiers: [],
    DisqualifiedTeams: [],
    AdvancePerGroup:
      input.TournamentMode === "GROUPS" ? input.AdvancePerGroup || 2 : 2,
    GroupCount: input.TournamentMode === "GROUPS" ? input.GroupCount || 0 : 0,
    KnockoutFormat:
      input.TournamentMode === "MULTIPLAYER" ||
      input.TournamentMode === "GROUPS"
        ? input.KnockoutFormat || "SINGLE"
        : "SINGLE",
    KnockoutFinalsSeries:
      (input.TournamentMode === "MULTIPLAYER" ||
        input.TournamentMode === "GROUPS") &&
      (input.KnockoutFormat || "SINGLE") !== "SINGLE"
        ? Boolean(input.KnockoutFinalsSeries)
        : false,
    ThirdPlace:
      input.TournamentMode === "MULTIPLAYER" ||
      input.TournamentMode === "GROUPS"
        ? Boolean(input.ThirdPlace)
        : false,
    TieBreaker:
      input.TournamentMode === "LEAGUE" || input.TournamentMode === "GROUPS"
        ? input.TieBreaker || "GOAL_DIFF"
        : "GOAL_DIFF",
    BrLobbyCount:
      input.TournamentMode === "BATTLEROYALE" ? input.BrLobbyCount || 1 : 1,
    BrKillPoints:
      input.TournamentMode === "BATTLEROYALE" ? (input.BrKillPoints ?? 1) : 1,
    BrFirstBloodPoints:
      input.TournamentMode === "BATTLEROYALE"
        ? (input.BrFirstBloodPoints ?? 0)
        : 0,
    BrPlacementPoints:
      input.TournamentMode === "BATTLEROYALE"
        ? input.BrPlacementPoints?.length
          ? input.BrPlacementPoints
          : [12, 9, 7, 5, 4, 3, 2, 1]
        : [12, 9, 7, 5, 4, 3, 2, 1],
    RegistrationDeadline: input.RegistrationDeadline || "",
    CheckInRequired: Boolean(input.CheckInRequired),
    CheckInOpens: input.CheckInOpens || "",
    CheckInCloses: input.CheckInCloses || "",
    FirstMatchAt: input.FirstMatchAt || "",
    MatchIntervalMinutes: input.MatchIntervalMinutes || 0,
    ...venue,
  };

  await col.insertOne(doc);

  const owner = await getUserById(uid);
  if (owner) void sendEmail(owner.email, createTournamentEmail(owner.first_name));

  return serializeTournament(doc);
}

export async function getTournamentById(
  tournamentId: string,
): Promise<Tournament | null> {
  const found = await findByAnyId(tournamentId);
  if (!found) return null;
  return hydrateTournament(serializeTournament(found));
}

export async function getPublicTournaments(
  search: string,
  page: number,
): Promise<Paginated<Tournament>> {
  const col = await tournaments();
  const safePage = Math.max(page, 1);
  const regex = { $regex: search, $options: "i" };
  const filter = asDocFilter<TournamentDoc>({
    $and: [
      notDeleted(),
      fundedPublicClause(),
      ...(search.trim().length > 0
        ? [
            {
              $or: [
                { Name: regex },
                { name: regex },
                { GameName: regex },
                { gamename: regex },
                { VenueLocation: regex },
                { venuelocation: regex },
                { VenueCity: regex },
                { venuecity: regex },
                { VenueCountry: regex },
                { venuecountry: regex },
                { "Venues.Location": regex },
                { "Venues.Country": regex },
              ],
            },
          ]
        : []),
    ],
  });

  const total = await col.countDocuments(filter);
  const docs = await col
    .find(filter)
    .sort({ _id: -1 })
    .skip((safePage - 1) * PER_PAGE)
    .limit(PER_PAGE)
    .toArray();

  return {
    total,
    page: safePage,
    last_page: Math.max(Math.ceil(total / PER_PAGE), 1),
    items: docs.map(serializeTournament),
  };
}

export async function getTournamentsByMode(
  payment: string,
  type: string,
  page: number,
  status = "ALL",
  kind = "ALL",
  location?: BrowseLocation,
): Promise<Paginated<Tournament>> {
  const col = await tournaments();
  const perPage = 15;
  const safePage = Math.max(page, 1);
  const clauses: Record<string, unknown>[] = [
    notDeleted(),
    fundedPublicClause(),
  ];
  if (payment && payment.toUpperCase() !== "ALL") {
    clauses.push({ $or: [{ Payment: payment }, { payment: payment }] });
  }
  if (type && type.toUpperCase() !== "ALL") {
    clauses.push({
      $or: [{ TournamentMode: type }, { tournamentmode: type }],
    });
  }
  const statusClause = browseStatusClause(status);
  if (statusClause) clauses.push(statusClause);
  const kindClause = catalogKindClause(kind);
  if (kindClause) clauses.push(kindClause);
  const venueClause = venueBrowseClause(location);
  if (venueClause) clauses.push(venueClause);

  const filter = asDocFilter<TournamentDoc>({ $and: clauses });

  const total = await col.countDocuments(filter);
  const docs = await col
    .find(filter)
    .sort({ _id: -1 })
    .skip((safePage - 1) * perPage)
    .limit(perPage)
    .toArray();

  const items = docs.map(serializeTournament);
  if (location?.lat != null && location.lng != null) {
    const origin = { lat: location.lat, lng: location.lng };
    items.sort((a, b) => {
      const da = nearestVenueKm(a, origin) ?? Number.POSITIVE_INFINITY;
      const db = nearestVenueKm(b, origin) ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
  }

  return {
    total,
    page: safePage,
    last_page: Math.max(Math.ceil(total / perPage), 1),
    items,
  };
}

export async function getTournamentsByModeLimit(
  payment: string,
): Promise<Tournament[]> {
  const col = await tournaments();
  const docs = await col
    .find(
      asDocFilter<TournamentDoc>({
        $and: [
          { $or: [{ Payment: payment }, { payment: payment }] },
          notDeleted(),
          fundedPublicClause(),
        ],
      }),
    )
    .sort({ _id: -1 })
    .limit(10)
    .toArray();
  return docs.map(serializeTournament);
}

const BANNER_SLOTS = 2;

export async function getBannerTournaments(): Promise<Tournament[]> {
  const col = await tournaments();
  const docs = await col
    .find(
      asDocFilter<TournamentDoc>({
        $and: [
          { $or: [{ Featured: true }, { featured: true }] },
          notDeleted(),
          fundedPublicClause(),
          { IsSuspended: { $ne: true } },
          { issuspended: { $ne: true } },
        ],
      }),
    )
    .sort({ FeaturedAt: -1, _id: -1 })
    .limit(BANNER_SLOTS)
    .toArray();
  return docs.map(serializeTournament);
}

export async function adminToggleFeaturedTournament(id: string): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  const current = serializeTournament(found);
  const next = !current.Featured;
  const now = new Date().toISOString();

  if (next) {
    const featured = await col
      .find(
        asDocFilter<TournamentDoc>({
          $and: [
            { $or: [{ Featured: true }, { featured: true }] },
            { _id: { $ne: found._id } },
          ],
        }),
      )
      .sort({ FeaturedAt: 1, _id: 1 })
      .toArray();
    const overflow = featured.slice(0, Math.max(featured.length - (BANNER_SLOTS - 1), 0));
    for (const extra of overflow) {
      await col.updateOne(
        { _id: extra._id },
        {
          $set: {
            Featured: false,
            featured: false,
            FeaturedAt: "",
            featuredAt: "",
            Updated_at: now,
            updated_at: now,
          },
        } as unknown as Parameters<typeof col.updateOne>[1],
      );
    }
  }

  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        Featured: next,
        featured: next,
        FeaturedAt: next ? now : "",
        featuredAt: next ? now : "",
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return next;
}

export async function listUserTournaments(
  userId: string,
  page: number,
): Promise<Paginated<Tournament>> {
  const col = await tournaments();
  const perPage = 9;
  const safePage = Math.max(page, 1);
  const filter = asDocFilter<TournamentDoc>(byUserId(userId));

  const total = await col.countDocuments(filter);
  const docs = await col
    .find(filter)
    .sort({ _id: -1 })
    .skip((safePage - 1) * perPage)
    .limit(perPage)
    .toArray();

  return {
    total,
    page: safePage,
    last_page: Math.max(Math.ceil(total / perPage), 1),
    items: docs.map(serializeTournament),
  };
}

export async function listUserTournamentsLimit(
  userId: string,
  limit = 7,
): Promise<Tournament[]> {
  const col = await tournaments();
  const docs = await col
    .find(asDocFilter<TournamentDoc>(byUserId(userId)))
    .sort({ _id: -1 })
    .limit(limit)
    .toArray();
  return docs.map(serializeTournament);
}

export async function listTournamentsAdmin(
  search: string,
  page: number,
): Promise<Paginated<Tournament>> {
  const col = await tournaments();
  const perPage = 20;
  const safePage = Math.max(page, 1);
  const regex = { $regex: search.trim(), $options: "i" };
  const filter = asDocFilter<TournamentDoc>(
    search.trim().length > 0
      ? {
          $or: [
            { Name: regex },
            { name: regex },
            { GameName: regex },
            { gamename: regex },
          ],
        }
      : {},
  );

  const total = await col.countDocuments(filter);
  const docs = await col
    .find(filter)
    .sort({ _id: -1 })
    .skip((safePage - 1) * perPage)
    .limit(perPage)
    .toArray();

  return {
    total,
    page: safePage,
    last_page: Math.max(Math.ceil(total / perPage), 1),
    items: docs.map(serializeTournament),
  };
}

export async function adminToggleDeleteTournament(id: string): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  const next = !serializeTournament(found).IsDeleted;
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        IsDeleted: next,
        isdeleted: next,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return next;
}

export async function adminResetTournament(id: string): Promise<{
  tournament: Tournament;
  deletedDraws: number;
}> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");

  const ids = relatedIdsFromDoc(found);
  const dCol = await draws();
  const deleted = await dCol.deleteMany(
    asDocFilter<DrawDoc>(byAnyTournamentId(ids)),
  );

  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        Start: false,
        start: false,
        IsDrawn: false,
        isdrawn: false,
        Stage: 0,
        stage: 0,
        Active: false,
        active: false,
        Groups: [],
        groups: [],
        Qualifiers: [],
        qualifiers: [],
        DisqualifiedTeams: [],
        disqualifiedteams: [],
        Updated_at: now,
        updated_at: now,
      },
      $unset: {
        Winner: 1,
        winner: 1,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );

  const updated = await col.findOne({ _id: found._id });
  if (!updated) throw new ServiceError("Tournament not found");
  return {
    tournament: serializeTournament(updated),
    deletedDraws: deleted.deletedCount,
  };
}

export async function adminToggleSuspendTournament(id: string): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  const next = !serializeTournament(found).IsSuspended;
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        IsSuspended: next,
        issuspended: next,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return next;
}

export async function userRegisteredTournaments(
  userId: string,
  page: number,
): Promise<Paginated<RegisterTournament>> {
  const col = await registrations();
  const perPage = 9;
  const safePage = Math.max(page, 1);
  const filter = asDocFilter<RegisterTournamentDoc>(byPlayerUserId(userId));

  const total = await col.countDocuments(filter);
  const docs = await col
    .find(filter)
    .sort({ _id: -1 })
    .skip((safePage - 1) * perPage)
    .limit(perPage)
    .toArray();

  return {
    total,
    page: safePage,
    last_page: Math.max(Math.ceil(total / perPage), 1),
    items: await hydrateRegistrations(docs.map(serializeRegistration)),
  };
}

export async function userRegisteredTournamentsLimit(
  userId: string,
): Promise<RegisterTournament[]> {
  const col = await registrations();
  const docs = await col
    .find(asDocFilter<RegisterTournamentDoc>(byPlayerUserId(userId)))
    .sort({ _id: -1 })
    .limit(6)
    .toArray();
  return hydrateRegistrations(docs.map(serializeRegistration));
}

async function userHasPrivateAccess(
  uid: string,
  tournament: Tournament,
  doc: TournamentDoc,
): Promise<boolean> {
  if (tournament.TournamentType !== "PRIVATE") return true;
  if (await canManageTournament(uid, doc)) return true;
  if (tournament.AcceptedInvites.includes(uid)) return true;
  const accepted = await (
    await invites()
  ).findOne({
    tournament_id: tournament.TournamentId,
    $or: [{ invitee_id: uid }, { user_id: uid }],
    status: "ACCEPTED",
  });
  return Boolean(accepted);
}

export async function registerForTournament(
  tournamentId: string,
  input: RegisterTournamentInput,
  options?: {
    allowPartialRoster?: boolean;
    autoCheckIn?: boolean;
    paidPaymentId?: string;
    waiveFee?: boolean;
    actorUid?: string;
    captainOnly?: boolean;
    skipInviteGate?: boolean;
  },
): Promise<RegisterTournament> {
  const tournamentDoc = await findByAnyId(tournamentId);
  if (!tournamentDoc) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(tournamentDoc);

  if (tournament.IsDeleted) {
    throw new ServiceError("This tournament is no longer available");
  }
  if (tournament.IsSuspended) {
    throw new ServiceError("This tournament is suspended");
  }
  if (tournament.Start) {
    throw new ServiceError(
      "Registration is closed. This tournament has already started.",
    );
  }
  if (registrationDeadlinePassed(tournament.RegistrationDeadline)) {
    throw new ServiceError("Registration has closed for this tournament");
  }
  if (tournament.Payment === "SPONSORED" && !tournament.PurseFunded) {
    throw new ServiceError("Prize pool is not funded yet");
  }
  if (
    tournament.Payment === "PAID" &&
    !options?.paidPaymentId &&
    !options?.waiveFee
  ) {
    throw new ServiceError("Pay the entry fee to join this tournament");
  }

  const actor = options?.actorUid ?? input.Players[0]?.User_id;
  if (!options?.skipInviteGate && actor) {
    const allowed = await userHasPrivateAccess(actor, tournament, tournamentDoc);
    if (!allowed) {
      throw new ServiceError(
        "This tournament is invite-only. Accept an invite before you register.",
      );
    }
  }

  if (!options?.skipInviteGate && tournament.TournamentSize > 0) {
    const taken = await (
      await registrations()
    ).countDocuments(
      asDocFilter<RegisterTournamentDoc>(
        byAnyTournamentId([tournament.TournamentId, tournament._id]),
      ),
    );
    if (taken >= tournament.TournamentSize) {
      throw new ServiceError("Tournament full");
    }
  }

  if (options?.captainOnly) {
    if (!actor || input.Players.length !== 1 || input.Players[0].User_id !== actor) {
      throw new ServiceError(
        "Register yourself first, then invite teammates. They join when they accept.",
      );
    }
  }

  const needed = rosterSize(tournament.Team, tournament.RosterCount);
  if (input.Players.length < 1 || input.Players.length > needed) {
    throw new ServiceError(rosterOverCapMessage(needed));
  }

  const rCol = await registrations();

  const teamTaken = await rCol.countDocuments(
    asDocFilter<RegisterTournamentDoc>({
      $and: [byTournamentId(tournament.TournamentId), byTeamName(input.TeamName)],
    }),
  );
  if (teamTaken > 0) throw new ServiceError("Team name already registered");

  for (const player of input.Players) {
    const playerTaken = await rCol.countDocuments(
      asDocFilter<RegisterTournamentDoc>({
        $and: [
          byTournamentId(tournament.TournamentId),
          byPlayerUserId(player.User_id),
        ],
      }),
    );
    if (playerTaken > 0) {
      throw new ServiceError(`${player.UserName} is already registered`);
    }
  }

  const now = new Date().toISOString();
  const _id = new ObjectId();
  const doc: RegisterTournamentDoc = {
    _id,
    Players: input.Players,
    Created_at: now,
    Updated_at: now,
    TournamentId: tournament.TournamentId,
    TournamentName: tournament.Name,
    TournamentIcon: tournament.icon,
    TournamentDate: tournament.Date,
    RegisterTournamentId: _id.toHexString(),
    TeamName: input.TeamName,
    RefNumber: input.RefNumber,
    PaymentChannel: input.PaymentChannel,
    Amount: input.Amount,
    Icon: input.Icon,
    CheckedIn: !tournament.CheckInRequired || Boolean(options?.autoCheckIn),
    CheckedInAt:
      !tournament.CheckInRequired || options?.autoCheckIn ? now : "",
  };

  await rCol.insertOne(doc);

  for (const player of input.Players) {
    if (player.Email) {
      void sendEmail(
        player.Email,
        registerTournamentEmail(
          player.UserName,
          tournament.Name,
          input.TeamName,
          tournament.Date,
          tournamentId,
        ),
      );
    }
  }

  return serializeRegistration(doc);
}

/**
 * Host/admin: add existing users as a new team, or onto a team that
 * still has roster spots. Roster may be filled later up to the event size.
 */
export async function adminAddParticipants(
  uid: string,
  tournamentId: string,
  input: AdminAddParticipantsInput,
): Promise<RegisterTournament> {
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canManuallyAddParticipants(uid, found))) {
    throw new ServiceError(
      serializeTournament(found).OwnerCanAddParticipants
        ? "You are not allowed to add players to this tournament"
        : "Only an admin can add players for this tournament",
    );
  }
  const uniqueIds = [...new Set(input.userIds)];
  if (uniqueIds.length !== input.userIds.length) {
    throw new ServiceError("Each player can only be added once");
  }

  const foundUsers = await Promise.all(uniqueIds.map((id) => getUserById(id)));
  const missing = uniqueIds.filter((_, i) => !foundUsers[i]);
  if (missing.length > 0) {
    throw new ServiceError("One or more users were not found");
  }
  const users = foundUsers.filter((u): u is NonNullable<typeof u> => Boolean(u));
  const players = await Promise.all(
    users.map(async (u) => ({
      UserName: u.user_name || u.first_name || "Player",
      GameUserName: "",
      User_id: u.user_id,
      Email: u.email || "",
      Icon: await playerIconForUser(u.user_id),
      Verified: Boolean(u.verified),
    })),
  );

  const existingName = input.existingTeamName?.trim() ?? "";
  if (existingName) {
    return addPlayersToExistingTeam(found, existingName, players);
  }

  const tournament = serializeTournament(found);
  const needed = rosterSize(tournament.Team, tournament.RosterCount);
  if (players.length > needed) {
    throw new ServiceError(rosterOverCapMessage(needed));
  }

  const teamName =
    input.teamName?.trim() ||
    (users.length === 1
      ? users[0].user_name
      : users.map((u) => u.user_name).join(" / "));

  return registerForTournament(
    tournamentId,
    {
      TeamName: teamName,
      Icon: FALLBACKS.team,
      Players: players,
      RefNumber: "",
      PaymentChannel: "",
      Amount: 0,
    },
    {
      allowPartialRoster: true,
      autoCheckIn: true,
      waiveFee: true,
      skipInviteGate: true,
    },
  );
}

async function addPlayersToExistingTeam(
  found: TournamentDoc,
  teamName: string,
  newcomers: Player[],
): Promise<RegisterTournament> {
  const tournament = serializeTournament(found);
  if (tournament.Start) {
    throw new ServiceError(
      "Registration is closed. This tournament has already started.",
    );
  }
  const needed = rosterSize(tournament.Team, tournament.RosterCount);
  const ids = relatedIdsFromDoc(found);
  const rCol = await registrations();
  const reg = await rCol.findOne(
    asDocFilter<RegisterTournamentDoc>({
      $and: [byAnyTournamentId(ids), byTeamName(teamName)],
    }),
  );
  if (!reg) throw new ServiceError("Team not found");

  const mapped = serializeRegistration(reg);
  const already = new Set(mapped.Players.map((p) => p.User_id));
  for (const player of newcomers) {
    if (already.has(player.User_id)) {
      throw new ServiceError(`${player.UserName} is already on this team`);
    }
    const elsewhere = await rCol.countDocuments(
      asDocFilter<RegisterTournamentDoc>({
        $and: [byAnyTournamentId(ids), byPlayerUserId(player.User_id)],
      }),
    );
    if (elsewhere > 0) {
      throw new ServiceError(`${player.UserName} is already registered`);
    }
  }

  const nextPlayers = [...mapped.Players, ...newcomers];
  const left = needed - mapped.Players.length;
  if (nextPlayers.length > needed) {
    throw new ServiceError(rosterSpotsLeftMessage(left, needed));
  }

  const now = new Date().toISOString();
  const roomKey = `Players.${needed - newcomers.length}` as const;
  const updated = await rCol.findOneAndUpdate(
    {
      _id: reg._id,
      [roomKey]: { $exists: false },
    } as never,
    {
      $set: { Updated_at: now },
      $push: { Players: { $each: newcomers } },
    } as never,
    { returnDocument: "after" },
  );
  if (!updated) {
    throw new ServiceError(rosterOverCapMessage(needed));
  }
  return serializeRegistration(updated);
}

export async function addPlayerToTeam(
  tournamentId: string,
  teamName: string,
  player: Player,
): Promise<RegisterTournament> {
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  return addPlayersToExistingTeam(found, teamName, [player]);
}

export async function adminSetOwnerCanReshuffleGroups(
  id: string,
  enabled: boolean,
): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        OwnerCanReshuffleGroups: enabled,
        ownercanreshufflegroups: enabled,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return enabled;
}

export async function adminSetOwnerCanAddParticipants(
  id: string,
  enabled: boolean,
): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        OwnerCanAddParticipants: enabled,
        ownercanaddparticipants: enabled,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return enabled;
}

export async function adminSetOwnerCanSelectQualifiers(
  id: string,
  enabled: boolean,
): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        OwnerCanSelectQualifiers: enabled,
        ownercanselectqualifiers: enabled,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return enabled;
}

export async function listParticipants(
  tournamentId: string,
): Promise<RegisterTournament[]> {
  const col = await registrations();
  const ids = await relatedTournamentIds(tournamentId);
  const docs = await col
    .find(asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)))
    .limit(1000)
    .toArray();
  return hydrateRegistrations(docs.map(serializeRegistration));
}

export async function removeUserFromTournament(
  actorUid: string,
  userId: string,
  tournamentId: string,
): Promise<Player[]> {
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(found);
  if (tournament.Start) {
    throw new ServiceError(
      "This tournament has started. Disqualify the team instead.",
    );
  }
  if (
    actorUid !== userId &&
    !(await canAdministerTournament(actorUid, found))
  ) {
    throw new ServiceError("Only the tournament owner can remove a player");
  }

  const col = await registrations();
  const ids = relatedIdsFromDoc(found);
  const reg = await col.findOne(
    asDocFilter<RegisterTournamentDoc>({
      $and: [byAnyTournamentId(ids), byPlayerUserId(userId)],
    }),
  );
  if (!reg) return [];

  const mapped = serializeRegistration(reg);
  const remaining = mapped.Players.filter((p) => p.User_id !== userId);
  if (remaining.length === 0) {
    await col.deleteOne({ _id: reg._id });
    const groups = (tournament.Groups ?? []).map((group) => ({
      ...group,
      Teams: group.Teams.filter((team) => team.TeamName !== mapped.TeamName),
    }));
    const now = new Date().toISOString();
    const tCol = await tournaments();
    await tCol.updateOne(
      { _id: found._id },
      {
        $set: {
          Groups: groups,
          groups,
          Updated_at: now,
          updated_at: now,
        },
      } as unknown as Parameters<typeof tCol.updateOne>[1],
    );
  } else {
    await col.updateOne(
      { _id: reg._id },
      { $set: { Players: remaining, Updated_at: new Date().toISOString() } },
    );
  }
  await revokeInviteAccess(
    found,
    [userId],
    remaining.length === 0 ? mapped.RegisterTournamentId : "",
  );
  return remaining;
}

export async function canManuallyAddParticipants(
  uid: string,
  doc: TournamentDoc,
): Promise<boolean> {
  const user = await getUserById(uid);
  if (user?.user_type === "ADMIN") return true;
  const t = serializeTournament(doc);
  if (t.User_id !== uid) return false;
  return t.OwnerCanAddParticipants;
}

/**
 * True if the user can drag teams between groups before fixtures are drawn.
 * Platform admins always can. Owners and co-managers can only when the
 * admin has left OwnerCanReshuffleGroups on.
 */
export async function canReshuffleGroups(
  uid: string,
  doc: TournamentDoc,
): Promise<boolean> {
  const user = await getUserById(uid);
  if (user?.user_type === "ADMIN") return true;
  if (!serializeTournament(doc).OwnerCanReshuffleGroups) return false;
  return canManageTournament(uid, doc);
}

/**
 * True if the user can run the tournament: the creator, a platform admin, or
 * a co-manager the owner added.
 */
export async function canManageTournament(
  uid: string,
  doc: TournamentDoc,
): Promise<boolean> {
  const user = await getUserById(uid);
  if (user?.user_type === "ADMIN") return true;
  const t = serializeTournament(doc);
  if (t.User_id === uid) return true;
  return t.Managers.includes(uid);
}

export async function canManageTournamentById(
  uid: string,
  tournamentId: string,
): Promise<boolean> {
  const found = await findByAnyId(tournamentId);
  if (!found) return false;
  return canManageTournament(uid, found);
}

/**
 * True if the user owns the tournament or is a platform admin. Co-managers are
 * NOT included - only these two can manage co-managers or delete/suspend.
 */
export async function canAdministerTournament(
  uid: string,
  doc: TournamentDoc,
): Promise<boolean> {
  const user = await getUserById(uid);
  if (user?.user_type === "ADMIN") return true;
  return serializeTournament(doc).User_id === uid;
}

export async function canAdministerTournamentById(
  uid: string,
  tournamentId: string,
): Promise<boolean> {
  const found = await findByAnyId(tournamentId);
  if (!found) return false;
  return canAdministerTournament(uid, found);
}

/**
 * Owner or platform admin, and only when the admin has turned this on for
 * the tournament. Co-managers cannot pick qualifiers.
 */
export async function canSelectGroupQualifiers(
  uid: string,
  doc: TournamentDoc,
): Promise<boolean> {
  if (!serializeTournament(doc).OwnerCanSelectQualifiers) return false;
  return canAdministerTournament(uid, doc);
}

export async function setGroupQualifiers(
  uid: string,
  tournamentId: string,
  input: SetGroupQualifiersInput,
): Promise<SetGroupQualifiersInput["Qualifiers"]> {
  const col = await tournaments();
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(found);

  if (tournament.TournamentMode !== "GROUPS") {
    throw new ServiceError("This tournament is not a group tournament");
  }
  if (!tournament.OwnerCanSelectQualifiers) {
    throw new ServiceError(
      "Selecting qualifiers is not enabled for this tournament",
    );
  }
  if (!(await canSelectGroupQualifiers(uid, found))) {
    throw new ServiceError("Only the tournament owner can select who qualifies");
  }
  if (!tournament.Groups || tournament.Groups.length === 0) {
    throw new ServiceError("This tournament has no groups");
  }

  const ids = relatedIdsFromDoc(found);
  const dCol = await draws();
  const allDraws = (
    await dCol.find(asDocFilter<DrawDoc>(byAnyTournamentId(ids))).toArray()
  ).map(serializeDraw);
  const groupDraws = allDraws.filter((d) => d.Group);
  if (groupDraws.length === 0) {
    throw new ServiceError("Draw the group fixtures first");
  }
  if (groupDraws.some((d) => !d.Played)) {
    throw new ServiceError("Record every group result before selecting qualifiers");
  }
  const knockoutDraws = allDraws.filter(
    (d) => !d.Group && d.BRTeams.length === 0,
  );
  if (knockoutDraws.length > 0) {
    throw new ServiceError("The knockout stage has already been drawn");
  }

  const advancePerGroup = tournament.AdvancePerGroup || 2;
  const disqualified = asDisqualifiedSet(tournament.DisqualifiedTeams);
  const sections = tournament.Groups.map((group) => ({
    name: group.GroupName,
    standings: computeLeagueStandings(
      group.Teams,
      groupDraws.filter((d) => d.Group === group.GroupName),
      tournament.PointSystem,
      tournament.TieBreaker,
    ),
  }));

  const groupNames = new Set(tournament.Groups.map((g) => g.GroupName));
  for (const pick of input.Qualifiers) {
    if (!groupNames.has(pick.GroupName)) {
      throw new ServiceError(`Unknown group ${pick.GroupName}`);
    }
  }

  if (
    !groupQualifiersComplete(
      sections,
      input.Qualifiers,
      advancePerGroup,
      disqualified,
      true,
    )
  ) {
    throw new ServiceError(
      "Pick who goes through from each points tie, and add a public reason",
    );
  }

  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        Qualifiers: input.Qualifiers,
        qualifiers: input.Qualifiers,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return input.Qualifiers;
}

export async function disqualifyTeam(
  uid: string,
  tournamentId: string,
  teamName: string,
): Promise<{ tournament: Tournament; forfeited: number; draws: Draw[] }> {
  const trimmed = teamName.trim();
  if (!trimmed) throw new ServiceError("Team is required");

  const col = await tournaments();
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(uid, found))) {
    throw new ServiceError("Only the tournament owner can disqualify a team");
  }

  const tournament = serializeTournament(found);
  const already = asDisqualifiedSet(tournament.DisqualifiedTeams);
  if (already.has(trimmed)) {
    throw new ServiceError("This team is already disqualified");
  }

  const ids = relatedIdsFromDoc(found);
  const dCol = await draws();
  const drawDocs = await dCol
    .find(asDocFilter<DrawDoc>(byAnyTournamentId(ids)))
    .toArray();

  const now = new Date().toISOString();
  let forfeited = 0;
  for (const doc of drawDocs) {
    const draw = serializeDraw(doc);
    if (draw.Played) continue;
    const t1 = draw.Team1?.TeamName;
    const t2 = draw.Team2?.TeamName;
    const isBr = (draw.BRTeams?.length ?? 0) > 0;

    if (isBr) {
      const nextBr = draw.BRTeams.filter((t) => t.TeamName !== trimmed);
      if (nextBr.length === draw.BRTeams.length) continue;
      await dCol.updateOne(
        { _id: doc._id },
        {
          $set: {
            BRTeams: nextBr,
            brteams: nextBr,
            Updated_at: now,
            updated_at: now,
          },
        } as unknown as Parameters<typeof dCol.updateOne>[1],
      );
      forfeited += 1;
      continue;
    }

    if (t1 === trimmed && t2) {
      await dCol.updateOne(
        { _id: doc._id },
        {
          $set: {
            Team1Score: 0,
            Team2Score: 3,
            Winner: "Team2",
            winner: "Team2",
            Played: true,
            played: true,
            Updated_at: now,
            updated_at: now,
          },
        } as unknown as Parameters<typeof dCol.updateOne>[1],
      );
      forfeited += 1;
    } else if (t2 === trimmed && t1) {
      await dCol.updateOne(
        { _id: doc._id },
        {
          $set: {
            Team1Score: 3,
            Team2Score: 0,
            Winner: "Team1",
            winner: "Team1",
            Played: true,
            played: true,
            Updated_at: now,
            updated_at: now,
          },
        } as unknown as Parameters<typeof dCol.updateOne>[1],
      );
      forfeited += 1;
    }
  }

  const nextDq = [...tournament.DisqualifiedTeams, trimmed];
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        DisqualifiedTeams: nextDq,
        disqualifiedteams: nextDq,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );

  if (tournament.TournamentMode === "LEAGUE") {
    const leagueDraws = (
      await dCol.find(asDocFilter<DrawDoc>(byAnyTournamentId(ids))).toArray()
    ).map(serializeDraw);
    if (
      leagueDraws.length > 0 &&
      leagueDraws.every((d) => d.Played) &&
      leagueDraws.every((d) => d.BRTeams.length === 0)
    ) {
      const teams = leagueDraws.flatMap((item) =>
        [item.Team1, item.Team2].filter((team): team is Teams => Boolean(team)),
      );
      const unique = [
        ...new Map(teams.map((team) => [team.TeamName, team])).values(),
      ];
      const table = computeLeagueStandings(
        unique,
        leagueDraws,
        tournament.PointSystem,
        tournament.TieBreaker,
      ).filter((row) => row.TeamName !== trimmed);
      const leader = table[0];
      if (leader) {
        await col.updateOne(
          { _id: found._id },
          {
            $set: {
              Winner: standingToTeam(leader),
              winner: standingToTeam(leader),
              Active: false,
              active: false,
            },
          } as unknown as Parameters<typeof col.updateOne>[1],
        );
      }
    }
  }

  const updated = await col.findOne({ _id: found._id });
  if (!updated) throw new ServiceError("Tournament not found");
  const updatedDraws = (
    await dCol.find(asDocFilter<DrawDoc>(byAnyTournamentId(ids))).toArray()
  ).map(serializeDraw);
  return {
    tournament: serializeTournament(updated),
    forfeited,
    draws: updatedDraws,
  };
}

/** Drop a registered team before the tournament starts. After start, use disqualify. */
export async function removeRegisteredTeam(
  uid: string,
  tournamentId: string,
  teamName: string,
): Promise<{ teamName: string; groups: TournamentGroup[] }> {
  const trimmed = teamName.trim();
  if (!trimmed) throw new ServiceError("Team is required");

  const col = await tournaments();
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(uid, found))) {
    throw new ServiceError("Only the tournament owner can remove a team");
  }

  const tournament = serializeTournament(found);
  if (tournament.Start) {
    throw new ServiceError(
      "This tournament has started. Disqualify the team instead.",
    );
  }

  const ids = relatedIdsFromDoc(found);
  const rCol = await registrations();
  const reg = await rCol.findOne(
    asDocFilter<RegisterTournamentDoc>({
      $and: [byAnyTournamentId(ids), byTeamName(trimmed)],
    }),
  );
  if (!reg) throw new ServiceError("Team not found");
  const mapped = serializeRegistration(reg);
  await rCol.deleteOne({ _id: reg._id });

  const groups = (tournament.Groups ?? []).map((group) => ({
    ...group,
    Teams: group.Teams.filter((team) => team.TeamName !== trimmed),
  }));
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        Groups: groups,
        groups,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );

  await revokeInviteAccess(
    found,
    mapped.Players.map((p) => p.User_id),
    mapped.RegisterTournamentId,
  );

  return { teamName: trimmed, groups };
}

async function hydrateManagers(userIds: string[]): Promise<TournamentManager[]> {
  const unique = [...new Set(userIds.filter((id) => id.length > 0))];
  if (unique.length === 0) return [];
  const userCol = await users();
  const docs = await userCol.find({ user_id: { $in: unique } }).toArray();
  const byId = new Map(docs.map((u) => [u.user_id, u]));
  return unique.map((id) => {
    const u = byId.get(id);
    return {
      user_id: id,
      first_name: u?.first_name ?? "",
      last_name: u?.last_name ?? "",
      user_name: u?.user_name ?? "",
      email: u?.email ?? "",
      verified: Boolean(u?.verified),
    };
  });
}

/** Owner/admin: the co-managers currently allowed to help run the tournament. */
export async function listTournamentManagers(
  actorUid: string,
  tournamentId: string,
): Promise<TournamentManager[]> {
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(actorUid, found))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }
  return hydrateManagers(serializeTournament(found).Managers);
}

/**
 * Owner/admin: org members that can still be added as co-managers (excludes the
 * owner and anyone already added).
 */
export async function listAssignableManagers(
  actorUid: string,
  tournamentId: string,
): Promise<TournamentManager[]> {
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(actorUid, found))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }
  const t = serializeTournament(found);
  if (!t.OrgId) return [];

  const memberCol = await orgMembers();
  const memberships = await memberCol
    .find({ org_id: t.OrgId })
    .limit(500)
    .toArray();
  const taken = new Set([t.User_id, ...t.Managers]);
  const candidateIds = memberships
    .map((m) => m.user_id)
    .filter((id) => !taken.has(id));
  return hydrateManagers(candidateIds);
}

/** Owner/admin: grant an org member co-manager access. */
export async function addTournamentManager(
  actorUid: string,
  tournamentId: string,
  targetUserId: string,
): Promise<TournamentManager[]> {
  const col = await tournaments();
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(actorUid, found))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }
  const t = serializeTournament(found);
  if (targetUserId === t.User_id) {
    throw new ServiceError("The owner already manages this tournament");
  }
  if (!t.OrgId) {
    throw new ServiceError(
      "Host this tournament under an organization to add managers",
    );
  }
  if (!(await isMember(t.OrgId, targetUserId))) {
    throw new ServiceError("That user is not a member of the organization");
  }

  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $addToSet: { Managers: targetUserId },
      $set: { Updated_at: now, updated_at: now },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );

  const next = [...new Set([...t.Managers, targetUserId])];
  return hydrateManagers(next);
}

/** Owner/admin: revoke a co-manager's access. */
export async function removeTournamentManager(
  actorUid: string,
  tournamentId: string,
  targetUserId: string,
): Promise<TournamentManager[]> {
  const col = await tournaments();
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(actorUid, found))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }

  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $pull: { Managers: targetUserId },
      $set: { Updated_at: now, updated_at: now },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );

  const next = serializeTournament(found).Managers.filter(
    (id) => id !== targetUserId,
  );
  return hydrateManagers(next);
}

export async function toggleDeleteTournament(
  uid: string,
  id: string,
): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canManageTournament(uid, found))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }
  const next = !serializeTournament(found).IsDeleted;
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        IsDeleted: next,
        isdeleted: next,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return next;
}

export async function toggleSuspendTournament(
  uid: string,
  id: string,
): Promise<boolean> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canManageTournament(uid, found))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }
  const next = !serializeTournament(found).IsSuspended;
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: found._id },
    {
      $set: {
        IsSuspended: next,
        issuspended: next,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return next;
}

export async function updateTournament(
  uid: string,
  id: string,
  input: UpdateTournamentInput,
): Promise<Tournament> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canManageTournament(uid, found))) {
    throw new ServiceError("You are not allowed to edit this tournament");
  }

  const updated = await col.findOneAndUpdate(
    { _id: found._id },
    { $set: { ...input, Updated_at: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Tournament not found");
  return serializeTournament(updated);
}

/**
 * Owner/admin: edit settings. After the event starts, rules that change how
 * it is played wait for every registered player to accept, then the owner
 * applies them.
 */
export async function editTournamentSettings(
  actorUid: string,
  id: string,
  input: EditTournamentInput,
): Promise<{ tournament: Tournament; proposed: boolean }> {
  const col = await tournaments();
  const found = await findByAnyId(id);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(actorUid, found))) {
    throw new ServiceError("Only the tournament owner can edit settings");
  }

  const current = serializeTournament(found);
  if (current.Start && isSeriousSettingPatch(input)) {
    const tournament = await proposeSettingChange(actorUid, found, current, input);
    return { tournament, proposed: true };
  }

  const tournament = await applyTournamentSettings(actorUid, found, current, input);
  return { tournament, proposed: false };
}

export async function acceptSettingChange(
  uid: string,
  tournamentId: string,
): Promise<Tournament> {
  const col = await tournaments();
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  const current = serializeTournament(found);
  const pending = current.PendingSettingChange;
  if (!pending) throw new ServiceError("There is no setting change to accept");
  if (!pending.RequiredUserIds.includes(uid)) {
    throw new ServiceError("You are not in this tournament");
  }
  if (pending.AcceptedUserIds.includes(uid)) {
    return current;
  }

  const now = new Date().toISOString();
  const accepted = [...new Set([...pending.AcceptedUserIds, uid])];
  const next: PendingSettingChange = { ...pending, AcceptedUserIds: accepted };
  const updated = await col.findOneAndUpdate(
    { _id: found._id, "PendingSettingChange.Id": pending.Id },
    {
      $set: {
        PendingSettingChange: next,
        pendingsettingchange: next,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.findOneAndUpdate>[1],
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("There is no setting change to accept");
  const tournament = serializeTournament(updated);
  if (settingChangeReady(next)) {
    void notifyOwnerSettingChangeReady(found, current.Name, current.User_id);
  }
  return tournament;
}

export async function applySettingChange(
  actorUid: string,
  tournamentId: string,
): Promise<Tournament> {
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(actorUid, found))) {
    throw new ServiceError("Only the tournament owner can apply this change");
  }
  const current = serializeTournament(found);
  const pending = current.PendingSettingChange;
  if (!pending) throw new ServiceError("There is no setting change to apply");
  if (!settingChangeReady(pending)) {
    throw new ServiceError(
      "Everyone in the tournament has to accept before you can apply this",
    );
  }
  const parsed = parseInputSafe(pending.Patch);
  const tournament = await applyTournamentSettings(
    actorUid,
    found,
    current,
    parsed,
    { clearPending: true },
  );
  return tournament;
}

export async function cancelSettingChange(
  actorUid: string,
  tournamentId: string,
): Promise<Tournament> {
  const col = await tournaments();
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canAdministerTournament(actorUid, found))) {
    throw new ServiceError("Only the tournament owner can cancel this change");
  }
  if (!serializeTournament(found).PendingSettingChange) {
    throw new ServiceError("There is no setting change to cancel");
  }
  const now = new Date().toISOString();
  const updated = await col.findOneAndUpdate(
    { _id: found._id },
    {
      $unset: { PendingSettingChange: "", pendingsettingchange: "" },
      $set: { Updated_at: now, updated_at: now },
    } as unknown as Parameters<typeof col.findOneAndUpdate>[1],
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Tournament not found");
  return serializeTournament(updated);
}

function parseInputSafe(patch: Record<string, unknown>): EditTournamentInput {
  const parsed = editTournamentInputSchema.safeParse(patch);
  if (!parsed.success) {
    throw new ServiceError("That setting change is no longer valid");
  }
  return parsed.data;
}

async function proposeSettingChange(
  actorUid: string,
  found: TournamentDoc,
  current: Tournament,
  input: EditTournamentInput,
): Promise<Tournament> {
  if (current.PendingSettingChange) {
    throw new ServiceError(
      "There's already a setting change waiting. Cancel it or apply it first.",
    );
  }
  await validateSettingsInput(found, current, input);

  const roster = await rosterPlayersForDoc(found);
  const required = [...new Set(roster.map((p) => p.User_id).filter(Boolean))];
  const accepted = required.includes(actorUid) ? [actorUid] : [];
  const summary = summarizeSettingPatch(input);
  const pending: PendingSettingChange = {
    Id: new ObjectId().toHexString(),
    ProposedBy: actorUid,
    CreatedAt: new Date().toISOString(),
    Summary: summary,
    Patch: input as unknown as Record<string, unknown>,
    RequiredUserIds: required,
    AcceptedUserIds: accepted,
  };

  const now = new Date().toISOString();
  const col = await tournaments();
  const updated = await col.findOneAndUpdate(
    { _id: found._id },
    {
      $set: {
        PendingSettingChange: pending,
        pendingsettingchange: pending,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.findOneAndUpdate>[1],
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Tournament not found");

  const voters = roster.filter(
    (p) => p.User_id && !accepted.includes(p.User_id),
  );
  const message = `The host wants to change ${current.Name}: ${summary}. Accept it so it can be applied.`;
  void notifyRoster(
    voters,
    message,
    "SETTING_CHANGE",
    current.TournamentId,
    (name) => settingChangeEmail(name, current.Name, current.TournamentId, summary),
  );
  if (settingChangeReady(pending)) {
    void notifyOwnerSettingChangeReady(found, current.Name, current.User_id);
  }
  return serializeTournament(updated);
}

async function applyTournamentSettings(
  actorUid: string,
  found: TournamentDoc,
  current: Tournament,
  input: EditTournamentInput,
  extra?: { clearPending?: boolean },
): Promise<Tournament> {
  await validateSettingsInput(found, current, input);
  const ids = relatedIdsFromDoc(found);
  const now = new Date().toISOString();
  const set: Record<string, unknown> = { Updated_at: now, updated_at: now };

  if (input.TournamentSize !== undefined) {
    set.TournamentSize = input.TournamentSize;
    set.tournamentsize = input.TournamentSize;
  }
  if (input.RosterCount !== undefined) {
    set.RosterCount = input.RosterCount;
    set.rostercount = input.RosterCount;
  }
  if (input.Team !== undefined) {
    set.Team = input.Team;
    set.team = input.Team;
  }
  if (input.Shuffle !== undefined) {
    set.Shuffle = input.Shuffle;
    set.shuffle = input.Shuffle;
  }
  if (input.TournamentType !== undefined) {
    set.TournamentType = input.TournamentType;
    set.tournamenttype = input.TournamentType;
  }
  if (input.Name !== undefined) {
    set.Name = input.Name;
    set.name = input.Name;
  }
  if (input.Date !== undefined) {
    set.Date = input.Date;
    set.date = input.Date;
  }
  if (input.Note !== undefined) {
    set.Note = input.Note;
    set.note = input.Note;
  }
  if (input.ReturnLeg !== undefined) {
    set.ReturnLeg = input.ReturnLeg;
    set.returnleg = input.ReturnLeg;
  }
  if (input.AdvancePerGroup !== undefined) {
    set.AdvancePerGroup = input.AdvancePerGroup;
    set.advancepergroup = input.AdvancePerGroup;
  }
  if (input.GroupCount !== undefined) {
    set.GroupCount = input.GroupCount;
    set.groupcount = input.GroupCount;
  }
  if (input.PointSystem !== undefined) {
    set.PointSystem = {
      Win: input.PointSystem.Win,
      Draw: input.PointSystem.Draw,
    };
    set.pointsystem = set.PointSystem;
  }
  if (input.OwnerCanSelectQualifiers !== undefined) {
    set.OwnerCanSelectQualifiers = input.OwnerCanSelectQualifiers;
    set.ownercanselectqualifiers = input.OwnerCanSelectQualifiers;
  }
  if (input.KnockoutFormat !== undefined) {
    set.KnockoutFormat = input.KnockoutFormat;
    set.knockoutformat = input.KnockoutFormat;
    if (input.KnockoutFormat === "SINGLE") {
      set.KnockoutFinalsSeries = false;
      set.knockoutfinalsseries = false;
    }
  }
  if (input.KnockoutFinalsSeries !== undefined) {
    const format = (input.KnockoutFormat ||
      set.KnockoutFormat ||
      current.KnockoutFormat ||
      "SINGLE") as string;
    set.KnockoutFinalsSeries =
      format !== "SINGLE" && Boolean(input.KnockoutFinalsSeries);
    set.knockoutfinalsseries = set.KnockoutFinalsSeries;
  }
  if (input.ThirdPlace !== undefined) {
    set.ThirdPlace = input.ThirdPlace;
    set.thirdplace = input.ThirdPlace;
  }
  if (input.TieBreaker !== undefined) {
    set.TieBreaker = input.TieBreaker;
    set.tiebreaker = input.TieBreaker;
  }
  if (input.BrLobbyCount !== undefined) {
    set.BrLobbyCount = input.BrLobbyCount;
    set.brlobbycount = input.BrLobbyCount;
  }
  if (input.BrKillPoints !== undefined) {
    set.BrKillPoints = input.BrKillPoints;
    set.brkillpoints = input.BrKillPoints;
  }
  if (input.BrFirstBloodPoints !== undefined) {
    set.BrFirstBloodPoints = input.BrFirstBloodPoints;
    set.brfirstbloodpoints = input.BrFirstBloodPoints;
  }
  if (input.BrPlacementPoints !== undefined) {
    set.BrPlacementPoints = input.BrPlacementPoints;
    set.brplacementpoints = input.BrPlacementPoints;
  }
  if (input.RegistrationDeadline !== undefined) {
    set.RegistrationDeadline = input.RegistrationDeadline;
    set.registrationdeadline = input.RegistrationDeadline;
  }
  if (input.CheckInRequired !== undefined) {
    set.CheckInRequired = input.CheckInRequired;
    set.checkinrequired = input.CheckInRequired;
  }
  if (input.CheckInOpens !== undefined) {
    set.CheckInOpens = input.CheckInOpens;
    set.checkinopens = input.CheckInOpens;
  }
  if (input.CheckInCloses !== undefined) {
    set.CheckInCloses = input.CheckInCloses;
    set.checkincloses = input.CheckInCloses;
  }
  if (input.FirstMatchAt !== undefined) {
    set.FirstMatchAt = input.FirstMatchAt;
    set.firstmatchat = input.FirstMatchAt;
  }
  if (input.MatchIntervalMinutes !== undefined) {
    set.MatchIntervalMinutes = input.MatchIntervalMinutes;
    set.matchintervalminutes = input.MatchIntervalMinutes;
  }
  if (input.icon !== undefined) {
    set.icon = input.icon;
  }
  if (
    input.Venues !== undefined ||
    input.VenueCountry !== undefined ||
    input.VenueCity !== undefined ||
    input.VenueLocation !== undefined
  ) {
    const venue = await resolveEventPlace(
      input.VenueCountry !== undefined
        ? input.VenueCountry
        : (current.VenueCountry ?? ""),
      input.VenueCity !== undefined
        ? input.VenueCity
        : input.VenueLocation !== undefined
          ? input.VenueLocation
          : (current.VenueCity ?? current.VenueLocation ?? ""),
      input.Venues !== undefined
        ? input.Venues
        : (current.Venues ?? []).map((row) => ({
            country: row.country,
            location: row.location,
          })),
    );
    set.Venues = venue.Venues;
    set.venues = venue.Venues;
    set.VenueCountry = venue.VenueCountry;
    set.venuecountry = venue.VenueCountry;
    set.VenueCity = venue.VenueCity;
    set.venuecity = venue.VenueCity;
    set.VenueLocation = venue.VenueLocation;
    set.venuelocation = venue.VenueLocation;
    set.VenueLat = venue.VenueLat;
    set.venuelat = venue.VenueLat;
    set.VenueLng = venue.VenueLng;
    set.venuelng = venue.VenueLng;
    if (venue.VenueGeo) {
      set.VenueGeo = venue.VenueGeo;
    }
  }

  const col = await tournaments();
  const unset: Record<string, string> = extra?.clearPending
    ? { PendingSettingChange: "", pendingsettingchange: "" }
    : {};
  if (
    (input.Venues !== undefined ||
      input.VenueCountry !== undefined ||
      input.VenueCity !== undefined ||
      input.VenueLocation !== undefined) &&
    !(set.VenueGeo as ResolvedPlace["VenueGeo"] | undefined)
  ) {
    unset.VenueGeo = "";
  }
  const updated = await col.findOneAndUpdate(
    { _id: found._id },
    {
      $set: set,
      ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
    } as unknown as Parameters<typeof col.findOneAndUpdate>[1],
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Tournament not found");
  if (input.icon !== undefined) {
    await (await registrations()).updateMany(
      asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)),
      {
        $set: {
          TournamentIcon: input.icon,
          tournamenticon: input.icon,
        },
      } as never,
    );
  }
  void actorUid;
  return serializeTournament(updated);
}

async function validateSettingsInput(
  found: TournamentDoc,
  current: Tournament,
  input: EditTournamentInput,
): Promise<void> {
  const ids = relatedIdsFromDoc(found);

  if (input.TournamentSize !== undefined) {
    const registeredCount = await (await registrations()).countDocuments(
      asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)),
    );
    if (input.TournamentSize < registeredCount) {
      throw new ServiceError(
        `Size can't be less than the ${registeredCount} team${
          registeredCount === 1 ? "" : "s"
        } already registered`,
      );
    }
  }

  if (input.ReturnLeg !== undefined) {
    if (
      current.TournamentMode !== "LEAGUE" &&
      current.TournamentMode !== "GROUPS"
    ) {
      throw new ServiceError("Return leg only applies to league and groups");
    }
  }
  if (input.AdvancePerGroup !== undefined) {
    if (current.TournamentMode !== "GROUPS") {
      throw new ServiceError("Advance per group only applies to groups");
    }
  }
  if (input.GroupCount !== undefined) {
    if (current.TournamentMode !== "GROUPS") {
      throw new ServiceError("Group count only applies to groups");
    }
  }
  if (input.PointSystem !== undefined) {
    if (
      current.TournamentMode !== "LEAGUE" &&
      current.TournamentMode !== "GROUPS"
    ) {
      throw new ServiceError("Point system only applies to league and groups");
    }
  }
  if (input.OwnerCanSelectQualifiers !== undefined) {
    if (current.TournamentMode !== "GROUPS") {
      throw new ServiceError(
        "Qualifier picks only apply to group tournaments",
      );
    }
  }
  const isKnockoutMode =
    current.TournamentMode === "MULTIPLAYER" ||
    current.TournamentMode === "GROUPS";
  if (input.KnockoutFormat !== undefined && !isKnockoutMode) {
    throw new ServiceError("Knockout format only applies to knockout events");
  }
  if (input.KnockoutFinalsSeries !== undefined && !isKnockoutMode) {
    throw new ServiceError("Knockout format only applies to knockout events");
  }
  if (input.ThirdPlace !== undefined && !isKnockoutMode) {
    throw new ServiceError("Third place only applies to knockout events");
  }
  if (input.TieBreaker !== undefined) {
    if (
      current.TournamentMode !== "LEAGUE" &&
      current.TournamentMode !== "GROUPS"
    ) {
      throw new ServiceError("Tie-breakers only apply to league and groups");
    }
  }
  if (
    input.BrLobbyCount !== undefined ||
    input.BrKillPoints !== undefined ||
    input.BrFirstBloodPoints !== undefined ||
    input.BrPlacementPoints !== undefined
  ) {
    if (current.TournamentMode !== "BATTLEROYALE") {
      throw new ServiceError("Battle royale scoring only applies to BR events");
    }
  }
}

async function rosterPlayersForDoc(found: TournamentDoc): Promise<Player[]> {
  const ids = relatedIdsFromDoc(found);
  const docs = await (await registrations())
    .find(asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)))
    .toArray();
  const byId = new Map<string, Player>();
  for (const doc of docs) {
    const reg = serializeRegistration(doc);
    for (const player of reg.Players ?? []) {
      if (player.User_id) byId.set(player.User_id, player);
    }
  }
  return [...byId.values()];
}

async function tournamentAudience(
  found: TournamentDoc,
  current: Tournament,
): Promise<Player[]> {
  const roster = await rosterPlayersForDoc(found);
  const byId = new Map(roster.map((p) => [p.User_id, p]));
  const extraIds = [
    current.User_id,
    ...(current.Managers ?? []),
  ].filter((id) => id && !byId.has(id));
  for (const id of extraIds) {
    const user = await getUserById(id);
    if (!user) continue;
    byId.set(id, {
      UserName: user.user_name || user.first_name,
      GameUserName: "",
      User_id: user.user_id,
      Email: user.email,
      Icon: user.icon || "",
      Verified: Boolean(user.verified),
    });
  }
  return [...byId.values()];
}

async function notifyRoster(
  players: Player[],
  message: string,
  kind: "ANNOUNCEMENT" | "SETTING_CHANGE",
  tournamentId: string,
  email: (name: string) => { subject: string; html: string },
): Promise<void> {
  try {
    await createNotifications(
      players.map((p) => p.User_id),
      message,
      { kind, tournament_id: tournamentId },
    );
    for (const player of players) {
      if (player.Email) {
        void sendEmail(player.Email, email(player.UserName || "there"));
      }
    }
  } catch (error) {
    console.error(error);
  }
}

async function notifyOwnerSettingChangeReady(
  found: TournamentDoc,
  tournamentName: string,
  ownerId: string,
): Promise<void> {
  try {
    await createNotifications(
      [ownerId],
      `Everyone accepted the setting change in ${tournamentName}. You can apply it now.`,
      { kind: "SETTING_CHANGE", tournament_id: serializeTournament(found).TournamentId },
    );
  } catch (error) {
    console.error(error);
  }
}

const MAX_ANNOUNCEMENTS = 50;

export async function addTournamentAnnouncement(
  actorUid: string,
  tournamentId: string,
  body: string,
): Promise<TournamentAnnouncement[]> {
  const col = await tournaments();
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canManageTournament(actorUid, found))) {
    throw new ServiceError("You are not allowed to post announcements");
  }
  const tournament = serializeTournament(found);
  if (tournamentBrowsePhase(tournament) === "ENDED") {
    throw new ServiceError(
      "This tournament is over. Announcements are closed.",
    );
  }

  const now = new Date().toISOString();
  const announcement: TournamentAnnouncement = {
    Id: new ObjectId().toHexString(),
    Body: body.trim(),
    CreatedAt: now,
    AuthorId: actorUid,
  };

  const updated = await col.findOneAndUpdate(
    { _id: found._id },
    {
      $push: {
        Announcements: {
          $each: [announcement],
          $position: 0,
          $slice: MAX_ANNOUNCEMENTS,
        },
      },
      $set: { Updated_at: now, updated_at: now },
    } as unknown as Parameters<typeof col.findOneAndUpdate>[1],
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Tournament not found");
  const posted = serializeTournament(updated).Announcements;
  const preview =
    announcement.Body.length > 180
      ? `${announcement.Body.slice(0, 177)}…`
      : announcement.Body;
  const audience = (await tournamentAudience(found, tournament)).filter(
    (player) => player.User_id !== actorUid,
  );
  void notifyRoster(
    audience,
    `${tournament.Name}: ${preview}`,
    "ANNOUNCEMENT",
    tournament.TournamentId,
    (name) =>
      announcementEmail(
        name,
        tournament.Name,
        tournament.TournamentId,
        announcement.Body,
      ),
  );
  return posted;
}

export async function removeTournamentAnnouncement(
  actorUid: string,
  tournamentId: string,
  announcementId: string,
): Promise<TournamentAnnouncement[]> {
  const col = await tournaments();
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  if (!(await canManageTournament(actorUid, found))) {
    throw new ServiceError("You are not allowed to remove announcements");
  }

  const now = new Date().toISOString();
  const updated = await col.findOneAndUpdate(
    { _id: found._id },
    {
      $pull: { Announcements: { Id: announcementId } },
      $set: { Updated_at: now, updated_at: now },
    } as unknown as Parameters<typeof col.findOneAndUpdate>[1],
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Tournament not found");
  return serializeTournament(updated).Announcements;
}

export async function groupTournament(
  uid: string,
  tournamentId: string,
): Promise<TournamentGroup[]> {
  const col = await tournaments();
  const tournament = await findByAnyId(tournamentId);
  if (!tournament) throw new ServiceError("Tournament not found");
  if (!(await canManageTournament(uid, tournament))) {
    throw new ServiceError("You are not allowed to manage this tournament");
  }

  const ids = relatedIdsFromDoc(tournament);
  const regDocs = await (await registrations())
    .find(asDocFilter<RegisterTournamentDoc>(byAnyTournamentId(ids)))
    .toArray();

  if (regDocs.length < 7) {
    throw new ServiceError("You need at least 7 teams to group a tournament");
  }

  const current = serializeTournament(tournament);
  const checkedIn = new Set(
    regDocs
      .map(serializeRegistration)
      .filter((r) => !current.CheckInRequired || r.CheckedIn)
      .map((r) => r.TeamName),
  );
  const dq = asDisqualifiedSet(current.DisqualifiedTeams);
  const teams: Teams[] = regDocs
    .map((r) => {
      const reg = serializeRegistration(r);
      return {
        TeamName: reg.TeamName,
        Players: reg.Players,
        Icon: reg.Icon,
        Points: 0,
        GoalsScored: 0,
        GoalsReceived: 0,
        GoalsDifference: 0,
      };
    })
    .filter((t) => !dq.has(t.TeamName) && checkedIn.has(t.TeamName));

  if (teams.length < 7) {
    throw new ServiceError(
      current.CheckInRequired
        ? "At least 7 teams need to check in before you can create groups"
        : "You need at least 7 teams to group a tournament",
    );
  }
  const groups = buildGroups(teams, {
    shuffle: current.Shuffle === "AUTOMATIC",
    groupCount: current.GroupCount || 0,
  });
  const now = new Date().toISOString();
  await col.updateOne(
    { _id: tournament._id },
    {
      $set: {
        Groups: groups,
        groups,
        Start: true,
        start: true,
        IsDrawn: true,
        isdrawn: true,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return groups;
}

/**
 * Manually reassign teams to groups (e.g. from an admin drag-and-drop board).
 * Rebuilds the Groups array from the given arrangement, preserving each team's
 * existing stats where possible. Every already-grouped team must be present
 * exactly once so no team is silently dropped or duplicated.
 */
export async function setTournamentGroups(
  uid: string,
  tournamentId: string,
  input: SetGroupsInput,
): Promise<TournamentGroup[]> {
  const col = await tournaments();
  const tournament = await findByAnyId(tournamentId);
  if (!tournament) throw new ServiceError("Tournament not found");
  if (!(await canReshuffleGroups(uid, tournament))) {
    throw new ServiceError(
      serializeTournament(tournament).OwnerCanReshuffleGroups
        ? "You are not allowed to manage this tournament"
        : "Only an admin can reshuffle groups for this tournament",
    );
  }

  const current = serializeTournament(tournament);
  if (!current.Groups || current.Groups.length === 0) {
    throw new ServiceError("This tournament has no groups yet");
  }

  // Once fixtures exist, the groups are locked in - moving teams would
  // desync them from the drawn matches.
  const ids = relatedIdsFromDoc(tournament);
  const drawCount = await (await draws()).countDocuments(
    asDocFilter<DrawDoc>(byAnyTournamentId(ids)),
  );
  if (drawCount > 0) {
    throw new ServiceError(
      "Teams can't be moved after fixtures have been drawn",
    );
  }

  // Preserve existing team objects (with any recorded stats) by name.
  const existingByName = new Map<string, Teams>();
  for (const group of current.Groups) {
    for (const team of group.Teams) existingByName.set(team.TeamName, team);
  }

  const requested = input.Groups.flatMap((g) => g.TeamNames);
  const requestedSet = new Set(requested);
  if (requestedSet.size !== requested.length) {
    throw new ServiceError("A team can only be in one group");
  }
  if (requestedSet.size !== existingByName.size) {
    throw new ServiceError("Every team must stay assigned to a group");
  }
  for (const name of requestedSet) {
    if (!existingByName.has(name)) {
      throw new ServiceError(`Unknown team: ${name}`);
    }
  }

  const groups: TournamentGroup[] = input.Groups.map((g) => ({
    GroupName: g.GroupName,
    Teams: g.TeamNames.map((name) => existingByName.get(name) as Teams),
  }));

  const now = new Date().toISOString();
  await col.updateOne(
    { _id: tournament._id },
    {
      $set: {
        Groups: groups,
        groups,
        Updated_at: now,
        updated_at: now,
      },
    } as unknown as Parameters<typeof col.updateOne>[1],
  );
  return groups;
}

/* --------------------------- helpers --------------------------- */

async function findByAnyId(id: string): Promise<TournamentDoc | null> {
  const col = await tournaments();
  // Prefer the Mongo _id when the URL is a 24-char hex so two documents that
  // share a legacy `tournamentid` (data clones) stay distinguishable.
  if (ObjectId.isValid(id) && id.length === 24) {
    const byObjectId = await col.findOne({ _id: new ObjectId(id) });
    if (byObjectId) return byObjectId;
  }
  return col.findOne(asDocFilter<TournamentDoc>(byTournamentId(id)));
}

function relatedIdsFromDoc(doc: TournamentDoc): string[] {
  const raw = asRecord(doc);
  return [
    ...new Set(
      [
        doc._id.toHexString(),
        serializeTournament(doc).TournamentId,
        readString(raw, ["TournamentId", "tournamentid"]),
      ].filter((id) => id.length > 0),
    ),
  ];
}

export async function checkInForTournament(
  uid: string,
  tournamentId: string,
): Promise<RegisterTournament> {
  const found = await findByAnyId(tournamentId);
  if (!found) throw new ServiceError("Tournament not found");
  const tournament = serializeTournament(found);
  if (!tournament.CheckInRequired) {
    throw new ServiceError("This tournament does not require check-in");
  }
  if (!checkInWindowOpen(tournament)) {
    throw new ServiceError("Check-in is closed");
  }
  const ids = relatedIdsFromDoc(found);
  const rCol = await registrations();
  const reg = await rCol.findOne(
    asDocFilter<RegisterTournamentDoc>({
      $and: [byAnyTournamentId(ids), byPlayerUserId(uid)],
    }),
  );
  if (!reg) throw new ServiceError("You are not registered for this tournament");
  const current = serializeRegistration(reg);
  if (current.CheckedIn) return current;
  const now = new Date().toISOString();
  const updated = await rCol.findOneAndUpdate(
    { _id: reg._id },
    { $set: { CheckedIn: true, CheckedInAt: now, Updated_at: now } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Registration not found");
  return serializeRegistration(updated);
}

/** Drop invite access so a removed player can be invited again. */
async function revokeInviteAccess(
  found: TournamentDoc,
  userIds: string[],
  registerId = "",
): Promise<void> {
  const unique = [...new Set(userIds.filter((id) => id.length > 0))];
  const now = new Date().toISOString();
  const tournamentIds = relatedIdsFromDoc(found);
  const clauses: Record<string, unknown>[] = [];
  if (unique.length > 0) {
    clauses.push({
      tournament_id: { $in: tournamentIds },
      $or: unique.flatMap((uid) => [{ invitee_id: uid }, { user_id: uid }]),
    });
  }
  if (registerId) {
    clauses.push({ register_id: registerId });
  }
  if (clauses.length > 0) {
    await (
      await invites()
    ).updateMany(
      (clauses.length === 1 ? clauses[0] : { $or: clauses }) as never,
      { $set: { status: "DECLINED", UpdatedAt: now } },
    );
  }
  if (unique.length === 0) return;
  await (await tournaments()).updateOne(
    { _id: found._id },
    {
      $pull: {
        AcceptedInvites: { $in: unique },
        acceptedinvites: { $in: unique },
      },
      $set: { Updated_at: now, updated_at: now },
    } as never,
  );
}

export async function relatedTournamentIds(id: string): Promise<string[]> {
  const found = await findByAnyId(id);
  if (!found) return [id];
  return relatedIdsFromDoc(found);
}

function buildGroups(
  teams: Teams[],
  opts: { shuffle: boolean; groupCount: number },
): TournamentGroup[] {
  const ordered = opts.shuffle
    ? [...teams].sort(() => Math.random() - 0.5)
    : [...teams];
  const autoCount = Math.max(2, Math.ceil(ordered.length / 4));
  const maxCount = Math.max(2, Math.floor(ordered.length / 2));
  let groupCount =
    opts.groupCount > 0 ? opts.groupCount : autoCount;
  groupCount = Math.min(Math.max(2, groupCount), maxCount);
  const groups: TournamentGroup[] = Array.from(
    { length: groupCount },
    (_, i) => ({ GroupName: `Group ${String.fromCharCode(65 + i)}`, Teams: [] }),
  );
  ordered.forEach((team, index) => {
    groups[index % groupCount].Teams.push(team);
  });
  return groups;
}
