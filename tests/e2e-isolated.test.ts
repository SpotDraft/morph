import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { bootApp, ensureFixture, testUser, uploadFixture } from "./helpers.js";

type Boot = Awaited<ReturnType<typeof bootApp>>;
let boot: Boot;

before(async () => {
  process.env.SUPERDOC_PUBLIC_LICENSE_KEY ||= "morph-test-license";
  ensureFixture();
  boot = await bootApp();
});

after(async () => {
  await boot.app.close();
  await boot.host.dispose();
});

test("health", async () => {
  const res = await boot.app.inject({ method: "GET", url: "/health" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().service, "morph");
});

test("upload requires a real user", async () => {
  const res = await boot.app.inject({
    method: "POST",
    url: "/upload",
    payload: { sessionId: "anon", user: { userid: "anonymous", username: "x" }, base64: "UEs=" },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, "MISSING_USER");
});

test("from/to and numeric position fail closed", async () => {
  const res = await boot.app.inject({
    method: "POST",
    url: "/replace",
    payload: { sessionId: "x", from: 1, to: 4, text: "nope" },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, "OFFSET_FORBIDDEN");

  const ins = await boot.app.inject({
    method: "POST",
    url: "/insert-content",
    payload: { sessionId: "x", position: 0, content: "nope" },
  });
  assert.equal(ins.statusCode, 400);
  assert.equal(ins.json().code, "POSITION_FORBIDDEN");
});

test("upload → query → tracked replace → insert-above-heading → export → reopen", async () => {
  const sessionId = `sess-${randomUUID()}`;
  const uploaded = await uploadFixture(boot.app, sessionId);
  assert.equal(uploaded.statusCode, 200, uploaded.body);
  const up = uploaded.json();
  assert.equal(up.sessionId, sessionId);
  assert.ok(up.collaborationUrl.includes("/collaboration/"));
  assert.equal(up.user.userid, testUser().userid);

  const structure = await boot.app.inject({
    method: "POST",
    url: "/document/structure",
    payload: { sessionId },
  });
  assert.equal(structure.statusCode, 200, structure.body);
  const outline = structure.json();
  assert.ok(outline.totalBlocks >= 3);
  const heading = outline.blocks.find((b: { role?: string; type?: string }) =>
    String(b.role || b.type).startsWith("heading"),
  );
  assert.ok(heading, "expected a heading in the outline");

  const query = await boot.app.inject({
    method: "POST",
    url: "/document/query",
    payload: {
      sessionId,
      pattern: "one (1) year",
      require: "exactlyOne",
      caseSensitive: true,
    },
  });
  assert.equal(query.statusCode, 200, query.body);
  const match = query.json();
  assert.equal(match.total, 1);

  const replaced = await boot.app.inject({
    method: "POST",
    url: "/document/replace",
    payload: {
      sessionId,
      oldText: "one (1) year",
      newText: "two (2) years",
      expectedText: "The Term shall be one (1) year.",
      caseSensitive: true,
    },
  });
  assert.equal(replaced.statusCode, 200, replaced.body);
  assert.notEqual(replaced.json().success, false);

  const inserted = await boot.app.inject({
    method: "POST",
    url: "/document/insert",
    payload: {
      sessionId,
      position: "before",
      anchorId: heading.nodeId || heading.blockId,
      nodeType: heading.type || "heading",
      content: "CONFIDENTIAL — inserted above heading",
    },
  });
  assert.equal(inserted.statusCode, 200, inserted.body);

  const table = await boot.app.inject({
    method: "POST",
    url: "/document/query",
    payload: { sessionId, pattern: "Net 30", require: "exactlyOne", caseSensitive: true },
  });
  assert.equal(table.statusCode, 200, table.body);

  const tableReplace = await boot.app.inject({
    method: "POST",
    url: "/document/replace",
    payload: { sessionId, oldText: "Net 30", newText: "Net 45", caseSensitive: true },
  });
  assert.equal(tableReplace.statusCode, 200, tableReplace.body);

  const exported = await boot.app.inject({
    method: "POST",
    url: "/export",
    payload: { sessionId },
  });
  assert.equal(exported.statusCode, 200, exported.body);
  assert.match(
    exported.headers["content-type"] || "",
    /officedocument.wordprocessingml.document|application\/octet-stream/,
  );
  assert.ok((exported.rawPayload as Buffer).length > 1000);

  await boot.host.closeHandle(sessionId);
  const still = await boot.app.inject({ method: "GET", url: `/validate-session/${sessionId}` });
  assert.equal(still.statusCode, 200);

  const again = await boot.app.inject({
    method: "POST",
    url: "/get-content",
    payload: { sessionId },
  });
  assert.equal(again.statusCode, 200, again.body);
  const text = String(again.json().text || "");
  assert.match(text, /two \(2\) years/);
  assert.match(text, /CONFIDENTIAL/);
  assert.match(text, /Net 45/);
  assert.match(text, /Definitions/);
});

test("replace-all returns a visible set, not a bare count", async () => {
  const sessionId = `sess-${randomUUID()}`;
  const uploaded = await uploadFixture(boot.app, sessionId);
  assert.equal(uploaded.statusCode, 200, uploaded.body);
  const res = await boot.app.inject({
    method: "POST",
    url: "/replace-all",
    payload: { sessionId, search: "Supplier", replace: "Vendor", caseSensitive: true, wholeWord: true },
  });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json();
  assert.ok(Array.isArray(body.matches));
  assert.ok(body.matches.length >= 1);
  assert.ok("excluded" in body);
  assert.ok(body.committed === true || body.replaced >= 1);
  assert.ok(!("count" in body && !body.matches));
  const content = await boot.app.inject({ method: "POST", url: "/get-content", payload: { sessionId } });
  assert.match(String(content.json().text || ""), /Vendor/);
});

test("insert-after-paragraph is structural, not a character offset", async () => {
  const sessionId = `sess-${randomUUID()}`;
  assert.equal((await uploadFixture(boot.app, sessionId)).statusCode, 200);
  const structure = await boot.app.inject({
    method: "POST",
    url: "/document/structure",
    payload: { sessionId },
  });
  assert.equal(structure.statusCode, 200, structure.body);
  const bodyPara = structure.json().blocks.find((b: { type?: string; textPreview?: string }) =>
    String(b.textPreview || "").includes("one (1) year"),
  );
  assert.ok(bodyPara?.nodeId);
  const inserted = await boot.app.inject({
    method: "POST",
    url: "/insert-after-paragraph",
    payload: { sessionId, afterParaId: bodyPara.nodeId, content: "Inserted after term paragraph." },
  });
  assert.equal(inserted.statusCode, 200, inserted.body);
  const content = await boot.app.inject({ method: "POST", url: "/get-content", payload: { sessionId } });
  assert.match(String(content.json().text || ""), /Inserted after term paragraph/);
});

test("unknown session is 404, not a content error", async () => {
  const res = await boot.app.inject({
    method: "POST",
    url: "/document/query",
    payload: { sessionId: "missing", pattern: "x" },
  });
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().code, "SESSION_EXPIRED");
});

test("expectedText failure is 400 PRECONDITION_FAILED, not 404", async () => {
  const sessionId = `sess-${randomUUID()}`;
  assert.equal((await uploadFixture(boot.app, sessionId)).statusCode, 200);
  const res = await boot.app.inject({
    method: "POST",
    url: "/document/replace",
    payload: {
      sessionId,
      oldText: "one (1) year",
      newText: "two (2) years",
      expectedText: "this clause is not in the document",
      caseSensitive: true,
    },
  });
  assert.equal(res.statusCode, 400, res.body);
  assert.equal(res.json().code, "PRECONDITION_FAILED");
});

test("mutations.preview does not persist and does not change get-content", async () => {
  const sessionId = `sess-${randomUUID()}`;
  assert.equal((await uploadFixture(boot.app, sessionId)).statusCode, 200);
  const before = await boot.app.inject({ method: "POST", url: "/get-content", payload: { sessionId } });
  assert.equal(before.statusCode, 200, before.body);
  const preview = await boot.app.inject({
    method: "POST",
    url: "/document/mutations/preview",
    payload: {
      sessionId,
      atomic: true,
      steps: [
        {
          id: "preview-1",
          op: "text.rewrite",
          where: {
            by: "select",
            select: { type: "text", pattern: "one (1) year", caseSensitive: true },
            require: "exactlyOne",
          },
          args: { replacement: { text: "SHOULD NOT PERSIST" } },
        },
      ],
    },
  });
  assert.equal(preview.statusCode, 200, preview.body);
  assert.equal(preview.json().committed, false);
  const after = await boot.app.inject({ method: "POST", url: "/get-content", payload: { sessionId } });
  assert.equal(after.statusCode, 200, after.body);
  assert.match(String(after.json().text || ""), /one \(1\) year/);
  assert.doesNotMatch(String(after.json().text || ""), /SHOULD NOT PERSIST/);
});

test("search is case-sensitive and replace-in-paragraph uses paraId", async () => {
  const sessionId = `sess-${randomUUID()}`;
  assert.equal((await uploadFixture(boot.app, sessionId)).statusCode, 200);
  const sensitive = await boot.app.inject({
    method: "POST",
    url: "/search",
    payload: { sessionId, phrase: "supplier" },
  });
  assert.equal(sensitive.statusCode, 200, sensitive.body);
  assert.equal(sensitive.json().count, 0);

  const hits = await boot.app.inject({
    method: "POST",
    url: "/search",
    payload: { sessionId, phrase: "one (1) year" },
  });
  assert.equal(hits.statusCode, 200, hits.body);
  assert.ok(hits.json().count >= 1);
  const paraId = hits.json().results[0].blockId;
  assert.ok(paraId);

  const replaced = await boot.app.inject({
    method: "POST",
    url: "/replace-in-paragraph",
    payload: {
      sessionId,
      paraId,
      oldText: "one (1) year",
      newText: "three (3) years",
      expectedContext: "The Term shall be one (1) year.",
    },
  });
  assert.equal(replaced.statusCode, 200, replaced.body);
  assert.equal(replaced.json().success, true);

  const content = await boot.app.inject({ method: "POST", url: "/get-content", payload: { sessionId } });
  assert.match(String(content.json().text || ""), /three \(3\) years/);
});

test("comment anchored by phrase lists back", async () => {
  const sessionId = `sess-${randomUUID()}`;
  assert.equal((await uploadFixture(boot.app, sessionId)).statusCode, 200);
  const added = await boot.app.inject({
    method: "POST",
    url: "/add-comment",
    payload: { sessionId, text: "Check the term", phrase: "one (1) year" },
  });
  assert.equal(added.statusCode, 200, added.body);
  const listed = await boot.app.inject({
    method: "GET",
    url: `/get-comments?sessionId=${sessionId}`,
  });
  assert.equal(listed.statusCode, 200, listed.body);
});

test("delete session is 404 afterwards", async () => {
  const sessionId = `sess-${randomUUID()}`;
  assert.equal((await uploadFixture(boot.app, sessionId)).statusCode, 200);
  const del = await boot.app.inject({ method: "DELETE", url: `/session/${sessionId}` });
  assert.equal(del.statusCode, 200, del.body);
  const gone = await boot.app.inject({
    method: "POST",
    url: "/document/query",
    payload: { sessionId, pattern: "x" },
  });
  assert.equal(gone.statusCode, 404);
});

test("find-term and check-references answer without dumping an index", async () => {
  const sessionId = `sess-${randomUUID()}`;
  assert.equal((await uploadFixture(boot.app, sessionId)).statusCode, 200);
  const term = await boot.app.inject({
    method: "POST",
    url: "/document/find-term",
    payload: { sessionId, term: "Supplier" },
  });
  assert.equal(term.statusCode, 200, term.body);
  assert.ok(Array.isArray(term.json().occurrences));
  const refs = await boot.app.inject({
    method: "POST",
    url: "/document/check-references",
    payload: { sessionId },
  });
  assert.equal(refs.statusCode, 200, refs.body);
  assert.ok(Array.isArray(refs.json().broken));
});
