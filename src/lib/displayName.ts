/**
 * What to call someone on screen.
 *
 * Real names are optional (signup only asks for a username), so anything that
 * renders a person has to cope with them being blank. Falling back to the
 * username keeps a name in place of the empty string a naive
 * `${first} ${last}`.trim() would produce.
 */
export function displayName(user: {
  first_name?: string;
  last_name?: string;
  user_name?: string;
}): string {
  const full = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return full || (user.user_name ?? "").trim() || "Player";
}
