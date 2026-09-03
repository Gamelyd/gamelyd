import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PLANS, type PlanLimits } from "@/lib/plans";
import {
  checkAddManager,
  checkCreateTournament,
  checkResize,
  type CreateTournamentRequest,
} from "@/lib/planPolicy";

const FREE = DEFAULT_PLANS.FREE;

function limits(overrides: Partial<PlanLimits> = {}): PlanLimits {
  return { ...FREE, ...overrides };
}

function request(
  overrides: Partial<CreateTournamentRequest> = {},
): CreateTournamentRequest {
  return {
    orgId: "",
    teams: 8,
    mode: "MULTIPLAYER",
    venues: 1,
    activeCount: 0,
    ...overrides,
  };
}

describe("the free tier is the product", () => {
  test("allows every format", () => {
    for (const mode of FREE.modes) {
      assert.equal(checkCreateTournament(FREE, request({ mode })), null);
    }
  });

  test("does not cap how many tournaments run at once", () => {
    assert.equal(FREE.maxActive, null);
    assert.equal(
      checkCreateTournament(FREE, request({ activeCount: 500 })),
      null,
    );
  });

  test("lets a host publish under an organization's name", () => {
    assert.equal(checkCreateTournament(FREE, request({ orgId: "org_1" })), null);
  });

  test("matches the market's free ceiling on size", () => {
    assert.equal(FREE.maxTeams, 256);
    assert.equal(checkCreateTournament(FREE, request({ teams: 256 })), null);
  });
});

describe("checkCreateTournament", () => {
  test("reports the size ceiling once it is passed", () => {
    const result = checkCreateTournament(FREE, request({ teams: 257 }));
    assert.equal(result?.code, "TEAMS");
    assert.match(result!.message, /256 teams/);
  });

  test("reports a format the tier does not carry", () => {
    const restricted = limits({ modes: ["MULTIPLAYER"] });
    const result = checkCreateTournament(restricted, request({ mode: "GROUPS" }));
    assert.equal(result?.code, "MODE");
    assert.match(result!.message, /Knockout/);
  });

  test("reports org hosting when the tier cannot do it", () => {
    const restricted = limits({ canHostAsOrg: false });
    const result = checkCreateTournament(restricted, request({ orgId: "org_1" }));
    assert.equal(result?.code, "ORG_HOSTING");
  });

  test("reports too many venues", () => {
    const result = checkCreateTournament(FREE, request({ venues: 9 }));
    assert.equal(result?.code, "VENUES");
  });

  test("enforces an active cap when one is configured", () => {
    const capped = limits({ maxActive: 1 });
    assert.equal(checkCreateTournament(capped, request({ activeCount: 0 })), null);
    const result = checkCreateTournament(capped, request({ activeCount: 1 }));
    assert.equal(result?.code, "ACTIVE");
    assert.match(result!.message, /1 tournament at a time/);
  });

  test("an event bought outright ignores the active cap", () => {
    const capped = limits({ maxActive: 1 });
    assert.equal(
      checkCreateTournament(capped, request({ activeCount: 9 }), {
        ignoreActiveCap: true,
      }),
      null,
    );
  });

  test("size is still enforced for a bought event", () => {
    const result = checkCreateTournament(FREE, request({ teams: 300 }), {
      ignoreActiveCap: true,
    });
    assert.equal(result?.code, "TEAMS");
  });

  test("every violation tells the host what to do next", () => {
    const result = checkCreateTournament(FREE, request({ teams: 300 }));
    assert.match(result!.message, /Contact us/);
  });
});

describe("checkResize", () => {
  test("allows growth inside the ceiling", () => {
    assert.equal(checkResize(FREE, 64, 8), null);
  });

  test("blocks growth past the ceiling", () => {
    assert.equal(checkResize(FREE, 300, 8)?.code, "TEAMS");
  });

  test("an event keeps the size it was created at as its own ceiling", () => {
    // Created at 512 under a higher tier, now on FREE: still editable, so a
    // tier change never strands an event its host cannot manage.
    assert.equal(checkResize(FREE, 400, 512), null);
    assert.equal(checkResize(FREE, 512, 512), null);
  });

  test("but can never grow past what it already was", () => {
    assert.equal(checkResize(FREE, 513, 512)?.code, "TEAMS");
  });
});

describe("checkAddManager", () => {
  test("free includes co-managers, up to its seat count", () => {
    assert.equal(FREE.maxManagers, 3);
    assert.equal(checkAddManager(FREE, 0), null);
    assert.equal(checkAddManager(FREE, 2), null);
  });

  test("blocks the seat after the last one", () => {
    const result = checkAddManager(FREE, 3);
    assert.equal(result?.code, "MANAGERS");
    assert.match(result!.message, /3 co-managers/);
  });

  test("a tier with no seats says so plainly", () => {
    const result = checkAddManager(limits({ maxManagers: 0 }), 0);
    assert.equal(result?.code, "MANAGERS");
    assert.match(result!.message, /does not include co-managers/);
  });

  test("unlimited seats never block", () => {
    assert.equal(checkAddManager(limits({ maxManagers: null }), 999), null);
  });
});
