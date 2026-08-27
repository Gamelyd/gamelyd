/** Calendar date `YYYY-MM-DD` is treated as the end of that local day. */
function endOfDay(value: string): Date | null {
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T23:59:59`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value: string): Date | null {
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function registrationDeadlinePassed(
  deadline: string | undefined,
  now = new Date(),
): boolean {
  const end = endOfDay(deadline ?? "");
  if (!end) return false;
  return now.getTime() > end.getTime();
}

export function registrationOpen(tournament: {
  Start: boolean;
  RegistrationDeadline?: string;
}): boolean {
  if (tournament.Start) return false;
  return !registrationDeadlinePassed(tournament.RegistrationDeadline);
}

export function checkInWindowOpen(
  tournament: {
    Start: boolean;
    CheckInRequired?: boolean;
    CheckInOpens?: string;
    CheckInCloses?: string;
    Date?: string;
  },
  now = new Date(),
): boolean {
  if (!tournament.CheckInRequired) return false;
  if (tournament.Start) return false;
  const opens = startOfDay(tournament.CheckInOpens || "") ?? null;
  const closes =
    endOfDay(tournament.CheckInCloses || "") ??
    endOfDay(tournament.Date || "") ??
    null;
  if (opens && now.getTime() < opens.getTime()) return false;
  if (closes && now.getTime() > closes.getTime()) return false;
  return true;
}
