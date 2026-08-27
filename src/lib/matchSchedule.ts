function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function parseMatchStart(value: string | undefined): Date | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const iso = raw.includes("T") ? raw : `${raw}T12:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function formatMatchStamp(date: Date): { Date: string; Time: string } {
  return {
    Date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    Time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

/** Stamp Date/Time onto newly generated fixtures from the host's schedule. */
export function stampMatchTimes<T extends { Date: string; Time: string }>(
  items: T[],
  firstMatchAt: string | undefined,
  intervalMinutes: number | undefined,
  alreadyStamped = 0,
): T[] {
  const start = parseMatchStart(firstMatchAt);
  if (!start || items.length === 0) return items;
  const step = Math.max(0, intervalMinutes || 0) * 60_000;
  return items.map((item, index) => {
    const at = new Date(start.getTime() + (alreadyStamped + index) * step);
    const stamp = formatMatchStamp(at);
    return { ...item, Date: stamp.Date, Time: stamp.Time };
  });
}
