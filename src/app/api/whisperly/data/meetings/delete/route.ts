import { handle, wlOk } from "@/server/whisperly/http";
import { deleteMeeting } from "@/server/whisperly/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req) => wlOk(await deleteMeeting(req)));
