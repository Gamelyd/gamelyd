/** Persist multiple platforms on the legacy tournament `Platform` string. */
export function joinPlatforms(names: string[]): string {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))].join(
    " · ",
  );
}

export function splitPlatforms(value: string): string[] {
  if (!value.trim()) return [];
  return [
    ...new Set(
      value
        .split(/[·,]/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}
