/**
 * Discriminated result type returned by every Server Action.
 * Keeps the client fully typed without throwing across the network boundary.
 */
export interface Failure {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
}

export type ActionResult<T> = { ok: true; data: T; message?: string } | Failure;

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(
  error: string,
  fieldErrors?: Record<string, string[]>,
): Failure {
  return { ok: false, error, fieldErrors };
}

/** Standard paginated payload. */
export interface Paginated<T> {
  total: number;
  page: number;
  last_page: number;
  items: T[];
}
