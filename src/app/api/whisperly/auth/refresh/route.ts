import { handle, wlOk } from "@/server/whisperly/http";
import { refresh } from "@/server/whisperly/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req) => wlOk(await refresh(req)));
