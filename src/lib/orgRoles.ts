import type { OrgRole } from "@/lib/schemas/common";

/**
 * The roles that run an organization. Mirrors MANAGE_ROLES in orgService, which
 * is the server's authority; this exists so the UI can show the same controls
 * the server will actually allow, without a round trip.
 */
export const ORG_MANAGE_ROLES: OrgRole[] = ["OWNER", "ADMIN"];

export function runsOrg(
  orgs: { org_id: string; role: OrgRole }[],
  orgId: string | undefined,
): boolean {
  if (!orgId) return false;
  return orgs.some(
    (org) => org.org_id === orgId && ORG_MANAGE_ROLES.includes(org.role),
  );
}
