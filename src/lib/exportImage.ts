/**
 * Naming for images a host downloads off a tournament page.
 *
 * Kept pure and separate from the capture itself: the capture needs a browser,
 * this does not, so the part with rules worth checking can be tested directly.
 */

/** Marks a node to leave out of a capture -- controls, menus, the button itself. */
export const EXPORT_HIDE_ATTR = "data-export-hide";

/** Marks a node that only appears in the capture, such as the credit strip. */
export const EXPORT_ONLY_ATTR = "data-export-only";

function slug(value: string): string {
  return value
    .normalize("NFKD")
    // Strip accents so a Portuguese club name does not become a run of dashes.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * `<tournament>-<view>.png`, falling back to something sensible when a name is
 * all punctuation or another script, since a file called `-.png` helps nobody.
 */
export function exportFileName(tournamentName: string, view: string): string {
  const name = slug(tournamentName) || "tournament";
  const part = slug(view) || "export";
  // Long names get trimmed at a dash so the file name stays readable.
  const trimmed =
    name.length > 60 ? name.slice(0, 60).replace(/-[^-]*$/, "") : name;
  return `${trimmed}-${part}.png`;
}
