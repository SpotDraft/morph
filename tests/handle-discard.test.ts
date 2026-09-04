import assert from "node:assert/strict";
import { test } from "node:test";
import { MorphError } from "../src/errors.js";
import { bootApp, uploadFixture } from "./helpers.js";

/**
 * A typed 400 mutated nothing, so dropping the handle costs a full engine
 * boot for free. Only an engine failure (or an unknown throw) is untrustworthy.
 */
test("only engine failures discard the warm handle", async () => {
  const { app, host, registry } = await bootApp();
  try {
    const sessionId = "discard-1";
    assert.equal((await uploadFixture(app, sessionId)).statusCode, 200);

    let closes = 0;
    const realClose = host.closeHandle.bind(host);
    host.closeHandle = async (...args: Parameters<typeof realClose>) => {
      closes += 1;
      return realClose(...args);
    };

    for (const code of ["NO_MATCH", "AMBIGUOUS_MATCH", "PRECONDITION_FAILED", "VALIDATION"] as const) {
      await assert.rejects(
        registry.mutate(sessionId, "probe", async () => {
          throw new MorphError(code, code);
        }),
        (err: unknown) => err instanceof MorphError && err.code === code,
      );
      assert.equal(closes, 0, `${code} must not close the handle`);
      assert.equal(host.stats().warmHandles, 1, `${code} must leave the doc warm`);
      assert.equal(host.stats().engineConnected, true, `${code} must not recycle the engine`);
    }

    await assert.rejects(
      registry.mutate(sessionId, "probe", async () => {
        throw new MorphError("ENGINE_FAILURE", "engine died", { status: 503 });
      }),
    );
    assert.equal(closes, 1, "an engine failure must discard the handle");
    assert.equal(host.stats().warmHandles, 0);

    // An unknown throw is also untrustworthy — we cannot know what it left behind.
    assert.equal((await uploadFixture(app, "discard-2")).statusCode, 200);
    closes = 0;
    await assert.rejects(
      registry.mutate("discard-2", "probe", async () => {
        throw new Error("unexpected");
      }),
    );
    assert.equal(closes, 1, "an unknown throw must discard the handle");
  } finally {
    await app.close();
    await host.dispose();
  }
});
