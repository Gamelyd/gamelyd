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
  const classic = worldCupCross(entries);
  if (classic) return classic;

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

  reduceClashes(pairs);

  // Swapping opponents can leave the better-placed team listed second. Put the
  // higher seed first so a tie reads "group winner v runner-up", not the
  // reverse.
  return pairs.map(([a, b]) => {
    if (b && b.position < a.position) return [b.value, a.value];
    return [a.value, b?.value];
  });
}

/**
 * The classic World Cup shape: groups link up two at a time and the winner of
 * one meets the runner-up of its partner -- A1 v B2, B1 v A2, C1 v D2, D1 v C2.
 *
 * An odd number of groups leaves one without a partner. Rather than give up on
 * the shape, the last three rotate instead: C1 v D2, D1 v E2, E1 v C2. Every
 * group still meets a different one, and the rest of the draw keeps its
 * familiar two-by-two pairing.
 *
 * The version this replaced paired the leftover group with itself, which is how
 * five groups produced "Group E winner v Group E runner-up".
 *
 * Only applies when every group sends exactly a winner and a runner-up. Three
 * through, or best losers filling spare places, has no partner structure to
 * follow and falls through to seeding.
 */
function worldCupCross<T>(
  entries: SeedEntry<T>[],
): [T, T | undefined][] | null {
  const winners = entries.filter((e) => e.position === 1);
  const runners = entries.filter((e) => e.position === 2);
  if (entries.length !== winners.length + runners.length) return null;
  if (winners.length < 2 || winners.length !== runners.length) return null;

  const runnerOf = new Map(runners.map((r) => [r.group, r]));
  if (runnerOf.size !== runners.length) return null;
  if (!winners.every((w) => runnerOf.has(w.group))) return null;

  const order = [...winners].sort((a, b) => a.group.localeCompare(b.group));
  const pairs: [T, T | undefined][] = [];
  const runnerFor = (entry: SeedEntry<T>) => runnerOf.get(entry.group)!.value;

  // With an odd count, hold back the last three for the rotation below.
  const paired = order.length % 2 === 0 ? order.length : order.length - 3;
  for (let i = 0; i + 1 < paired; i += 2) {
    pairs.push([order[i].value, runnerFor(order[i + 1])]);
    pairs.push([order[i + 1].value, runnerFor(order[i])]);
  }

  if (order.length % 2 !== 0) {
    // Three groups in a ring: each winner takes the next group's runner-up.
    const ring = order.slice(-3);
    for (let i = 0; i < ring.length; i += 1) {
      pairs.push([ring[i].value, runnerFor(ring[(i + 1) % ring.length])]);
    }
  }
  return pairs;
}

/**
 * How bad a tie is. Two teams from one group is the worse fault -- they have
 * just played each other -- but two teams that finished in the same place is
 * also wrong: a runner-up should meet a group winner or a best loser, not
 * another runner-up.
 */
function clashCost<T>(a: SeedEntry<T>, b: SeedEntry<T> | undefined): number {
  if (!b) return 0;
  return (a.group === b.group ? 2 : 0) + (a.position === b.position ? 1 : 0);
}

/**
 * Straight seeding leaves clashes that do not have to be there.
 *
 * Six groups with the top two through plus four best thirds seeds out as
 * 2A v 2D and 2B v 2C -- two pairs of runners-up -- yet a pairing with no
 * clash at all exists. Swapping opponents between two ties fixes it without
 * disturbing the strong-against-weak shape, so this keeps looking for a swap
 * that lowers the total until none does.
 */
function reduceClashes<T>(
  pairs: [SeedEntry<T>, SeedEntry<T> | undefined][],
): void {
  const total = () =>
    pairs.reduce((sum, [a, b]) => sum + clashCost(a, b), 0);

  // Bounded so a pathological set cannot spin: each pass must strictly improve,
  // and the score is a small integer, so this ends long before the limit.
  for (let pass = 0; pass < 200 && total() > 0; pass += 1) {
    let improved = false;

    for (let i = 0; i < pairs.length && !improved; i += 1) {
      for (let j = i + 1; j < pairs.length && !improved; j += 1) {
        const [ai, bi] = pairs[i];
        const [aj, bj] = pairs[j];
        const before = clashCost(ai, bi) + clashCost(aj, bj);
        if (before === 0) continue;

        // Trade opponents.
        if (clashCost(ai, bj) + clashCost(aj, bi) < before) {
          pairs[i] = [ai, bj];
          pairs[j] = [aj, bi];
          improved = true;
          break;
        }
        // Or move a seeded team across, which reaches pairings a straight
        // opponent trade cannot.
        if (bj && clashCost(bj, bi) + clashCost(aj, ai) < before) {
          pairs[i] = [bj, bi];
          pairs[j] = [aj, ai];
          improved = true;
        }
      }
    }

    if (!improved) return;
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
