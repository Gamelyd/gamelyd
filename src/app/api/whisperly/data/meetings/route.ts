import { handle, wlOk } from "@/server/whisperly/http";
import { getMeetings, saveMeeting } from "@/server/whisperly/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => wlOk(await getMeetings(req)));
export const POST = handle(async (req) => wlOk(await saveMeeting(req)));
