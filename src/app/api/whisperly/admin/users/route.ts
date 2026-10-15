import { handle, wlOk } from "@/server/whisperly/http";
import { adminListUsers } from "@/server/whisperly/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => wlOk(await adminListUsers(req)));
