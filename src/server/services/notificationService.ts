import "server-only";
import { ObjectId } from "mongodb";
import { notifications } from "../db";
import type { NotificationDoc } from "../documents";
import { serializeNotification } from "../serialize";
import type { Notification } from "@/lib/schemas/misc";
import type { NotificationKind } from "@/lib/schemas/common";
import type { Paginated } from "@/lib/result";

const PER_PAGE = 20;

export async function createNotification(
  userId: string,
  message: string,
  extra?: {
    kind?: NotificationKind;
    invite_id?: string;
    tournament_id?: string;
    team_id?: string;
  },
): Promise<Notification> {
  const col = await notifications();
  const doc: NotificationDoc = {
    _id: new ObjectId(),
    user_id: userId,
    message,
    timestamp: new Date().toISOString(),
    is_read: false,
    kind: extra?.kind ?? "GENERIC",
    invite_id: extra?.invite_id ?? "",
    tournament_id: extra?.tournament_id ?? "",
    team_id: extra?.team_id ?? "",
  };
  await col.insertOne(doc);
  return serializeNotification(doc);
}

export async function createNotifications(
  userIds: string[],
  message: string,
  extra?: {
    kind?: NotificationKind;
    invite_id?: string;
    tournament_id?: string;
    team_id?: string;
  },
): Promise<void> {
  const unique = [...new Set(userIds.filter((id) => id.length > 0))];
  if (unique.length === 0) return;
  const col = await notifications();
  const now = new Date().toISOString();
  await col.insertMany(
    unique.map((userId) => ({
      _id: new ObjectId(),
      user_id: userId,
      message,
      timestamp: now,
      is_read: false,
      kind: extra?.kind ?? "GENERIC",
      invite_id: extra?.invite_id ?? "",
      tournament_id: extra?.tournament_id ?? "",
      team_id: extra?.team_id ?? "",
    })),
  );
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
    .aggregate<NotificationDoc>([
      { $match: filter },
      {
        $addFields: {
          _priority: {
            $cond: [
              {
                $in: [
                  "$kind",
                  ["TOURNAMENT_INVITE", "TEAM_INVITE", "SETTING_CHANGE"],
                ],
              },
              0,
              1,
            ],
          },
        },
      },
      { $sort: { _priority: 1, _id: -1 } },
      { $skip: (safePage - 1) * PER_PAGE },
      { $limit: PER_PAGE },
      { $project: { _priority: 0 } },
    ])
    .toArray();

  return {
    total,
    page: safePage,
    last_page: Math.max(Math.ceil(total / PER_PAGE), 1),
    items: docs.map(serializeNotification),
  };
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const col = await notifications();
  return col.countDocuments({ user_id: userId, is_read: false });
}

export async function countUnreadMatchNotifications(
  userId: string,
): Promise<number> {
  const col = await notifications();
  return col.countDocuments({
    user_id: userId,
    is_read: false,
    kind: { $in: ["DRAW", "SCORE", "TIME", "ANNOUNCEMENT", "SETTING_CHANGE"] },
  });
}

export async function getMatchNotifications(
  userId: string,
  limit = 8,
): Promise<Notification[]> {
  const col = await notifications();
  const docs = await col
    .find({
      user_id: userId,
      kind: { $in: ["DRAW", "SCORE", "TIME", "ANNOUNCEMENT", "SETTING_CHANGE"] },
    })
    .sort({ _id: -1 })
    .limit(Math.min(Math.max(limit, 1), 20))
    .toArray();
  return docs.map(serializeNotification);
}

export async function markNotificationRead(
  userId: string,
  id: string,
): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const col = await notifications();
  await col.updateOne(
    { _id: new ObjectId(id), user_id: userId },
    { $set: { is_read: true } },
  );
}

export async function markAllNotificationsRead(
  userId: string,
): Promise<void> {
  const col = await notifications();
  await col.updateMany({ user_id: userId }, { $set: { is_read: true } });
}

export async function deleteNotification(
  userId: string,
  id: string,
): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const col = await notifications();
  await col.deleteOne({ _id: new ObjectId(id), user_id: userId });
}
