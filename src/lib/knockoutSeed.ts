/** Shared knockout seeding so the bracket graph and the draws stay in sync. */

export function placeName(position: number): string {
  if (position === 1) return "winner";
  if (position === 2) return "runner-up";
  const j = position % 10;
  const k = position % 100;
  const suffix =
    j === 1 && k !== 11
      ? "st"
      : j === 2 && k !== 12
        ? "nd"
        : j === 3 && k !== 13
          ? "rd"
          : "th";
  return `${position}${suffix}`;
}

/** A team that came out of a group, with where it finished and where from. */
export interface SeedEntry<T> {
  value: T;
  /** Group it qualified from. Two teams from one group never meet in round one. */
  group: string;
  /** 1 = group winner, 2 = runner-up, and so on. Best losers keep their real place. */
  position: number;
}

/**
 * Seeds the first knockout round from group qualifiers, World Cup style: the
 * best-placed team meets the worst-placed one, and nobody meets a team from
 * their own group.
 *
 * The old version only crossed groups when exactly two advanced. Any other
 * number -- one, three, four, or an uneven set -- fell back to pairing the flat
 * list in order, which put group winners against each other in the first round
 * and sent half the strongest teams home immediately.
 */
export function seedKnockoutPairs<T>(
  entries: SeedEntry<T>[],
): [T, T | undefined][] {
  const seeds = [...entries].sort(
    (a, b) => a.position - b.position || a.group.localeCompare(b.group),
  );

  // Strongest against weakest, working inward: 1st v last, 2nd v second-last.
  const pairs: [SeedEntry<T>, SeedEntry<T> | undefined][] = [];
  let lo = 0;
  let hi = seeds.length - 1;
  while (lo < hi) {
    pairs.push([seeds[lo], seeds[hi]]);
    lo += 1;
    hi -= 1;
  }
  // An odd number of qualifiers leaves one team without an opponent.
  if (lo === hi) pairs.push([seeds[lo], undefined]);

  avoidSameGroup(pairs);
  return pairs.map(([a, b]) => [a.value, b?.value]);
}

/**
 * Straight seeding can still pair two teams from one group -- three groups with
 * two qualifiers each puts 1B against 2B. Swapping the opponents of two pairs
 * fixes it without disturbing who is seeded where.
 */
function avoidSameGroup<T>(
  pairs: [SeedEntry<T>, SeedEntry<T> | undefined][],
): void {
  const clashes = (a: SeedEntry<T>, b?: SeedEntry<T>) =>
    Boolean(b) && a.group === b!.group;

  for (let i = 0; i < pairs.length; i += 1) {
    if (!clashes(pairs[i][0], pairs[i][1])) continue;
    for (let j = 0; j < pairs.length; j += 1) {
      if (j === i) continue;
      const [ai, bi] = pairs[i];
      const [aj, bj] = pairs[j];
      // Swapping is only worth it if it leaves neither pair clashing.
      if (!clashes(ai, bj) && !clashes(aj, bi)) {
        pairs[i] = [ai, bj];
        pairs[j] = [aj, bi];
        break;
      }
    }
  }
}

/** Placeholder labels for the bracket before anyone has qualified. */
export function groupPlaceholderPairs(
  groupNames: string[],
  advancePerGroup: number,
): [string, string | undefined][] {
  const entries: SeedEntry<string>[] = [];
  for (let p = 0; p < Math.max(1, advancePerGroup); p += 1) {
    for (const name of groupNames) {
      entries.push({
        value: `${name} ${placeName(p + 1)}`,
        group: name,
        position: p + 1,
      });
    }
  }
  return seedKnockoutPairs(entries);
}

export function pairSequential<T>(items: T[]): [T, T | undefined][] {
  const pairs: [T, T | undefined][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push([items[i], items[i + 1]]);
  }
  return pairs;
}

/** Odd-team knockout slot: no opponent, or the old "Automatic Qualification" label. */
export function isKnockoutBye(draw: {
  Team2?: { TeamName?: string } | null;
}): boolean {
  const opponent = draw.Team2?.TeamName?.trim() ?? "";
  return opponent.length === 0 || opponent === "Automatic Qualification";
}

/** Byes count as finished even if an older draw stored them as unplayed. */
export function isKnockoutMatchSettled(draw: {
  Played?: boolean;
  Team2?: { TeamName?: string } | null;
}): boolean {
  return Boolean(draw.Played) || isKnockoutBye(draw);
}

/**
 * Pair winners within each half of the bracket so left stays on the left
 * and right stays on the right until the final.
 */
export function pairWithinHalves<T>(items: T[]): [T, T | undefined][] {
  if (items.length <= 2) {
    if (items.length < 2) return [];
    return [[items[0], items[1]]];
  }
  const mid = Math.floor(items.length / 2);
  return [
    ...pairSequential(items.slice(0, mid)),
    ...pairSequential(items.slice(mid)),
  ];
}

export function splitHalves<T>(items: T[]): [T[], T[]] {
  const mid = Math.floor(items.length / 2);
  return [items.slice(0, mid), items.slice(mid)];
}
