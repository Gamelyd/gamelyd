import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { displayName } from "@/lib/displayName";

describe("displayName", () => {
  test("prefers a real name when there is one", () => {
    assert.equal(
      displayName({ first_name: "Ana", last_name: "Silva", user_name: "ana99" }),
      "Ana Silva",
    );
  });

  test("falls back to the username when names are blank", () => {
    // Signup no longer asks for a real name, so this is the common case.
    assert.equal(
      displayName({ first_name: "", last_name: "", user_name: "ana99" }),
      "ana99",
    );
    assert.equal(displayName({ user_name: "ana99" }), "ana99");
  });

  test("copes with a first name and no last name", () => {
    assert.equal(displayName({ first_name: "Ana", user_name: "ana99" }), "Ana");
  });

  test("never renders an empty string", () => {
    assert.equal(displayName({}), "Player");
    assert.equal(
      displayName({ first_name: "  ", last_name: " ", user_name: " " }),
      "Player",
    );
  });
});
