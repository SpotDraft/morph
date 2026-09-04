import assert from "node:assert/strict";
import { test } from "node:test";
import { admitOrThrow } from "../src/admission/memory.js";
import { MorphError } from "../src/errors.js";
import { httpErrorBody, mapEngineCode } from "../src/errors.js";

test("404 vs 400 mapping", () => {
  const expired = new MorphError("SESSION_EXPIRED", "gone");
  assert.equal(expired.status, 404);
  const bad = new MorphError("AMBIGUOUS_MATCH", "many", { detail: { matchCount: 3 } });
  assert.equal(bad.status, 400);
  assert.equal(httpErrorBody(bad).detail.matchCount, 3);
});

test("engine codes map to host codes", () => {
  assert.equal(mapEngineCode("MATCH_NOT_FOUND"), "NO_MATCH");
  assert.equal(mapEngineCode("REVISION_MISMATCH"), "REVISION_MISMATCH");
  assert.equal(mapEngineCode("AMBIGUOUS_TARGET"), "AMBIGUOUS_MATCH");
});

test("memory guard is 503 with Retry-After semantics", () => {
  const prevLimit = process.env.MEMORY_GUARD_RSS_MB;
  const prevEnabled = process.env.ENABLE_MEMORY_GUARD;
  process.env.ENABLE_MEMORY_GUARD = "true";
  process.env.MEMORY_GUARD_RSS_MB = "1";
  try {
    assert.throws(() => admitOrThrow("open"), (err: unknown) => {
      assert.ok(err instanceof MorphError);
      assert.equal(err.code, "ADMISSION");
      assert.equal(err.status, 503);
      assert.equal(err.retryAfter, 15);
      return true;
    });
  } finally {
    if (prevLimit == null) delete process.env.MEMORY_GUARD_RSS_MB;
    else process.env.MEMORY_GUARD_RSS_MB = prevLimit;
    if (prevEnabled == null) delete process.env.ENABLE_MEMORY_GUARD;
    else process.env.ENABLE_MEMORY_GUARD = prevEnabled;
  }
});
