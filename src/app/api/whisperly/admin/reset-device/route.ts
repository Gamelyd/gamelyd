import { handle, wlOk } from "@/server/whisperly/http";
import { adminResetDevice } from "@/server/whisperly/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req) => wlOk(await adminResetDevice(req)));
