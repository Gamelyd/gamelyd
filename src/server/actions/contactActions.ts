"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult } from "@/lib/result";
import {
  contactUsInputSchema,
  reportAbuseInputSchema,
  type ContactUs,
  type ReportAbuse,
} from "@/lib/schemas/misc";
import { saveContact, saveReport } from "@/server/services/contactService";

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
