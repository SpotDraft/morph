import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { FilePersistence, MemoryPersistence } from "../src/persistence/store.js";

const meta = {
  sessionId: "s1",
  user: { userid: "u", username: "n", name: "n" },
  accessMode: "isolated" as const,
  fileName: "a.docx",
  lastGoodRevision: 0,
  lastGoodAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

test("memory persist round-trips last-good bytes", async () => {
  const store = new MemoryPersistence();
  const bytes = Buffer.from("docx-bytes");
  await store.save({ meta, lastGood: bytes, original: bytes });
  const loaded = await store.load("s1");
  assert.ok(loaded);
  assert.equal(loaded.lastGood.equals(bytes), true);
  assert.equal(await store.exists("s1"), true);
  await store.delete("s1");
  assert.equal(await store.exists("s1"), false);
});

test("file persist writes last-good beside meta", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "morph-persist-"));
  try {
    const store = new FilePersistence(dir);
    const bytes = Buffer.from("PK\x03\x04-file");
    await store.save({ meta, lastGood: bytes });
    const loaded = await store.load("s1");
    assert.ok(loaded);
    assert.equal(loaded.meta.fileName, "a.docx");
    assert.equal(loaded.lastGood.equals(bytes), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
