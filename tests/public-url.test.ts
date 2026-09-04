import assert from "node:assert/strict";
import { test } from "node:test";
import { countWholeWords } from "../src/documents/consistency.js";
import { buildCollaborationUrl, toWebsocketOrigin } from "../src/http/public-url.js";

test("https public base becomes wss", () => {
  const prev = process.env.MORPH_PUBLIC_BASE_URL;
  process.env.MORPH_PUBLIC_BASE_URL = "https://editor.example.com";
  try {
    assert.equal(buildCollaborationUrl("s1"), "wss://editor.example.com/collaboration/s1");
  } finally {
    if (prev == null) delete process.env.MORPH_PUBLIC_BASE_URL;
    else process.env.MORPH_PUBLIC_BASE_URL = prev;
  }
});

test("forwarded https request becomes wss", () => {
  const prev = process.env.MORPH_PUBLIC_BASE_URL;
  delete process.env.MORPH_PUBLIC_BASE_URL;
  try {
    assert.equal(
      buildCollaborationUrl("s1", { host: "editor.example.com", proto: "https" }),
      "wss://editor.example.com/collaboration/s1",
    );
  } finally {
    if (prev != null) process.env.MORPH_PUBLIC_BASE_URL = prev;
  }
});

test("http origin converts by rewriting the scheme prefix", () => {
  const converted = toWebsocketOrigin("http://127.0.0.1:5006");
  assert.equal(converted.startsWith("ws"), true);
  assert.equal(converted.endsWith("://127.0.0.1:5006"), true);
  assert.equal(converted.includes("127.0.0.1:5006"), true);
});

test("whole-word count skips look-alikes", () => {
  assert.equal(countWholeWords('"Supplier" means Supplierish and Supplier', "Supplier"), 2);
  assert.equal(countWholeWords("Preferred Supplier Program", "Supplier"), 1);
});
