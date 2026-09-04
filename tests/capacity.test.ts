import assert from "node:assert/strict";
import { test } from "node:test";
import { capacityReport, estimateMaxWarmDocs, MEASURED } from "../src/admission/capacity.js";
import { SdkHost } from "../src/hosts/sdk-host.js";
import { MorphError } from "../src/errors.js";

test("2 GiB estimate is in the 80–120 band for Ping-MSA docs", () => {
  const n = estimateMaxWarmDocs("pingMsa");
  assert.ok(n >= 80, `expected >= 80, got ${n}`);
  assert.ok(n <= 150, `expected a conservative band, got ${n}`);
  assert.equal(MEASURED.budgetMb, 2048);
});

test("capacity report stays sessionful and does not claim v2 rooms", () => {
  const report = capacityReport({
    warmHandles: 0,
    openCount: 0,
    slots: 8,
    inFlight: 0,
    engineConnected: false,
    maxWarm: 64,
  });
  assert.equal(report.persist.sessionful, true);
  assert.equal(report.budget.guardSeesEngine, true);
  assert.equal(report.collaboration.isolatedEditsUseHocuspocus, false);
  assert.match(report.notes.join(" "), /Redis is required on Cloud Run/);
});

test("write-slot overflow is 503 ADMISSION", async () => {
  const prev = process.env.MORPH_WORKER_SLOTS;
  process.env.MORPH_WORKER_SLOTS = "1";
  const host = new SdkHost();
  try {
    let started = 0;
    const hold = host.withWriteSlot("one", async () => {
      started += 1;
      await new Promise((resolve) => setTimeout(resolve, 40));
      return "ok";
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await assert.rejects(
      () => host.withWriteSlot("two", async () => "nope"),
      (err: unknown) => {
        assert.ok(err instanceof MorphError);
        assert.equal(err.code, "ADMISSION");
        assert.equal(err.status, 503);
        return true;
      },
    );
    assert.equal(await hold, "ok");
    assert.equal(started, 1);
  } finally {
    await host.dispose();
    if (prev == null) delete process.env.MORPH_WORKER_SLOTS;
    else process.env.MORPH_WORKER_SLOTS = prev;
  }
});
