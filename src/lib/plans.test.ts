import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PLANS, normalizePlan, resolvePlanConfig } from "@/lib/plans";

describe("normalizePlan", () => {
  test("accepts the current tiers in any casing", () => {
    assert.equal(normalizePlan("FREE"), "FREE");
    assert.equal(normalizePlan("club"), "CLUB");
    assert.equal(normalizePlan("  Club  "), "CLUB");
  });

  test("maps retired tiers onto a current one instead of demoting", () => {
    // A customer on LEAGUE paid for more than FREE; silently dropping them to
    // the free tier would take away what they bought.
    assert.equal(normalizePlan("LEAGUE"), "CLUB");
    assert.equal(normalizePlan("PRO"), "CLUB");
  });

  test("falls back to FREE for anything unrecognised", () => {
    assert.equal(normalizePlan(undefined), "FREE");
    assert.equal(normalizePlan(null), "FREE");
    assert.equal(normalizePlan(42), "FREE");
    assert.equal(normalizePlan("ENTERPRISE"), "FREE");
  });
});

describe("resolvePlanConfig", () => {
  test("uses the shipped defaults when nothing is saved", () => {
    const { config, ok } = resolvePlanConfig(undefined);
    assert.equal(ok, true);
    assert.deepEqual(config, DEFAULT_PLANS);
  });

  test("merges a partial override over the defaults", () => {
    const { config, ok } = resolvePlanConfig({ FREE: { maxTeams: 64 } });
    assert.equal(ok, true);
    assert.equal(config.FREE.maxTeams, 64);
    // Untouched fields still resolve, so adding a field later cannot break a
    // config saved before it existed.
    assert.equal(config.FREE.maxVenues, DEFAULT_PLANS.FREE.maxVenues);
    assert.deepEqual(config.CLUB, DEFAULT_PLANS.CLUB);
  });

  test("rejects a config that would remove the size ceiling", () => {
    // TournamentSize has no upper bound of its own, so this is the only thing
    // preventing a bracket large enough to take the site down.
    const { ok } = resolvePlanConfig({ FREE: { maxTeams: 0 } });
    assert.equal(ok, false);
  });

  test("falls back to defaults rather than throwing on a bad row", () => {
    for (const bad of ["nonsense", { FREE: { maxTeams: -5 } }, { FREE: 7 }]) {
      const { config, ok } = resolvePlanConfig(bad);
      assert.equal(ok, false, `expected ${JSON.stringify(bad)} to be rejected`);
      assert.deepEqual(config, DEFAULT_PLANS);
    }
  });
});
