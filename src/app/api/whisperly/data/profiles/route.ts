import { handle, wlOk } from "@/server/whisperly/http";
import { listProfiles, saveProfile } from "@/server/whisperly/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => wlOk(await listProfiles(req)));
export const POST = handle(async (req) => wlOk(await saveProfile(req)));
