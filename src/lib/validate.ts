import { z } from "zod";

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors: Record<string, string[]>; message: string };

/** Safely parse unknown input against a Zod schema into a typed result. */
export function parseInput<T>(
  schema: z.ZodType<T>,
  data: unknown,
): ParseResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const flattened = result.error.flatten();
  const fieldErrors = flattened.fieldErrors as Record<string, string[]>;
  const firstError: string =
    Object.values(fieldErrors).flat()[0] ??
    flattened.formErrors[0] ??
    "Invalid input";
  return {
    ok: false,
    fieldErrors,
    message: firstError,
  };
}
