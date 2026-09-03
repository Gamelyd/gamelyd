/**
 * Maximum lengths for everything a user can type.
 *
 * These are the single source of truth: the Zod input schemas enforce them on
 * the server (so a request made outside the browser is rejected the same way),
 * and the form controls pass the same number to `maxLength` so the field stops
 * accepting text instead of failing on submit.
 *
 * Only input schemas use these. The schemas that parse documents coming back
 * out of MongoDB stay unbounded, so a row written before a limit existed still
 * reads.
 */
export const LIMITS = {
  /* People */
  firstName: 100,
  lastName: 100,
  userName: 30,
  /** RFC 5321 caps an address at 254 characters. */
  email: 254,
  phone: 32,
  /** bcrypt only reads the first 72 bytes; the cap stops huge inputs costing CPU. */
  password: 128,
  socialHandle: 100,
  country: 56,
  location: 120,

  /* Names */
  tournamentName: 100,
  gameName: 100,
  teamName: 60,
  orgName: 100,
  playerName: 80,
  groupName: 60,
  platformName: 60,
  formatName: 40,

  /* Free text */
  note: 2000,
  description: 2000,
  announcement: 1000,
  message: 2000,
  bio: 500,
  comment: 1000,
  reason: 80,

  /* Machine-ish strings */
  url: 500,
  iconRef: 500,
  timezone: 64,
  dateString: 40,
  id: 100,
  reference: 120,
  searchQuery: 120,
} as const;

export type LimitKey = keyof typeof LIMITS;
