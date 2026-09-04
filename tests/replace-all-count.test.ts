import assert from "node:assert/strict";
import { test } from "node:test";
import { replaceAllSteps, type MatchItem } from "../src/documents/query.js";

function match(nodeId: string): MatchItem {
  return { address: { nodeId, nodeType: "paragraph" }, target: { kind: "block", nodeId } };
}

test("replace-all without exclusions is one require:all step and counts chosen matches", () => {
  const matches = [match("a"), match("b"), match("c")];
  const plan = replaceAllSteps("Supplier", "Vendor", matches, new Set());
  assert.equal(plan.mode, "all");
  assert.equal(plan.chosen.length, 3);
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0]?.where.require, "all");
});

test("replace-all with exclusions uses sequential mode and drops skipped blocks", () => {
  const matches = [match("def"), match("a"), match("b")];
  const plan = replaceAllSteps("Supplier", "Vendor", matches, new Set(["def"]));
  assert.equal(plan.mode, "sequential");
  assert.equal(plan.chosen.length, 2);
  assert.equal(plan.excluded.length, 1);
  assert.equal(plan.excluded[0]?.blockId, "def");
  assert.equal(plan.steps.length, 0);
});
