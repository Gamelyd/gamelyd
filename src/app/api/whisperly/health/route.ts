import { wlOk } from "@/server/whisperly/http";
import { wlEnv } from "@/server/whisperly/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets the app tell "server unreachable" apart from "signed out". */
export async function GET() {
  return wlOk({ service: "whisperly", minAppVersion: wlEnv.minAppVersion, paymentsEnabled: wlEnv.paymentsEnabled });
}
