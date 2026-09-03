import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { groupBadge } from "@/lib/groupBadge";

describe("groupBadge", () => {
  test("strips the word group and keeps the identifier", () => {
    assert.equal(groupBadge("Group A", 0), "A");
    assert.equal(groupBadge("group 12", 0), "12");
  });

  test("falls back to a letter when there is nothing left", () => {
    assert.equal(groupBadge("Group", 0), "A");
    assert.equal(groupBadge("", 1), "B");
  });

  test("survives a name that is missing entirely", () => {
    // This threw and took the whole tournament page into client rendering.
    assert.equal(groupBadge(undefined, 2), "C");
    assert.equal(groupBadge(null as unknown as string, 0), "A");
  });

  test("wraps past 26 groups rather than running off the alphabet", () => {
    assert.equal(groupBadge("", 26), "A");
  });
});
