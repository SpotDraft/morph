import assert from "node:assert/strict";
import { test } from "node:test";
import { asReceipt, assertReceipt } from "../src/documents/receipts.js";
import { MorphError } from "../src/errors.js";

test("unwraps nested engine receipt", () => {
  const raw = {
    document: { revision: 1 },
    receipt: {
      success: true,
      txId: "tx-1",
    },
    context: { revision: 1 },
  };
  const rec = asReceipt("replace", raw, 0);
  assert.equal(rec.success, true);
  assert.equal(rec.afterRevision, 1);
  assert.equal(rec.beforeRevision, 0);
});

test("failed nested receipt is not success", () => {
  const raw = {
    receipt: {
      success: false,
      failure: { code: "REVISION_MISMATCH", message: "stale" },
    },
    context: { revision: 0 },
  };
  const rec = asReceipt("replace", raw, "sd-opaque");
  assert.equal(rec.success, false);
  assert.equal(rec.failure?.code, "REVISION_MISMATCH");
  assert.throws(() => assertReceipt(rec), (err: unknown) => {
    assert.ok(err instanceof MorphError);
    assert.equal(err.code, "REVISION_MISMATCH");
    assert.equal(err.status, 400);
    return true;
  });
});
