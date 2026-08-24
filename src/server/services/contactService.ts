import "server-only";
import { ObjectId } from "mongodb";
import { contacts, reports } from "../db";
import type { ContactUsDoc, ReportAbuseDoc } from "../documents";
import { serializeContact, serializeReport } from "../serialize";
import { sendEmail, adminEmail } from "../email/mailer";
import { contactOrAbuseEmail } from "../email/templates";
import { ServiceError } from "./userService";
import type { ContactUs, ReportAbuse } from "@/lib/schemas/misc";
import type {
  ContactUsInput,
  ReportAbuseInput,
} from "@/lib/schemas/misc";
import type { Paginated } from "@/lib/result";

const PER_PAGE = 25;

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
  };
  await col.insertOne(doc);
  void sendEmail(
    adminEmail(),
    contactOrAbuseEmail(input.Name, input.Message, input.Email, true),
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

export const deleteReport = (id: string) => toggleReport(id, "IsDeleted");
export const completeReport = (id: string) => toggleReport(id, "IsCompleted");
export const archiveReport = (id: string) => toggleReport(id, "Achived");
