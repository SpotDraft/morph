# Implementation handoff — SuperDoc document-engine host

**For:** a new long-running implementation chat  
**From:** architecture run on `cursor/document-editor-architecture-redesign-011f` ([PR #123](https://github.com/SpotDraft/superdoc/pull/123))  
**Date:** 2026-09-04  
**Repo:** `SpotDraft/superdoc` (this service). Consumers live in other repos and are **not** rewritten in the first wave.

This file is the briefing. The spine is the law. SuperDoc’s current docs are the engine reference. The existing routes and tests are the behavior to preserve.

---

## 0. Paste this into the new chat

```text
Implement the SuperDoc document-engine host described in
docs/architecture/architecture-superdoc-redesign-2026-09-03/.

Read first, in this order:
1. docs/architecture/architecture-superdoc-redesign-2026-09-03/IMPLEMENTATION-HANDOFF.md
2. docs/architecture/architecture-superdoc-redesign-2026-09-03/ARCHITECTURE-SPINE.md
   (AD-1–AD-28 are binding. Do not re-decide them.)
3. docs/architecture/architecture-superdoc-redesign-2026-09-03/ARCHITECTURE-REDESIGN.md
4. Current host: server.ts, app.ts, routes/, editor/, sessions/, collaboration/,
   infra/, tests/AGENTS.md, routes/AGENTS.md
5. SuperDoc vendor docs at https://docs.superdoc.dev/ whenever a Document API
   name, receipt, target, or SDK option is unclear. Prefer live docs over
   leftover @superdoc-dev/sdk or v1 collaboration pages.

Aim: keep this service as the HTTP/WS boundary for justitia-agent and the
Angular sidebar, but replace our JSDOM + homemade ProseMirror editor with
@superdoc/sdk 2.8.0 (Document API). Replicate today’s upload → search/edit →
export (and later live preview) loop, improved by the spine: query/ID
targeting, atomic plans, tracked-by-default, process-isolated engine,
last-good DOCX, typed failures, compact outline, visible bulk-replace sets.

This is a long-running implementation. Start by planning parallel workstreams,
then implement. Spin sub-agents for independent slices (search, replace,
insert, comments, export, memory/hosts, collaboration) once the shared
substrate (hosts + documents + persistence) exists. Get to a testable isolated
mode: upload + query + tracked replace + structural insert + export on
fixtures, without JSDOM on the new write path.

Do not rebuild replace.ts. Do not edit raw OOXML. Do not build a second
ProseMirror adapter. Do not wait for sidebar SuperDoc v2 to start isolated
mode. Do not implement AD-28 or shared v2 rooms in wave 1 unless isolated
mode is already green.
```

---

## 1. What we are aiming at

We are **not** writing a new Word engine. SuperDoc already has one (Document Engine, exposed as the Document API, driven from Node by `@superdoc/sdk`).

We **are** rewriting **this host** so that:

1. An external agent (`justitia-agent`) can still upload a DOCX, inspect it, make tracked edits, and export a Word-native redline.
2. A human sidebar can still attach later and see those edits live.
3. Every mutation goes through SuperDoc’s Document API on an SDK handle — not through JSDOM `Editor`, homemade `trackInsert` / `trackDelete`, or integer `from` / `to`.
4. The host adds the product layer SuperDoc does not ship: sessions, identity, Redis last-good, admission, analytics, the justitia-agent HTTP facade, a compact outline, visible bulk-replace sets, content preconditions, and (later) a consistency index.

**One sentence:** this service becomes a document-engine command host that does the same job as today’s SuperDoc server, but correctly and at a quality the current offset/JSDOM stack cannot reach.

```text
today:  agent HTTP → JSDOM Editor → homemade PM replace/insert → optional Yjs copy → export
target: agent HTTP → documents/ → @superdoc/sdk handle → Document Engine process → last-good DOCX → export
```

The engine loop is fixed:

```text
open → inspect → query → target → mutate → inspect receipt → persist → close
```

---

## 2. Outcome we need

A **testable isolated-mode host** on this repo, then a facade that today’s agent can keep calling, then shared mode when the sidebar is on SuperDoc v2.

### Wave 1 — testable isolated writer (this is the first “done”)

Must be true without JSDOM on the new write path:

| Gate | Proof |
| --- | --- |
| Boot | Node 20, `instrumentation.ts` first, one `PORT`, `SUPERDOC_PUBLIC_LICENSE_KEY` required |
| SDK | `@superdoc/sdk` 2.8.0 + platform binary (`@superdoc/sdk-linux-x64` on Linux). Do not npm-install `@superdoc/cli` to get the engine |
| Chainguard | Measure `@superdoc/sdk-linux-x64` on `node-fips:20` **before** claiming wave 1 ships |
| Upload | `POST /upload` still returns `{ sessionId, fileName, collaborationUrl, user }`; JSON-or-multipart and upload-by-URL stay; `userid` + `username` required (AD-12 break) |
| Persist | Redis meta + last-good DOCX after open and after every successful mutation. Persist failure is 503, not 200 |
| Query | `POST /document/query` via `query.match`; `exactlyOne` for single-clause writes; pending deletions excluded unless asked |
| Structure | `POST /document/structure` compact outline (AD-24); `POST /document/block` full redline + surviving |
| Replace | Canonical `/document/replace` with target/ref + `expectedRevision` + `expectedText`; tracked by default |
| Insert | Structural `before` / `after` (insert-at-top = before first block). Never a character `position` |
| Plans | `mutations.preview` then `mutations.apply` `{ atomic: true }` for multi-edit. Preview does not persist or leak |
| Export | Distinct DOCX bytes; session is **not** deleted; comments/media included; `Content-Disposition` unchanged |
| Recover | Kill the process, reopen the same `sessionId`, export still matches last-good |
| Failures | Typed `code` + `detail`. 404 = session only. 400 = content/target/precondition. 503 + `Retry-After` = admission |
| Torture | insert-above-heading and table-cell edit pass. Track-over-track does not silently mangle another author’s marks |

Existing `npm test` must stay green **or** each failure must be a documented, intentional contract change (for example `/replace { from, to }` now 400).

### Wave 2 — compatibility facade (agent keeps working)

Frozen paths call the SDK, not `editor/replace.ts`:

`/upload` `/search` `/get-content` `/replace` `/replace-all` `/insert-content` `/add-comment` `/get-comments` `/export` `/replace-in-paragraph` `/insert-after-paragraph`

- `/search` stays **case-sensitive**
- `/replace` `{ from, to }` and `/insert-content` `{ position }` **fail closed (400)**
- `/replace-all` returns a **visible match set**, not a bare count (AD-25)
- `/replace-in-paragraph` keeps `expectedContext` and never uses 404 for “paragraph not found”
- Env names stay `SUPEREDITOR_*`
- justitia-agent still retries only 429/503 and treats 404 as expiry

### Wave 3 — shared rooms (blocked on angular-frontend SuperDoc v2)

Hocuspocus **2.15.3** (not 4.x), path `/collaboration`, `documentId` = `sessionId`, keep `?room=` until sidebar envs change. `promoteToShared` is the only room create. SDK shared open is `roomMode: 'join'`. Do not join a v1 room with a v2 editor. Until this ships, isolated mode is the production agent path and v1 rooms stay the human-visible path.

### Wave 4 — delete v1

Remove JSDOM `createHeadlessEditor`, `editor/replace.ts`, `editor/insert.ts`, v1 collaboration. No JSDOM SuperDoc import remains.

### Wave 5 — consistency index (AD-28, after isolated writer is green)

`find-term` / `check-references`. Terms patch on touched blocks. Refs re-resolve **globally** after structural edits. Flag drift; do not auto-fix. Section 6.3 fixture is the exit gate.

---

## 3. What “replicate SuperDoc behavior” means

Replicate **our product behavior**, not SuperDoc v1 internals.

Keep:

- Agent loop: upload → inspect → edit as tracked changes → export Word-native `<w:ins>` / `<w:del>`
- Session id, Redis TTL class (1800s until changed), `GET /health`
- Upload-by-URL, `fileName`, `collaborationUrl` in the 200 body
- Comments anchored to text
- Memory admission as 503 (name `MEMORY_GUARD_RSS_MB` until the CLI budget is measured)
- Analytics: `SuperDoc Document Opened` once after first durable persist; never on rehydrate; no document text in logs
- One Cloud Run port; `node --import tsx`; no tini; no boot-time `lsof | kill`

Improve (this is the point of the redesign):

- Address by query / `paraId` / `NodeAddress`, not shifting character offsets
- Validate before apply (`expectedRevision` + `expectedText` + preview)
- Atomic multi-edit plans
- Typed, actionable errors (stops agent loops)
- Compact structural outline with numbering labels; tables/cells/footnotes visible
- Bulk replace is auditable (matches + exclusions + per-item receipts)
- Engine in an isolated process; recycle on memory/idle; no global `window` in Fastify
- Last-good DOCX is the durable snapshot; export is a distinct artifact
- One write path (no homemade PM → Yjs bridge)

Do **not** replicate: JSDOM per session, `from`/`to` as a targeting model, bare `{ success: false }`, `replace-all` count-only, insert that splits a heading, anonymous upload, export ending the session.

---

## 4. Binding sources (do not improvise past these)

| Priority | Document | Role |
| --- | --- | --- |
| 1 | `ARCHITECTURE-SPINE.md` | Binding ADs. If a later idea conflicts, the spine wins or you open a new architecture question — you do not silently override. |
| 2 | This handoff | Execution plan, parallelization, wave gates |
| 3 | `ARCHITECTURE-REDESIGN.md` | Why, HTTP shapes, cutover, consumers |
| 4 | `reviews/review-old-specs.md` + root LLD files | Phase 3 meaning, torture corpus, Harvey/Nutrient pattern |
| 5 | Current `routes/`, `editor/`, `sessions/`, `collaboration/`, `tests/` | Brownfield contracts and fixtures |
| 6 | https://docs.superdoc.dev/ | **Engine truth.** Query, targets, receipts, `lists.get`, comments, trackChanges, SDK `open` / `roomMode`, safety. Re-fetch when unsure. |

Vendor pages that are **wrong for this host** (spine AD-2 / AD-9):

- Leftover `@superdoc-dev/sdk` install instructions
- `@superdoc/headless` or `@superdoc/document-api-v2-adapter` as a customer surface
- v1 `modules.collaboration`
- Hocuspocus 4.x (needs Node 22; SuperDoc v2 example is 2.15.3)
- SDK `onMissing: 'seedFromDoc'` on reopen of a populated room (blanks the doc). Shared reopen is `roomMode: 'join'`.

Historical specs at repo root (`document_editor_redesign.md`, three `lld-phase-*.md`, …) explain *why*. They proposed a `DocumentEditingPort` + DIY ProseMirror adapter. **That adapter is rejected.** The Document API is the port.

---

## 5. How to work: plan, then parallelize

Do **not** implement search/replace/insert as three unrelated servers. They share `hosts/`, `documents/`, persistence, receipts, and admission.

### Phase A — shared substrate (serial, small team / one agent)

Land this before fan-out. Everything else imports it.

1. Measure `@superdoc/sdk-linux-x64` 2.8.0 on this image (Chainguard `node-fips:20`). If it cannot run, stop and report; do not fake a JSDOM fallback.
2. Add `@superdoc/sdk@2.8.0` and the platform package. Pass `SUPERDOC_PUBLIC_LICENSE_KEY`. `runtime: 'v2'` if the client exposes it.
3. `hosts/` — SDK client lifecycle, worker slots, recycle on RSS/idle, `dispose()` in `finally`.
4. `documents/` — session authority (AD-18), versioned Redis keys (AD-19: `meta`, `last-good`, optional `original`, optional `room`), open / use / receipt / persist / close, one stale retry (AD-13), one admission function (AD-22).
5. `persistence/` — Redis adapter only; no session policy.
6. Isolated `open({ doc: lastGoodPath })` + save distinct export + close discard.
7. A single integration test: upload fixture → query → tracked replace → export → kill → reopen → export matches.

**Owner of shared types:** `documents/` owns `sessionId`, `UserInfo`, `accessMode`, `lastGoodRevision`, receipts, persist. Feature agents do not invent a second session table.

### Phase B — fan-out (parallel sub-agents)

Once Phase A compiles and the reopen test passes, spin **independent** sub-agents. Each owns routes + tests in its slice. None opens JSDOM. None writes last-good except by calling `documents`.

Give each sub-agent: the spine ADs that bind it, the current route file to replace, the SuperDoc doc URL, and the test files to extend.

| Sub-agent | Slice | Current code to replace | SuperDoc reference | Tests / gates |
| --- | --- | --- | --- | --- |
| **Search / query** | `/document/query`, `/document/structure`, `/document/block`, `/document/extract`, `/document/project`; facade `/search`, `/get-content` | `routes/search.route.ts`, `routes/get-content.route.ts`, `editor/content-helpers.ts` | [Query content](https://docs.superdoc.dev/document-api/query-content/), `extract`, `info`, `lists.get`, `projectHtml` | Case-sensitive facade search; deleted text excluded; outline is token-lean; numbering labels present when the engine has them; `find` is not used as a write locator |
| **Replace** | `/document/replace`; facade `/replace`, `/replace-all`, `/replace-in-paragraph` | `routes/replace.route.ts`, `routes/paragraph-edit.route.ts`, `editor/replace.ts`, `editor/paragraph-operations.ts` | `doc.replace`, `query.match` `{ require: exactlyOne \| all }`, receipts, `changeMode: 'tracked'` | `tests/replace-regression.test.ts` through the facade **or** documented miss; `from`/`to` → 400; replace-all is find-set + atomic plan (AD-25); `expectedContext` kept (AD-26); track-over-track |
| **Insert / delete / structure** | `/document/insert`, `/document/delete`; facade `/insert-content`, `/insert-after-paragraph` | `routes/insert.route.ts`, `editor/insert.ts` | `create.paragraph`, structural `at: { kind: 'before' \| 'after' }`, list item numbering | insert-above-heading; insert-after-`paraId`; `position` → 400; agent does not type `4.2(a)` prefixes |
| **Plans / preview** | `/document/mutations/preview`, `/document/mutations/apply` | new | `mutations.preview`, `mutations.apply` `{ atomic: true }` | Preview does not persist or change revision (AD-27); failed plan applies nothing |
| **Comments** | `/document/comments`; facade `/add-comment`, `/get-comments` | `routes/comment.route.ts` | `comments.create` / `list` / `patch` | Existing comment payloads or an explicit mapping table |
| **Track changes / review** | `/document/track-changes`; existing accept/reject HTTP may stay for humans | `routes/track-changes.route.ts` | `trackChanges.list` / `get` / `decide` | Agent tools do **not** expose accept/reject. `tests/track-changes.test.ts`, `track-changes-route.test.ts` |
| **Export / upload persist** | `/export` behavior on the new persist path; field refresh spike | `routes/export.route.ts`, `routes/upload.route.ts`, `utils/docx-cleanup.ts` | SDK save/export; `force` off except known artifacts | `tests/export-route.test.ts`; export does not delete session; AD-10 field-refresh question answered with a measurement |
| **Memory / hosts** | Worker pool, recycle, admission on upload/plan/export/reopen | `infra/memory-guard.ts`, `editor/editor.factory.ts` | SDK process model | `tests/memory-guard.test.ts`; 503 + `Retry-After`; no global JSDOM; RSS vs `MEMORY_GUARD_RSS_MB` until measured |
| **Collaboration (wave 3 only)** | Hocuspocus 2.x adapter, `promoteToShared`, `/collaboration` + `?room=` | `collaboration/websocket.ts` | SuperDoc v2 collaboration, `roomMode` create vs join | Do not start until isolated writer is green **and** you know sidebar v2 status. Never attach SDK to a v1 room |
| **Analytics / boot** | Redacted logs, Amplitude once after first persist, shutdown flush | `services/analytics/`, `instrumentation.ts`, `infra/shutdown.ts` | — | `tests/upload-analytics.test.ts`, `rehydration-analytics.test.ts`, `shutdown-analytics.test.ts`, `config-env.test.ts` |

**Integrator (parent agent):** merge slices, keep one persist path, run `nvm use && npm test`, add the torture fixtures, update `routes/AGENTS.md` and child AGENTS when contracts change.

### Phase C — harden to “we would put traffic on this”

- Reopen-after-kill on a real contract fixture
- Memory profile vs today’s JSDOM path (`tests/upload-edit-export-memory-profile.ts` as a starting harness)
- Facade dual-run: old agent payloads that still must work vs payloads that must 400
- Document every intentional break for justitia-agent (anonymous upload, `from`/`to`, replace-all body)

---

## 6. Parallelism rules (so sub-agents do not collide)

- **One writer stack.** If a slice needs a document change, it calls `documents`. It does not `editor.dispatch`.
- **One persist function.** Last-good is AD-10. Feature code never writes Redis document bytes.
- **One admission function.** Upload, open, heavy plan, export, promote, websocket join.
- **Shared types first.** Targets, refs, receipts, `expectedRevision`, `expectedText`, failure codes — copy SuperDoc names.
- **Facade last in the slice, canonical first.** Implement `/document/replace` then map `/replace-in-paragraph`. Do not keep offset math alive “for the facade.”
- **Tests per slice.** Do not wait for a mega-PR. Each sub-agent leaves a failing-then-passing test on its route.
- **No drive-by justitia-agent or angular-frontend edits** unless the human explicitly opens those repos. Record required consumer changes in the PR.

Suggested parent schedule:

```text
[A] hosts + documents + persist + reopen test
        |-- [B] query/structure/search
        |-- [B] replace + replace-all + paragraph facade
        |-- [B] insert/delete
        |-- [B] preview/apply
        |-- [B] comments
        |-- [B] track-changes (list only for agent)
        |-- [B] export + field-refresh spike
        |-- [B] memory/admission
        `-- [C] integrate + npm test + torture
[D] facade cutover (wave 2)
[E] collaboration (wave 3, gated)
[F] delete v1 (wave 4)
[G] AD-28 index (wave 5)
```

---

## 7. Current host map (what you are replacing)

| Area | Today | Target |
| --- | --- | --- |
| Editor | JSDOM + `@harbour-enterprises/superdoc` 1.46.x `isHeadless` | `@superdoc/sdk` handle; engine in a child process |
| Replace/insert | `editor/replace.ts`, `editor/insert.ts`, PM `from`/`to` | Document API `replace` / `create.paragraph` |
| Search | Flattened text, case-sensitive, skip `trackDelete` | `query.match`; facade keeps case-sensitive |
| Session | In-memory `{ editor, jsdom }` + Redis YDoc/buffer | Redis meta + last-good; handle is a cache |
| Collab | `@superdoc-dev/superdoc-yjs-collaboration` v1; WS join requires in-memory session | Isolated: no room. Shared (later): Hocuspocus 2.x, join from persisted session |
| Export | `editor.exportDocx` then drop memory maps | Engine save to a **new** path; session stays |
| Memory | RSS guard over a fat heap | Worker slots + recycle; same 503 contract |

Read `AGENTS.md` (root) and each child `AGENTS.md` before touching that tree.

---

## 8. Frozen HTTP / agent contract (wave 2 must not break these meanings)

From `routes/AGENTS.md` and spine AD-11 / AD-17:

- 404 → session missing/expired. **Never** for “paragraph not found.”
- 400 → bad input, no match, ambiguous, stale context, missing user
- 503 → admission / persist / worker; include `Retry-After`
- 429 → overload/rate-limit only
- `POST /upload` JSON `{ sessionId, user, url }` **or** multipart; response `{ sessionId, fileName, collaborationUrl, user }`
- `POST /replace-in-paragraph` body `{ sessionId, paraId, oldText, newText, expectedContext? }`
- `POST /insert-after-paragraph` body `{ sessionId, afterParaId, content, ... }`
- `POST /export` binary DOCX + `Content-Disposition: attachment; filename="{fileName}"`
- justitia-agent env: `SUPEREDITOR_*`

Intentional breaks to announce in the PR:

1. Upload without a real user → 400 (today defaults to anonymous).
2. `/replace` with `from`/`to` → 400.
3. `/insert-content` with `position` → 400 (anchor/`afterParaId` still works).
4. `/replace-all` response is no longer count-only.

---

## 9. Torture corpus (fidelity, not optional)

Use fixtures under `tests/data/`. Add fixtures if missing; do not “pass” by weakening the case.

1. **Insert above heading** — first block is Heading 1; insert before it; heading text and style intact.
2. **Table cell** — replace text inside a cell; table structure intact.
3. **Nested clause renumber** — insert a list item; engine numbering label updates; agent did not type the number.
4. **Defined-term ripple** — change a defined term; wave 1 can do find-set; wave 5 uses `find-term`.
5. **Track-over-track** — edit overlapping another author’s tracked change; expect `WOULD_DAMAGE_TRACKED_CHANGE` or a SuperDoc equivalent, not silent clobber.
6. **Section 6.3 drift** (wave 5) — insert above a referenced clause; `check-references` reports the drifted hardcoded “Section 6.3”. See `lld-phase-3-consistency-ripple.md` §2.3.

---

## 10. Hard “do not”

- Do not rebuild a better `replace.ts` or keep JSDOM as a fallback editor.
- Do not invent `SuperdocLocalAdapter` / in-process `prosemirror-transform`.
- Do not unzip the DOCX and string-replace XML.
- Do not put `sdBlockId` or host-minted cell IDs on the wire.
- Do not log document text, full mutation payloads, or complete receipts.
- Do not embed `createAgentToolkit` / MCP / `superdoc_execute_code` in this host.
- Do not call Python `superdoc-sdk` from justitia-agent as a bypass.
- Do not auto-accept agent tracked changes.
- Do not auto-fix reference drift.
- Do not create v2 rooms or return a v2 `collaborationUrl` until shared mode + sidebar v2 ship together.
- Do not reintroduce boot-time process kill or a second public port.
- Do not treat `package.json` `engines: >=18` as the runtime. `.nvmrc` is 20.

---

## 11. Open questions the implementer must measure (not re-decide)

Already on the spine; answer with data:

1. SDK/engine RSS on representative SpotDraft contracts vs 8 GiB / `MEMORY_GUARD_RSS_MB` 7680.
2. Does `@superdoc/sdk-linux-x64` 2.8.0 run on Chainguard `node-fips:20`?
3. Does SDK 2.8.0 still consume `SUPERDOC_PUBLIC_LICENSE_KEY`? Keep the key until proven unused.
4. Does export refresh `REF` / number fields or only emit them dirty?
5. Does `extract` / `info` include computed numbering labels, or must the host call `lists.get` per item?
6. Sidebar SuperDoc v2 date (gates wave 3 only).

---

## 12. Suggested first-day plan for the new chat

1. Read this file + the spine. List ADs you will implement in wave 1 vs defer.
2. Confirm Node 20 (`nvm use`). Inspect `@superdoc/sdk` 2.8.0 types/docs (live).
3. Spike: open a fixture DOCX with the SDK, `query.match`, tracked `replace`, save to a temp file, close. No Fastify yet. Record RSS.
4. If the spike works, implement `hosts/` + `documents/` + persist + one Fastify `/document/*` path.
5. Write the reopen integration test. Then spawn the Phase B sub-agents with the table in §5.
6. Integrate, run `npm test`, add torture cases 1–3 and 5.
7. Only then start the facade mappings.

If the SDK spike fails on this image, **stop and report**. Push SuperDoc (partnership / engineers). Do not start a DIY engine.

---

## 13. PR / branch hygiene for the implementation chat

- Architecture already lives on `cursor/document-editor-architecture-redesign-011f` (PR #123). Implementation should be a **new branch** off `master` (or off this branch if the human says to stack), named `cursor/<descriptive-name>-011f` if still in this cloud-agent setup.
- Update the nearest `AGENTS.md` when you change a subtree contract.
- Keep commits small enough that a failed slice can revert without taking down persist.

---

## 14. Success picture (what “best outcome” looks like)

An agent uploads a 100-page contract, reads a compact outline with real clause numbers, targets “the Term shall be one (1) year” by query + `paraId` + `expectedText`, previews a tracked replace, applies it atomically with a related insert **before** the top heading, gets typed errors instead of a retry loop when a match is ambiguous, exports a Word-native redline, and can repeat after a Cloud Run kill because last-good DOCX is in Redis — without a JSDOM sitting in the Fastify heap for the whole session.

That is the product. The spine is how we refuse to miss it.
