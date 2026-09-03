import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { exportFileName } from "@/lib/exportImage";

describe("exportFileName", () => {
  test("joins the tournament and the view", () => {
    assert.equal(exportFileName("Lisbon Cup", "bracket"), "lisbon-cup-bracket.png");
  });

  test("strips accents rather than mangling them", () => {
    // "São João Cup" must not collapse into a row of dashes.
    assert.equal(
      exportFileName("São João Cup", "teams"),
      "sao-joao-cup-teams.png",
    );
  });

  test("collapses punctuation and spacing", () => {
    assert.equal(
      exportFileName("  FIFA 25 — Season #1!  ", "groups"),
      "fifa-25-season-1-groups.png",
    );
  });

  test("falls back when a name has nothing usable in it", () => {
    assert.equal(exportFileName("!!!", "bracket"), "tournament-bracket.png");
    assert.equal(exportFileName("", "champions"), "tournament-champions.png");
    assert.equal(exportFileName("Cup", ""), "cup-export.png");
  });

  test("trims a very long name at a word boundary", () => {
    const name = exportFileName("a".repeat(120), "teams");
    assert.ok(name.length <= 70, name);
    assert.ok(name.endsWith("-teams.png"));
  });

  test("never leaves a stray dash before the extension", () => {
    const name = exportFileName("Cup ---", "teams");
    assert.equal(name, "cup-teams.png");
  });
});
