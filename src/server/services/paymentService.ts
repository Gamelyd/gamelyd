import "server-only";
import { ObjectId } from "mongodb";
import {
  draws,
  payments,
  payouts,
  registrations,
  tournaments,
} from "@/server/db";
import type {
  DrawDoc,
  PaymentDoc,
  PayoutDoc,
  RegisterTournamentDoc,
  TournamentDoc,
} from "@/server/documents";
import {
  serializeDraw,
  serializeRegistration,
  serializeTournament,
} from "@/server/serialize";
import { asDocFilter, byTournamentId } from "@/server/legacy";
import { ServiceError, getUserById } from "@/server/services/userService";
import {
  canManageTournamentById,
  registerForTournament,
  saveTournament,
} from "@/server/services/tournamentService";
import { canReceivePayout } from "@/server/services/payoutAccountService";
import { getOneOff } from "@/server/services/settingsService";
import { assertCanCreateTournament } from "@/server/services/planService";
import { createNotification } from "@/server/services/notificationService";
import { resolveSavedTeamRegistration } from "@/server/services/savedTeamService";
import { rosterSize } from "@/lib/schemas/common";
import { fromMinor } from "@/server/payments/money";
import {
  playerOnATeam,
  userMayJoinTournament,
} from "@/server/services/inviteService";
import type { Currency } from "@/lib/schemas/common";
import type { Draw } from "@/lib/schemas/draw";
import type { RegisterTournament } from "@/lib/schemas/register";
import type {
  SaveTournamentInput,
  Tournament,
} from "@/lib/schemas/tournament";
import { placeLabel } from "@/lib/schemas/tournament";
import type { StartEntryCheckoutInput } from "@/lib/schemas/payment";
import { captainUserId } from "@/lib/captain";
import { resolvePodium } from "@/lib/podium";
import {
  allocateBoard,
  prizeBoardTotal,
  usesLegacyShares,
} from "@/lib/prizeBoard";
import {
  PLATFORM_FEE_BPS,
  processorForCurrency,
  roundMoney,
  sponsorDeposit,
  splitEntry,
  type Processor,
} from "@/lib/fees";
import { formatMoney, parseCurrency } from "@/lib/currency";
import { env } from "@/server/env";
import { createStripeCheckout, stripeEnabled } from "@/server/payments/stripe";
import {
  initializePaystack,
  paystackEnabled,
  verifyPaystack,
} from "@/server/payments/paystack";

function appUrl(): string {
  return env.appUrl.replace(/\/$/, "");
}

function processorReady(processor: Processor): boolean {
  return processor === "STRIPE" ? stripeEnabled() : paystackEnabled();
}

async function loadTournament(id: string): Promise<Tournament> {
  const found = await (
    await tournaments()
  ).findOne(asDocFilter<TournamentDoc>(byTournamentId(id)));
  if (!found) throw new ServiceError("Tournament not found");
  return serializeTournament(found);
}

async function userEmail(uid: string): Promise<string> {
  const user = await getUserById(uid);
  if (!user?.email) throw new ServiceError("Your account needs an email to pay");
  return user.email;
}

async function openCheckout(input: {
  paymentId: string;
  amount: number;
  currency: Currency;
  email: string;
  title: string;
  tournamentId: string;
  processor: Processor;
}): Promise<{ url: string; processorRef: string }> {
  if (!processorReady(input.processor)) {
    throw new ServiceError(
      input.processor === "STRIPE"
        ? "Card payments (USD/GBP/EUR) are not configured yet"
        : "Paystack is not configured for this currency",
    );
  }
  if (input.processor === "STRIPE") {
    return createStripeCheckout({
      reference: input.paymentId,
      amount: input.amount,
      currency: input.currency,
      email: input.email,
      title: input.title,
      successUrl: `${appUrl()}/tournament/${input.tournamentId}?checkout=success`,
      cancelUrl: `${appUrl()}/tournament/${input.tournamentId}?checkout=cancel`,
      metadata: { payment_id: input.paymentId },
    });
  }
  return initializePaystack({
    reference: input.paymentId,
    amount: input.amount,
    currency: input.currency,
    email: input.email,
    title: input.title,
    callbackUrl: `${appUrl()}/api/payments/paystack/callback`,
    metadata: {
      payment_id: input.paymentId,
      tournament_id: input.tournamentId,
    },
  });
}

export async function startEntryCheckout(
  uid: string,
  tournamentId: string,
  input: StartEntryCheckoutInput,
): Promise<{ checkoutUrl: string }> {
  const tournament = await loadTournament(tournamentId);
  if (tournament.Payment !== "PAID") {
    throw new ServiceError("This tournament does not charge an entry fee");
  }
  if (tournament.Start) {
    throw new ServiceError("Registration is closed");
  }
  if (!(await userMayJoinTournament(uid, tournament.TournamentId))) {
    throw new ServiceError(
      "This tournament is invite-only. Accept an invite before you pay.",
    );
  }
  if (await playerOnATeam(tournament.TournamentId, uid)) {
    throw new ServiceError("You are already on a team in this event");
  }
  // A saved team enters as a whole roster - the entry fee is per team, and its
  // members already agreed to play together, so no per-event invites are needed.
  const roster = input.SavedTeamId
    ? await resolveSavedTeamRegistration(
        uid,
        input.SavedTeamId,
        rosterSize(tournament.Team, tournament.RosterCount),
      )
    : { Players: input.Players, TeamName: input.TeamName, Icon: input.Icon };

  if (!input.SavedTeamId) {
    if (roster.Players.length !== 1 || roster.Players[0]?.User_id !== uid) {
      throw new ServiceError(
        "Register yourself first, then invite teammates after you pay.",
      );
    }
  } else {
    for (const player of roster.Players) {
      if (await playerOnATeam(tournament.TournamentId, player.User_id)) {
        throw new ServiceError(
          `${player.UserName} is already on a team in this event`,
        );
      }
    }
  }

  const gross = tournament.RegistrationAmount;
  if (gross <= 0) throw new ServiceError("Entry fee is not set");
  const split = splitEntry(gross, tournament.PlatformFeeBps);
  const currency = parseCurrency(tournament.Currency);
  // The captain both pays the entry and receives the team's prize money, so a
  // working payout account is a precondition for taking their money.
  if (!(await canReceivePayout(uid, currency))) {
    throw new ServiceError(
      "Add a payout account before you register. Prize money for your team is paid to you as captain.",
    );
  }
  const processor = processorForCurrency(currency);
  const email = await userEmail(uid);
  const now = new Date().toISOString();
  const paymentId = new ObjectId().toHexString();

  const doc: PaymentDoc = {
    _id: new ObjectId(paymentId),
    payment_id: paymentId,
    kind: "ENTRY",
    status: "PENDING",
    processor,
    currency,
    tournamentId: tournament.TournamentId,
    userId: uid,
    amount: split.gross,
    fee: split.fee,
    net: split.net,
    feeBps: tournament.PlatformFeeBps || PLATFORM_FEE_BPS,
    processorRef: paymentId,
    checkoutUrl: "",
    email,
    registration: {
      Players: roster.Players,
      TeamName: roster.TeamName,
      Icon: roster.Icon,
      SavedTeamId: input.SavedTeamId ?? "",
    },
    created_at: now,
    updated_at: now,
    paid_at: "",
  };
  await (await payments()).insertOne(doc);

  const checkout = await openCheckout({
    paymentId,
    amount: split.gross,
    currency,
    email,
    title: `Entry · ${tournament.Name}`,
    tournamentId: tournament.TournamentId,
    processor,
  });
  await (await payments()).updateOne(
    { payment_id: paymentId },
    {
      $set: {
        processorRef: checkout.processorRef,
        checkoutUrl: checkout.url,
        updated_at: new Date().toISOString(),
      },
    },
  );
  return { checkoutUrl: checkout.url };
}

export async function startSponsorCheckout(
  uid: string,
  tournamentId: string,
): Promise<{ checkoutUrl: string }> {
  const tournament = await loadTournament(tournamentId);
  if (tournament.Payment !== "SPONSORED") {
    throw new ServiceError("This tournament is not sponsored");
  }
  if (tournament.PurseFunded) {
    throw new ServiceError("Prize pool is already funded");
  }
  if (tournament.User_id !== uid) {
    throw new ServiceError("Only the host can fund this prize pool");
  }
  const prizes = tournament.Prizes.reduce((sum, row) => sum + (row.Amount || 0), 0);
  if (prizes <= 0) throw new ServiceError("Set prize amounts first");
  const deposit = sponsorDeposit(prizes, tournament.PlatformFeeBps);
  const currency = parseCurrency(tournament.Currency);
  const processor = processorForCurrency(currency);
  const email = await userEmail(uid);
  const now = new Date().toISOString();
  const paymentId = new ObjectId().toHexString();

  await (await payments()).insertOne({
    _id: new ObjectId(paymentId),
    payment_id: paymentId,
    kind: "SPONSOR_FUND",
    status: "PENDING",
    processor,
    currency,
    tournamentId: tournament.TournamentId,
    userId: uid,
    amount: deposit.gross,
    fee: deposit.fee,
    net: deposit.prizes,
    feeBps: tournament.PlatformFeeBps || PLATFORM_FEE_BPS,
    processorRef: paymentId,
    checkoutUrl: "",
    email,
    created_at: now,
    updated_at: now,
    paid_at: "",
  });

  const checkout = await openCheckout({
    paymentId,
    amount: deposit.gross,
    currency,
    email,
    title: `Prize pool · ${tournament.Name}`,
    tournamentId: tournament.TournamentId,
    processor,
  });
  await (await payments()).updateOne(
    { payment_id: paymentId },
    {
      $set: {
        processorRef: checkout.processorRef,
        checkoutUrl: checkout.url,
        updated_at: new Date().toISOString(),
      },
    },
  );
  return { checkoutUrl: checkout.url };
}

/**
 * Pay once to create a single tournament above the free limits, without a
 * subscription. The draft is stored on the payment and the tournament is
 * created only once the money clears, so nothing half-made is left behind if
 * the host abandons checkout. This is a software fee to the platform: no
 * platform cut, no prize pot, none of the money-holding of paid entries.
 */
export async function startOneOffTournamentCheckout(
  uid: string,
  input: SaveTournamentInput,
): Promise<{ checkoutUrl: string }> {
  const oneOff = await getOneOff();
  if (!oneOff.enabled || oneOff.priceMinor <= 0) {
    throw new ServiceError("One-off tournaments are not available right now");
  }
  // They only pay if their own plan would actually reject this event; otherwise
  // send them through the normal free path.
  try {
    await assertCanCreateTournament(
      uid,
      {
        orgId: input.OrgId ?? "",
        teams: input.TournamentSize,
        mode: input.TournamentMode,
        venues: (input.Venues ?? []).filter((v: { location?: string }) => (v.location ?? "").trim())
          .length,
      },
    );
    throw new ServiceError(
      "Your plan already covers this tournament. You can create it without paying.",
    );
  } catch (error) {
    // The expected path: their plan rejects it, so a one-off is the way in.
    // Re-throw the "already covered" message and any genuine input error.
    if (
      error instanceof ServiceError &&
      error.message.includes("already covers")
    ) {
      throw error;
    }
  }
  // But the paid tier still has to allow it, so a €X one-off cannot create an
  // event bigger than what that tier permits.
  await assertCanCreateTournament(
    uid,
    {
      orgId: input.OrgId ?? "",
      teams: input.TournamentSize,
      mode: input.TournamentMode,
      venues: (input.Venues ?? []).filter((v: { location?: string }) => (v.location ?? "").trim())
        .length,
    },
    oneOff.tier,
  );

  const amount = fromMinor(oneOff.priceMinor, oneOff.currency);
  const processor = processorForCurrency(oneOff.currency);
  const email = await userEmail(uid);
  const now = new Date().toISOString();
  const paymentId = new ObjectId().toHexString();

  await (await payments()).insertOne({
    _id: new ObjectId(paymentId),
    payment_id: paymentId,
    kind: "ONE_OFF",
    status: "PENDING",
    processor,
    currency: oneOff.currency,
    tournamentId: "",
    userId: uid,
    amount,
    fee: 0,
    net: amount,
    feeBps: 0,
    processorRef: paymentId,
    checkoutUrl: "",
    email,
    tournamentDraft: input,
    created_at: now,
    updated_at: now,
    paid_at: "",
  });

  const checkout = await openCheckout({
    paymentId,
    amount,
    currency: oneOff.currency,
    email,
    title: `Tournament · ${input.Name}`,
    // Sent to the create page, which polls for the tournament this makes.
    tournamentId: paymentId,
    processor,
  });
  await (await payments()).updateOne(
    { payment_id: paymentId },
    {
      $set: {
        processorRef: checkout.processorRef,
        checkoutUrl: checkout.url,
        updated_at: new Date().toISOString(),
      },
    },
  );
  return { checkoutUrl: checkout.url };
}

/** Once a one-off payment clears, the created tournament id lives on it. */
export async function oneOffResult(
  uid: string,
  paymentId: string,
): Promise<{ status: string; tournamentId: string }> {
  await fulfillByProcessorRef(paymentId).catch(() => undefined);
  const doc = await (await payments()).findOne({ payment_id: paymentId });
  if (!doc || doc.userId !== uid) throw new ServiceError("Payment not found");
  return {
    status: doc.status,
    tournamentId: doc.createdTournamentId ?? "",
  };
}

export async function fulfillPayment(paymentId: string): Promise<void> {
  const col = await payments();
  const doc = await col.findOne({ payment_id: paymentId });
  if (!doc) throw new ServiceError("Payment not found");
  if (doc.status === "PAID") return;
  if (doc.status !== "PENDING") {
    throw new ServiceError("Payment cannot be completed");
  }

  const paidAt = new Date().toISOString();
  const claimed = await col.findOneAndUpdate(
    { payment_id: paymentId, status: "PENDING" },
    { $set: { status: "PAID", paid_at: paidAt, updated_at: paidAt } },
    { returnDocument: "after" },
  );
  if (!claimed) return;

  const tCol = await tournaments();
  if (claimed.kind === "SPONSOR_FUND") {
    await tCol.updateOne(asDocFilter<TournamentDoc>(byTournamentId(claimed.tournamentId)), {
      $set: {
        PurseFunded: true,
        PotNet: claimed.net,
        FeeCollected: claimed.fee,
        Amount: claimed.net,
        Updated_at: paidAt,
      },
    });
    return;
  }

  if (claimed.kind === "ONE_OFF" && claimed.tournamentDraft) {
    // The buyer picked this tier when they paid; enforce it, not their plan.
    const oneOff = await getOneOff();
    const created = await saveTournament(
      claimed.userId,
      claimed.tournamentDraft,
      oneOff.tier,
    );
    await col.updateOne(
      { payment_id: paymentId },
      {
        $set: {
          createdTournamentId: created.TournamentId,
          tournamentId: created.TournamentId,
          updated_at: new Date().toISOString(),
        },
      },
    );
    return;
  }

  if (claimed.kind === "ENTRY" && claimed.registration) {
    try {
      await registerForTournament(
        claimed.tournamentId,
        {
          Players: claimed.registration.Players,
          TeamName: claimed.registration.TeamName,
          Icon: claimed.registration.Icon,
          RefNumber: claimed.payment_id,
          PaymentChannel: claimed.processor,
          Amount: claimed.amount,
        },
        {
          paidPaymentId: claimed.payment_id,
          actorUid: claimed.userId,
          // A saved team was already validated at checkout and enters whole.
          captainOnly: !claimed.registration.SavedTeamId,
          allowPartialRoster: true,
        },
      );
      await tCol.updateOne(
        asDocFilter<TournamentDoc>(byTournamentId(claimed.tournamentId)),
        {
          $inc: { PotNet: claimed.net, FeeCollected: claimed.fee },
          $set: { Updated_at: paidAt },
        },
      );
    } catch (error) {
      await col.updateOne(
        { payment_id: paymentId },
        {
          $set: {
            status: "FAILED",
            updated_at: new Date().toISOString(),
          },
        },
      );
      throw error;
    }
  }
}

export async function fulfillByProcessorRef(ref: string): Promise<void> {
  const doc =
    (await (await payments()).findOne({ processorRef: ref })) ??
    (await (await payments()).findOne({ payment_id: ref }));
  if (!doc) throw new ServiceError("Payment not found");
  if (doc.processor === "PAYSTACK") {
    const verified = await verifyPaystack(doc.processorRef || doc.payment_id);
    if (!verified.paid) throw new ServiceError("Payment not complete");
  }
  await fulfillPayment(doc.payment_id);
}

export async function listTournamentPayouts(
  tournamentId: string,
): Promise<PayoutDoc[]> {
  return (await payouts())
    .find({ tournamentId })
    .sort({ place: 1 })
    .toArray();
}

/**
 * The payout board names people and amounts, so it is not public. Hosts,
 * co-managers and admins see the whole board; a player sees only the line for
 * their own team.
 */
export async function listPayoutsForViewer(
  tournamentId: string,
  uid: string,
): Promise<PayoutDoc[]> {
  const tournament = await loadTournament(tournamentId);
  const rows = await listTournamentPayouts(tournament.TournamentId);
  if (rows.length === 0) return [];
  if (await canManageTournamentById(uid, tournament.TournamentId)) return rows;

  const regDocs = await (await registrations())
    .find(
      asDocFilter<RegisterTournamentDoc>(
        byTournamentId(tournament.TournamentId),
      ),
    )
    .toArray();
  const mine = regDocs
    .map(serializeRegistration)
    .find((team) => team.Players.some((player) => player.User_id === uid));
  if (!mine) return [];
  return rows.filter(
    (row) => row.teamName === mine.TeamName || row.userId === uid,
  );
}

/**
 * Loads the finished bracket without going through drawService, which imports
 * this module to trigger settlement.
 */
async function loadResults(
  tournamentId: string,
): Promise<{ draws: Draw[]; participants: RegisterTournament[] }> {
  const filter = byTournamentId(tournamentId);
  const [drawDocs, regDocs] = await Promise.all([
    (await draws()).find(asDocFilter<DrawDoc>(filter)).toArray(),
    (await registrations())
      .find(asDocFilter<RegisterTournamentDoc>(filter))
      .toArray(),
  ]);
  return {
    draws: drawDocs.map(serializeDraw),
    participants: regDocs.map(serializeRegistration),
  };
}

interface SettlementLine {
  place: number;
  teamName: string;
  userId: string;
  amount: number;
  note: string;
}

/**
 * Splits the money once a champion is known. Every configured prize position
 * is paid to the captain of the team that finished there; anything that cannot
 * be placed (a position with no result, e.g. no third-place match) falls back
 * to the host so no money is stranded.
 */
export async function settleEndedTournament(tournamentId: string): Promise<void> {
  const tournament = await loadTournament(tournamentId);
  if (tournament.Payment === "FREE") return;
  if (
    tournament.SettlementStatus === "SETTLED" ||
    tournament.SettlementStatus === "OPEN"
  ) {
    return;
  }
  if (!tournament.Winner?.TeamName?.trim()) return;

  const currency = parseCurrency(tournament.Currency);
  const { draws: drawRows, participants } = await loadResults(
    tournament.TournamentId,
  );
  const podium = resolvePodium(tournament, drawRows, participants);
  if (!podium) return;

  const byPlace = new Map<number, string>();
  if (podium.first?.TeamName?.trim()) byPlace.set(1, podium.first.TeamName.trim());
  if (podium.second?.TeamName?.trim()) byPlace.set(2, podium.second.TeamName.trim());
  if (podium.third?.TeamName?.trim()) byPlace.set(3, podium.third.TeamName.trim());

  const captainFor = (teamName: string): string =>
    captainUserId(participants.find((p) => p.TeamName === teamName));

  // A sponsor's deposit is exactly the board; a paid event holds whatever the
  // entry fees actually collected.
  const pot =
    tournament.Payment === "SPONSORED"
      ? prizeBoardTotal(tournament.Prizes)
      : roundMoney(tournament.PotNet);

  const { byPosition, remaining } = allocateBoard(
    tournament.Prizes,
    pot,
    tournament.Payment,
  );
  const legacyShares =
    tournament.Payment === "PAID" && usesLegacyShares(tournament.Prizes);

  const lines: SettlementLine[] = [];
  let unassigned = 0;

  for (const [position, amount] of [...byPosition.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    if (amount <= 0) continue;
    const teamName = byPlace.get(position);
    const captain = teamName ? captainFor(teamName) : "";
    if (!teamName || !captain) {
      unassigned = roundMoney(unassigned + amount);
      continue;
    }
    lines.push({
      place: position,
      teamName,
      userId: captain,
      amount,
      note: legacyShares
        ? `${placeLabel(position)} place · share of the net pot`
        : `${placeLabel(position)} place prize`,
    });
  }

  // Money the board did not promise, plus prizes for places nobody reached.
  const hostAmount = roundMoney(unassigned + remaining);
  if (hostAmount > 0) {
    lines.push({
      place: 0,
      teamName: "Host",
      userId: tournament.User_id,
      amount: hostAmount,
      note:
        unassigned > 0
          ? "Unclaimed places and unallocated funds returned to the host"
          : "Funds left over after the prize board, returned to the host",
    });
  }

  const now = new Date().toISOString();
  const col = await payouts();
  for (const line of lines) {
    if (line.amount <= 0) continue;
    const user = line.userId ? await getUserById(line.userId) : null;
    const payoutId = new ObjectId().toHexString();
    await col.insertOne({
      _id: new ObjectId(payoutId),
      payout_id: payoutId,
      tournamentId: tournament.TournamentId,
      tournamentName: tournament.Name,
      place: line.place,
      teamName: line.teamName,
      userId: line.userId,
      userName: user?.user_name || "",
      amount: line.amount,
      currency,
      status: "OWED",
      note: line.note,
      processor: "",
      transferRef: "",
      failureReason: "",
      paidBy: "",
      paid_at: "",
      created_at: now,
      updated_at: now,
    });

    // Tell them the money exists, and whether we can actually send it. Without
    // this a winner has no idea a missing payout account is holding it up.
    if (line.userId) {
      const ready = await canReceivePayout(line.userId, currency).catch(
        () => false,
      );
      void createNotification(
        line.userId,
        ready
          ? `You won ${formatMoney(line.amount, currency)} from ${tournament.Name}. It is queued for transfer to your payout account.`
          : `You won ${formatMoney(line.amount, currency)} from ${tournament.Name}. Add a payout account on your profile so we can send it.`,
        { kind: "GENERIC", tournament_id: tournament.TournamentId },
      ).catch(() => undefined);
    }
  }
  await (await tournaments()).updateOne(
    asDocFilter<TournamentDoc>(byTournamentId(tournament.TournamentId)),
    {
      $set: {
        SettlementStatus: "OPEN",
        Updated_at: now,
      },
    },
  );
}
