/**
 * The short label on a group chip: "Group A" becomes "A".
 *
 * Tolerates a missing name on purpose. The serializer now guarantees one, but a
 * badge is decoration -- it must never be the reason a tournament page fails to
 * render, which is exactly what happened when a legacy group row arrived with
 * no `GroupName`.
 */
export function groupBadge(name: string | undefined, index: number): string {
  const stripped = (name ?? "").replace(/group/i, "").trim();
  if (stripped) return stripped.slice(0, 2).toUpperCase();
  return String.fromCharCode(65 + (index % 26));
}
