"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult } from "@/lib/result";
import {
  contactUsInputSchema,
  reportAbuseInputSchema,
  reportTournamentInputSchema,
  requestContactChangeInputSchema,
  type ContactUs,
  type ReportAbuse,
} from "@/lib/schemas/misc";
import { saveContact, saveReport } from "@/server/services/contactService";
import { getSessionClaims } from "@/server/auth/session";
import { ServiceError, getUserById } from "@/server/services/userService";
import { getTournamentById } from "@/server/services/tournamentService";

export async function submitContactAction(
  input: unknown,
): Promise<ActionResult<ContactUs>> {
  const parsed = parseInput(contactUsInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await saveContact(parsed.data), "Message sent");
  } catch (error) {
    console.error(error);
    return fail("Something went wrong sending your message");
  }
}

export async function submitReportAction(
  input: unknown,
): Promise<ActionResult<ReportAbuse>> {
  const parsed = parseInput(reportAbuseInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await saveReport(parsed.data), "Report submitted");
  } catch (error) {
    console.error(error);
    return fail("Something went wrong submitting your report");
  }
}

/**
 * A player raising an issue about a tournament. Signed-in only, so the admin
 * inbox always knows who filed it and can follow up.
 */
export async function reportTournamentAction(
  input: unknown,
): Promise<ActionResult<{ ok: true }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in to report a tournament");
  const parsed = parseInput(reportTournamentInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  try {
    const [user, tournament] = await Promise.all([
      getUserById(claims.uid),
      getTournamentById(parsed.data.TournamentId),
    ]);
    if (!tournament) return fail("Tournament not found");

    await saveReport({
      Email: user?.email ?? "",
      Name: user?.user_name || user?.first_name || "Player",
      Message: parsed.data.Message,
      For: `Tournament: ${tournament.Name}`,
      UserID: claims.uid,
      Kind: "TOURNAMENT",
      TournamentId: tournament.TournamentId,
      TournamentName: tournament.Name,
      Reason: parsed.data.Reason,
      RequestedEmail: "",
      RequestedPhone: "",
    });
    return ok(
      { ok: true } as const,
      "Report sent. Our team will look into it.",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not send that report");
  }
}

/**
 * Verified users cannot edit their own email or phone, so this files a request
 * for us to verify and apply the change.
 */
export async function requestContactChangeAction(
  input: unknown,
): Promise<ActionResult<{ ok: true }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const parsed = parseInput(requestContactChangeInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  try {
    const user = await getUserById(claims.uid);
    if (!user) return fail("Account not found");
    await saveReport({
      Email: user.email,
      Name: user.user_name || user.first_name || "Player",
      Message:
        parsed.data.Message?.trim() ||
        "No extra detail given with this request.",
      For: "Contact details change",
      UserID: claims.uid,
      Kind: "CONTACT_CHANGE",
      TournamentId: "",
      TournamentName: "",
      Reason: "Verified account",
      RequestedEmail: parsed.data.Email?.trim() ?? "",
      RequestedPhone: parsed.data.Phone?.trim() ?? "",
    });
    return ok(
      { ok: true } as const,
      "Request sent. We will verify the new details before changing anything.",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not send that request");
  }
}
