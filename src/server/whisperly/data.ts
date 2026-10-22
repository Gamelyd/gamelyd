import "server-only";
import { DATA_LIMITS, dataIdSchema, meetingSaveSchema, profileSaveSchema, settingsSaveSchema } from "@/lib/whisperly/schemas";
import { requireDevice } from "./auth";
import { wlMeetings, wlProfiles, wlSettings } from "./db";
import { readBody, WlError } from "./http";

// The app's synced data: settings, context profiles and recent meetings.
// Only the signed-in Mac can read or write its own account's data.

const now = (): string => new Date().toISOString();

function parse(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// ---- settings ----

export async function getSettings(req: Request) {
  const { user } = await requireDevice(req, "");
  const doc = await (await wlSettings()).findOne({ user_id: user.user_id });
  return { settings: doc ? parse(doc.data) : null, updatedAt: doc?.updated_at ?? null };
}

export async function saveSettings(req: Request) {
  const { raw, data } = await readBody(req, settingsSaveSchema, DATA_LIMITS.settings);
  const { user } = await requireDevice(req, raw);
  const updatedAt = now();
  await (await wlSettings()).updateOne(
    { user_id: user.user_id },
    { $set: { data: JSON.stringify(data.settings), updated_at: updatedAt } },
    { upsert: true },
  );
  return { updatedAt };
}

// ---- context profiles ----

export async function listProfiles(req: Request) {
  const { user } = await requireDevice(req, "");
  const docs = await (await wlProfiles()).find({ user_id: user.user_id }).sort({ updated_at: -1 }).limit(200).toArray();
  return { profiles: docs.map((d) => parse(d.data)).filter(Boolean) };
}

export async function saveProfile(req: Request) {
  const { raw, data } = await readBody(req, profileSaveSchema, DATA_LIMITS.profile);
  const { user } = await requireDevice(req, raw);
  const p = data.profile;
  await (await wlProfiles()).updateOne(
    { user_id: user.user_id, profile_id: p.id },
    { $set: { name: p.name, data: JSON.stringify(p), updated_at: now() } },
    { upsert: true },
  );
  return { saved: true };
}

export async function deleteProfile(req: Request) {
  const { raw, data } = await readBody(req, dataIdSchema);
  const { user } = await requireDevice(req, raw);
  await (await wlProfiles()).deleteOne({ user_id: user.user_id, profile_id: data.id });
  return { deleted: true };
}

// ---- meetings ----

/** Without `?id`: the list (newest first). With `?id=`: that whole meeting. */
export async function getMeetings(req: Request) {
  const { user } = await requireDevice(req, "");
  const meetings = await wlMeetings();
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const doc = await meetings.findOne({ user_id: user.user_id, meeting_id: id });
    if (!doc) throw new WlError("NOT_FOUND", "Meeting not found.", 404);
    return { meeting: parse(doc.data) };
  }
  const docs = await meetings
    .find({ user_id: user.user_id }, { projection: { data: 0 } })
    .sort({ started_at: -1 })
    .limit(200)
    .toArray();
  return {
    meetings: docs.map((d) => ({ id: d.meeting_id, title: d.title, startedAt: d.started_at, endedAt: d.ended_at ?? undefined, preview: d.preview })),
  };
}

export async function saveMeeting(req: Request) {
  const { raw, data } = await readBody(req, meetingSaveSchema, DATA_LIMITS.meeting);
  const { user } = await requireDevice(req, raw);
  const m = data.meeting;
  await (await wlMeetings()).updateOne(
    { user_id: user.user_id, meeting_id: m.id },
    {
      $set: {
        title: m.title,
        preview: data.preview,
        started_at: m.startedAt,
        ended_at: m.endedAt ?? null,
        data: JSON.stringify(m),
        updated_at: now(),
      },
    },
    { upsert: true },
  );
  return { saved: true };
}

export async function deleteMeeting(req: Request) {
  const { raw, data } = await readBody(req, dataIdSchema);
  const { user } = await requireDevice(req, raw);
  await (await wlMeetings()).deleteOne({ user_id: user.user_id, meeting_id: data.id });
  return { deleted: true };
}
