import "server-only";
import { ObjectId } from "mongodb";
import { notifications } from "../db";
import type { NotificationDoc } from "../documents";
import { serializeNotification } from "../serialize";
import type { Notification } from "@/lib/schemas/misc";
import type { Paginated } from "@/lib/result";

const PER_PAGE = 20;

export async function createNotification(
  userId: string,
  message: string,
): Promise<Notification> {
  const col = await notifications();
  const doc: NotificationDoc = {
    _id: new ObjectId(),
    user_id: userId,
    message,
    timestamp: new Date().toISOString(),
    is_read: false,
  };
  await col.insertOne(doc);
  return serializeNotification(doc);
}

export async function getNotifications(
  userId: string,
  page = 1,
): Promise<Paginated<Notification>> {
  const col = await notifications();
  const safePage = Math.max(page, 1);
  const filter = { user_id: userId };

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
    items: docs.map(serializeNotification),
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const col = await notifications();
  await col.updateOne({ _id: new ObjectId(id) }, { $set: { is_read: true } });
}

export async function markAllNotificationsRead(
  userId: string,
): Promise<void> {
  const col = await notifications();
  await col.updateMany({ user_id: userId }, { $set: { is_read: true } });
}

export async function deleteNotification(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const col = await notifications();
  await col.deleteOne({ _id: new ObjectId(id) });
}
