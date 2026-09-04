import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { DocumentRegistry, setRegistry } from "../src/documents/registry.js";
import { SdkHost, setHost } from "../src/hosts/sdk-host.js";
import { FilePersistence, setPersistence } from "../src/persistence/store.js";
import { ensureFixture, fixturePath, testUser } from "./helpers.js";

test("file last-good rehydrates after the warm handle and engine are gone", async () => {
  process.env.SUPERDOC_PUBLIC_LICENSE_KEY ||= "morph-test-license";
  ensureFixture();
  const dir = await mkdtemp(path.join(os.tmpdir(), "morph-rehydrate-"));
  const persist = new FilePersistence(dir);
  const host = new SdkHost();
  const registry = new DocumentRegistry(persist, host);
  setPersistence(persist);
  setHost(host);
  setRegistry(registry);
  const app = await createApp();
  try {
    const sessionId = `sess-${randomUUID()}`;
    const fs = await import("node:fs/promises");
    const bytes = await fs.readFile(fixturePath);
    const uploaded = await app.inject({
      method: "POST",
      url: "/upload",
      payload: { sessionId, user: testUser(), fileName: "contract.docx", base64: bytes.toString("base64") },
    });
    assert.equal(uploaded.statusCode, 200, uploaded.body);
    const replaced = await app.inject({
      method: "POST",
      url: "/document/replace",
      payload: { sessionId, oldText: "one (1) year", newText: "two (2) years", caseSensitive: true },
    });
    assert.equal(replaced.statusCode, 200, replaced.body);

    await host.closeHandle(sessionId);
    assert.equal(host.stats().engineConnected, false);
    assert.equal(await persist.exists(sessionId), true);

    const again = await app.inject({ method: "POST", url: "/get-content", payload: { sessionId } });
    assert.equal(again.statusCode, 200, again.body);
    assert.match(String(again.json().text || ""), /two \(2\) years/);
  } finally {
    await app.close();
    await host.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});
