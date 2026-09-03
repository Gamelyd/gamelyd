import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TEMPLATES,
  resolveTemplates,
  usableTemplates,
  validateTemplate,
  type TournamentTemplate,
} from "@/lib/tournamentTemplates";

function template(overrides: Partial<TournamentTemplate> = {}): TournamentTemplate {
  return { ...DEFAULT_TEMPLATES[0], ...overrides };
}

describe("the shipped templates", () => {
  test("are all internally consistent", () => {
    for (const preset of DEFAULT_TEMPLATES) {
      assert.deepEqual(
        validateTemplate(preset),
        [],
        `${preset.id} should be valid`,
      );
    }
  });

  test("have unique ids", () => {
    const ids = DEFAULT_TEMPLATES.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("stay few enough to be a shortcut rather than another decision", () => {
    assert.ok(
      DEFAULT_TEMPLATES.length <= 6,
      `expected at most 6 presets, got ${DEFAULT_TEMPLATES.length}`,
    );
    // At most two per format, so the picker never reads as a menu.
    for (const mode of new Set(DEFAULT_TEMPLATES.map((t) => t.mode))) {
      const count = DEFAULT_TEMPLATES.filter((t) => t.mode === mode).length;
      assert.ok(count <= 2, `${mode} has ${count} templates`);
    }
  });
});

describe("validateTemplate", () => {
  test("rejects a knockout that cannot halve cleanly", () => {
    const issues = validateTemplate(template({ mode: "MULTIPLAYER", size: 12 }));
    assert.match(issues.join(" "), /power of two/);
  });

  test("rejects groups that do not divide evenly", () => {
    const issues = validateTemplate(
      template({ mode: "GROUPS", size: 15, groupCount: 4 }),
    );
    assert.match(issues.join(" "), /do not divide evenly/);
  });

  test("rejects a groups template with no groups", () => {
    const issues = validateTemplate(
      template({ mode: "GROUPS", size: 16, groupCount: 0 }),
    );
    assert.match(issues.join(" "), /at least 2 groups/);
  });

  test("rejects advancing a whole group", () => {
    // 16 teams in 4 groups is 4 per group; advancing 4 qualifies everyone.
    const issues = validateTemplate(
      template({ mode: "GROUPS", size: 16, groupCount: 4, advancePerGroup: 4 }),
    );
    assert.match(issues.join(" "), /whole group/);
  });

  test("rejects a group count on a format that has no groups", () => {
    const issues = validateTemplate(
      template({ mode: "LEAGUE", size: 10, groupCount: 3 }),
    );
    assert.match(issues.join(" "), /Only a groups template/);
  });

  test("accepts a league of any size", () => {
    // Round robin does not need a power of two.
    assert.deepEqual(
      validateTemplate(template({ mode: "LEAGUE", size: 11, groupCount: 0 })),
      [],
    );
  });
});

describe("usableTemplates", () => {
  const limits = { maxTeams: 256, modes: ["MULTIPLAYER", "GROUPS"] as const };

  test("hides templates the host's plan cannot run", () => {
    const usable = usableTemplates(DEFAULT_TEMPLATES, {
      maxTeams: limits.maxTeams,
      modes: [...limits.modes],
    });
    assert.ok(usable.every((t) => t.mode !== "LEAGUE"));
    assert.ok(usable.length > 0);
  });

  test("hides templates larger than the plan allows", () => {
    const usable = usableTemplates(DEFAULT_TEMPLATES, {
      maxTeams: 8,
      modes: ["MULTIPLAYER", "GROUPS", "LEAGUE", "BATTLEROYALE"],
    });
    assert.ok(usable.every((t) => t.size <= 8));
  });

  test("hides disabled templates", () => {
    const off = DEFAULT_TEMPLATES.map((t) => ({ ...t, enabled: false }));
    assert.deepEqual(
      usableTemplates(off, { maxTeams: 256, modes: ["MULTIPLAYER"] }),
      [],
    );
  });

  test("never offers a template that would build an unrunnable draw", () => {
    const broken = [template({ id: "broken", mode: "MULTIPLAYER", size: 12 })];
    assert.deepEqual(
      usableTemplates(broken, { maxTeams: 256, modes: ["MULTIPLAYER"] }),
      [],
    );
  });
});

describe("resolveTemplates", () => {
  test("uses the shipped list when nothing is saved", () => {
    const { templates, ok } = resolveTemplates(undefined);
    assert.equal(ok, true);
    assert.deepEqual(templates, DEFAULT_TEMPLATES);
  });

  test("accepts a saved list", () => {
    const saved = [template({ id: "custom", name: "Custom" })];
    const { templates, ok } = resolveTemplates(saved);
    assert.equal(ok, true);
    assert.equal(templates[0].id, "custom");
  });

  test("falls back rather than throwing on a bad row", () => {
    for (const bad of ["nope", [{ id: "x" }], [{ ...template(), size: 0 }]]) {
      const { templates, ok } = resolveTemplates(bad);
      assert.equal(ok, false, `expected ${JSON.stringify(bad)} rejected`);
      assert.deepEqual(templates, DEFAULT_TEMPLATES);
    }
  });
});
