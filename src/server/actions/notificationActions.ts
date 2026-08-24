"use server";

import { ok, fail, type ActionResult, type Paginated } from "@/lib/result";
import type { Notification } from "@/lib/schemas/misc";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/services/notificationService";
import { getSessionClaims } from "@/server/auth/session";

export async function getNotificationsAction(
  page = 1,
): Promise<ActionResult<Paginated<Notification>>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  return ok(await getNotifications(claims.uid, page));
}

export async function markNotificationReadAction(
  id: string,
): Promise<ActionResult<null>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  await markNotificationRead(id);
  return ok(null);
}

export async function markAllNotificationsReadAction(): Promise<
  ActionResult<null>
> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  await markAllNotificationsRead(claims.uid);
  return ok(null);
}

export async function deleteNotificationAction(
  id: string,
): Promise<ActionResult<null>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  await deleteNotification(id);
  return ok(null);
}
