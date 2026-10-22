import { handle, wlOk } from "@/server/whisperly/http";
import { deleteProfile } from "@/server/whisperly/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req) => wlOk(await deleteProfile(req)));
