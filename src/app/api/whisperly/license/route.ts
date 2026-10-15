import { handle, wlOk } from "@/server/whisperly/http";
import { license } from "@/server/whisperly/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => wlOk(await license(req)));
