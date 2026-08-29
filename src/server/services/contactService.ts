import "server-only";
import { ObjectId } from "mongodb";
import { contacts, reports, users } from "../db";
import type { ContactUsDoc, ReportAbuseDoc } from "../documents";
import { serializeContact, serializeReport } from "../serialize";
import { sendEmail, adminEmail } from "../email/mailer";
import { contactOrAbuseEmail } from "../email/templates";
import { createNotifications } from "./notificationService";
import { ServiceError } from "./userService";
import type { ContactUs, ReportAbuse, ReportKind } from "@/lib/schemas/misc";
import type {
  ContactUsInput,
  ReportAbuseInput,
} from "@/lib/schemas/misc";
import type { Paginated } from "@/lib/result";

const PER_PAGE = 25;

/** Every active platform admin, so inbox messages reach all of them in-app. */
async function adminUserIds(): Promise<string[]> {
  const docs = await (await users())
    .find(
      { user_type: "ADMIN", isDeleted: { $ne: true }, isSuspended: { $ne: true } },
      { projection: { user_id: 1 } },
    )
    .toArray();
  return docs.map((doc) => doc.user_id).filter(Boolean);
}

function excerpt(message: string, max = 140): string {
  const clean = message.trim().replace(/\s+/g, " ");
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Fire-and-forget: a failed notification must never fail the submission. */
async function notifyAdmins(message: string): Promise<void> {
  try {
    await createNotifications(await adminUserIds(), message, {
      kind: "GENERIC",
    });
  } catch (error) {
    console.error("[contact] admin notification failed:", error);
  }
}

/* ----------------------------- Contact ---------------------------- */

export async function saveContact(input: ContactUsInput): Promise<ContactUs> {
  const col = await contacts();
  const now = new Date().toISOString();
  const _id = new ObjectId();
  const doc: ContactUsDoc = {
    _id,
    Created_at: now,
    Updated_at: now,
    ContactId: _id.toHexString(),
    Email: input.Email,
    Name: input.Name,
    Message: input.Message,
    Achived: false,
    IsDeleted: false,
    IsCompleted: false,
  };
  await col.insertOne(doc);
  void sendEmail(
    adminEmail(),
    contactOrAbuseEmail(input.Name, input.Message, input.Email, false),
  );
  void notifyAdmins(
    `New contact message from ${input.Name || input.Email}: ${excerpt(input.Message)}`,
  );
  return serializeContact(doc);
}

export async function getContacts(
  filter: Partial<Pick<ContactUsDoc, "Achived" | "IsDeleted" | "IsCompleted">> = {},
  page = 1,
): Promise<Paginated<ContactUs>> {
  const col = await contacts();
  const safePage = Math.max(page, 1);

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
    items: docs.map(serializeContact),
  };
}

export async function getActiveContacts(
  page = 1,
): Promise<Paginated<ContactUs>> {
  return getContacts(
    { Achived: false, IsDeleted: false, IsCompleted: false },
    page,
  );
}

async function toggleContact(
  id: string,
  field: "IsDeleted" | "IsCompleted" | "Achived",
): Promise<boolean> {
  const col = await contacts();
  const found = await col.findOne({ ContactId: id });
  if (!found) throw new ServiceError("Contact not found");
  const next = !found[field];
  await col.updateOne(
    { ContactId: id },
    { $set: { [field]: next, Updated_at: new Date().toISOString() } },
  );
  return next;
}

export const deleteContact = (id: string) => toggleContact(id, "IsDeleted");
export const completeContact = (id: string) => toggleContact(id, "IsCompleted");
export const archiveContact = (id: string) => toggleContact(id, "Achived");

/* ----------------------------- Report ----------------------------- */

export async function saveReport(
  input: ReportAbuseInput,
): Promise<ReportAbuse> {
  const col = await reports();
  const now = new Date().toISOString();
  const _id = new ObjectId();
  const doc: ReportAbuseDoc = {
    _id,
    Created_at: now,
    Updated_at: now,
    ReportAbuseId: _id.toHexString(),
    UserID: input.UserID,
    Email: input.Email,
    Name: input.Name,
    Message: input.Message,
    For: input.For,
    Achived: false,
    IsDeleted: false,
    IsCompleted: false,
    Kind: input.Kind,
    TournamentId: input.TournamentId,
    TournamentName: input.TournamentName,
    Reason: input.Reason,
    RequestedEmail: input.RequestedEmail,
    RequestedPhone: input.RequestedPhone,
  };
  await col.insertOne(doc);
  void sendEmail(
    adminEmail(),
    contactOrAbuseEmail(input.Name, input.Message, input.Email, true),
  );
  void notifyAdmins(
    input.Kind === "CONTACT_CHANGE"
      ? `${input.Name || input.Email} asked to change their verified contact details.`
      : `Report from ${input.Name || input.Email} about ${input.TournamentName || input.For || "the platform"}: ${excerpt(input.Message)}`,
  );
  return serializeReport(doc);
}

export async function getReports(
  filter: Partial<Pick<ReportAbuseDoc, "Achived" | "IsDeleted" | "IsCompleted">> = {},
  page = 1,
): Promise<Paginated<ReportAbuse>> {
  const col = await reports();
  const safePage = Math.max(page, 1);

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
    items: docs.map(serializeReport),
  };
}

export async function getActiveReports(
  page = 1,
): Promise<Paginated<ReportAbuse>> {
  return getReports(
    { Achived: false, IsDeleted: false, IsCompleted: false },
    page,
  );
}

async function toggleReport(
  id: string,
  field: "IsDeleted" | "IsCompleted" | "Achived",
): Promise<boolean> {
  const col = await reports();
  const found = await col.findOne({ ReportAbuseId: id });
  if (!found) throw new ServiceError("Report not found");
  const next = !found[field];
  await col.updateOne(
    { ReportAbuseId: id },
    { $set: { [field]: next, Updated_at: new Date().toISOString() } },
  );
  return next;
}

export async function getReportById(id: string): Promise<ReportAbuse | null> {
  const found = await (await reports()).findOne({ ReportAbuseId: id });
  return found ? serializeReport(found) : null;
}

export const deleteReport = (id: string) => toggleReport(id, "IsDeleted");
export const completeReport = (id: string) => toggleReport(id, "IsCompleted");
export const archiveReport = (id: string) => toggleReport(id, "Achived");

/** Admin inbox: reports and contact-change requests, newest first. */
export async function listReportsAdmin(options: {
  kind?: ReportKind | "ALL";
  status?: "OPEN" | "DONE" | "ALL";
  page?: number;
}): Promise<Paginated<ReportAbuse>> {
  const page = Math.max(options.page ?? 1, 1);
  const filter: Record<string, unknown> = { IsDeleted: { $ne: true } };
  if (options.kind && options.kind !== "ALL") {
    filter.Kind = options.kind;
  }
  if (options.status === "OPEN") filter.IsCompleted = { $ne: true };
  if (options.status === "DONE") filter.IsCompleted = true;

  const col = await reports();
  const total = await col.countDocuments(filter);
  const docs = await col
    .find(filter)
    .sort({ _id: -1 })
    .skip((page - 1) * PER_PAGE)
    .limit(PER_PAGE)
    .toArray();
  return {
    total,
    page,
    last_page: Math.max(Math.ceil(total / PER_PAGE), 1),
    items: docs.map(serializeReport),
  };
}
