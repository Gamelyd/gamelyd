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

/**
 * Seeds the first knockout round from group qualifiers. When the top two of
 * each group advance, neighbouring groups are crossed: group 1 winner vs
 * group 2 runner-up, and vice versa.
 */
export function seedKnockoutPairs<T>(byPosition: T[][]): [T, T | undefined][] {
  const winners = byPosition[0] ?? [];
  const runners = byPosition[1] ?? [];
  const extra = byPosition.slice(2).flat();

  const canCross =
    extra.length === 0 &&
    winners.length >= 2 &&
    runners.length === winners.length;

  if (canCross) {
    const pairs: [T, T | undefined][] = [];
    let i = 0;
    for (; i + 1 < winners.length; i += 2) {
      pairs.push([winners[i], runners[i + 1]]);
      pairs.push([winners[i + 1], runners[i]]);
    }
    if (i < winners.length) {
      pairs.push([winners[i], runners[i]]);
    }
    return pairs;
  }

  const seeds = byPosition.flat();
  return pairSequential(seeds);
}

/** Placeholder labels for the bracket before anyone has qualified. */
export function groupPlaceholderPairs(
  groupNames: string[],
  advancePerGroup: number,
): [string, string | undefined][] {
  const byPosition: string[][] = [];
  for (let p = 0; p < Math.max(1, advancePerGroup); p++) {
    byPosition.push(groupNames.map((name) => `${name} ${placeName(p + 1)}`));
  }
  return seedKnockoutPairs(byPosition);
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
