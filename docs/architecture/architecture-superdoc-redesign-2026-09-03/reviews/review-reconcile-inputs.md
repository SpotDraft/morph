# Reconcile Inputs Review

**Workflow:** BMAD reconcile-inputs  
**Spine:** `docs/architecture/architecture-superdoc-redesign-2026-09-03/ARCHITECTURE-SPINE.md`  
**Companion:** `ARCHITECTURE-REDESIGN.md`, `.memlog.md`  
**Date:** 2026-09-03  
**Altitude:** initiative (document-engine command host)  
**Spine edited:** no

---

## Verdict

**PASS WITH GAPS.**

The spine lands the redesign paradigm and the loud decisions: Document API as the only writer, `@superdoc/sdk` as the only Node surface, query/ID targeting, atomic plans, tracked-by-default, handle lifecycle, CLI process boundary, isolated vs shared, v2 rooms, last-good DOCX, this host as the agent HTTP boundary, attributed authors, receipt + one stale retry, redacted telemetry, one Cloud Run port / no boot kill, temporary compat then delete, and frozen 404 / 400 / 503 meanings.

What did not land are inherited **consumer and SuperDoc-safety constraints** that never became an AD (or were collapsed into an AD that sounds like it covers them). A builder who implements only the spine can still wipe a live room, break the sidebar socket URL, change agent search semantics, or treat a 429 as a new status.

The quietest load-bearing miss is called out first.

---

## Method

Checked each load-bearing input against every spine section (ADs, Consistency Conventions, Stack, Structural Seed, Deferred, Open Questions, Operational Envelope). An input **lands** only if a later implementer could recover the rule from the spine without the companion, memlog, or brownfield `AGENTS.md`. Paraphrase that drops the failure mode does not count as landed.

Sources read for this review:

| Input | Read |
| --- | --- |
| 1. Brownfield host | Root / `routes/` / `editor/` / `collaboration/` / `config/` / `infra/` / `sessions/` / `services/` `AGENTS.md`; `config/env.ts`; `server.ts`; `app.ts`; `Dockerfile`; upload / search / paragraph-edit / export / health / websocket / memory-guard / session middleware |
| 2. SuperDoc 2026 | Companion §§4–6; SuperDoc docs fetched 2026-09-03 (`query-content`, `agents/operate/safety`, `document-engine/sdks`, `editor/collaboration`) |
| 3. justitia-agent HTTP | Companion §6.3 / §7.1; `routes/AGENTS.md`; `infra/AGENTS.md`; `config/AGENTS.md` |
| 4. angular-frontend URL coupling | `collaboration/AGENTS.md`; upload `collaborationUrl`; companion §5.6 / §7.2; spine Operational Envelope |
| 5. Cloud Run / Node 20 / no boot kill | `AGENTS.md` container entrypoint; `Dockerfile`; `config/env.ts`; AD-15 |
| 6. Old spec phases | Companion §3 reconstruction (source files were not in-repo); AD-3 / AD-7 / AD-8 |

`.memlog.md` was used as a constraint ledger: every `(constraint)` line was scored against the spine.

---

## Featured miss — quiet requirement the AD structure dropped

**SDK reopen must set `onMissing: 'error'`. The SDK default is `seedFromDoc`, which seeds a blank document if the room looks empty during sync and overwrites the live collaborative DOCX.**

Companion §4.4 and SuperDoc's SDK docs state this as a hard reopen rule. SuperDoc's default:

> If you reopen an existing ydoc without providing a `doc` file, the default `seedFromDoc` will seed a blank document if the room appears empty during sync. This overwrites your existing content.

AD-9 absorbed two different SuperDoc mechanisms into one sentence:

> Creating an existing room or joining a missing room is an explicit failure.

That sentence is the **browser** `roomMode: 'create' | 'join'` contract (v2 has no join-or-create). It is not the **Node SDK** `client.open` contract. The SDK does not use `roomMode`. It uses `onMissing: 'seedFromDoc' | 'blank' | 'error'`, and the dangerous default is the one a builder will get if they follow the spine diagram (`client.open({ collaboration, doc })`) and never open the SuperDoc SDK page.

A host that:

1. implements explicit room-server create vs join (AD-9 as written), and
2. reopens a shared-mode handle with `{ doc: lastGoodDocx, collaboration }` without `onMissing: 'error'`

still has a blank-the-room path on a slow or empty-looking sync. That is Phase 3 consistency ripple (one write path) failing as silent data loss, not as an HTTP error.

The AD format caused the drop: create-vs-join was the *decision*, default-blank-on-reopen was the *inherited SuperDoc safety constraint*, and only the decision was written down. Conventions mention "Room create and room join are separate operations" and still never name `onMissing`.

**Spine recovery:** add an AD-9 / AD-8 / AD-10 sentence that names `onMissing: 'error'` on every reopen of a previously populated room, and forbids relying on the SDK `seedFromDoc` default after first seed.

---

## Input scorecard

| # | Input | Lands in spine? | Notes |
| --- | --- | --- | --- |
| 1 | Brownfield contracts | Partial | Paradigm and cutover intent land. Wire shapes, search semantics, license, analytics-after-persist, cold WS join do not. |
| 2 | SuperDoc Document API / SDK / safety / v2 collab | Partial | Loop, SDK-only, tracked default, receipts, no-log-text, v2 rooms land. Query cardinality, deleted-text default, `find`≠write, `onMissing` default, changeMode-ignoring ops, `save` `force` off do not. |
| 3 | justitia-agent HTTP (404 / 400 / 503 / `SUPEREDITOR_*`) | Partial | 404 / 400 / 503 land in AD-17. 429 retry, env names, upload-by-URL, `fileName`, and the frozen endpoint list do not. |
| 4 | angular-frontend `/collaboration` base-path coupling | **No** | Envelope says URLs “must move to v2 rooms.” Path shape, `?room=` query, and env lockstep are absent. |
| 5 | Cloud Run one port, Node 20, no boot-time kill | Yes (core) | AD-15 + Stack + Operational Envelope. Instrumentation-before-boot and `SUPERDOC_PUBLIC_LICENSE_KEY` still missing. |
| 6 | Old phases (structural / memory / consistency) | Yes (problems) | AD-3 / AD-7 / AD-8. Implementation plan correctly replaced. Cutover coexistence of v1 rooms is the leftover gap. |

---

## What landed (so the gaps are the remainder)

These inputs are recoverable from the spine alone:

- Document API is the only mutation authority; no second editor, coordinate system, or write path (AD-1, AD-16).
- Official Node surface is `@superdoc/sdk`; no JSDOM `Editor`, `@superdoc/headless`, `@superdoc/document-api-v2-adapter`, homemade `trackInsert` / `trackDelete` (AD-2).
- Targeting is `query.match` / `extract` / `NodeAddress` (`paraId`); `from` / `to` is not the long-term model; `expectedRevision` stays on targets (AD-3, conventions).
- `sdBlockId` is not a cross-open key (conventions).
- Multi-edit is `mutations.preview` + `mutations.apply` `{ atomic: true }` (AD-4).
- Host default `changeMode` is `tracked`; agent accept/reject off by default (AD-5, conventions, deferred).
- Session = handle lifecycle; warm handle is a cache; recover from last-good DOCX or live v2 room, never leftover JSDOM (AD-6).
- Engine behind the SDK/CLI process; Fastify does not host JSDOM SuperDoc; admission still 503s (AD-7).
- Isolated DOCX vs shared v2 room; no host-owned PM→Yjs converter (AD-8).
- New rooms are SuperDoc v2; shared mode gated on sidebar v2; mix of v1 rooms + v2 editor forbidden (AD-9).
- Last-good DOCX is durable; export is a distinct artifact; close/discard working copy after distinct output (AD-10).
- justitia-agent keeps calling **this** host; old position routes are a facade only (AD-11).
- Missing user is 400; no SuperDoc default `CLI` author (AD-12).
- Inspect `receipt.success`; stale-revision family re-query + retry once; never drop `expectedRevision`; `NO_OP` / capability failures do not retry unchanged (AD-13).
- No document text / full payloads / complete receipts in logs; Amplitude + OTEL stay under the same redaction (AD-14).
- One public `PORT`; collaboration shares it; no boot-time host-process cleanup (AD-15, Operational Envelope, container warning in root `AGENTS.md` echoed).
- Node 20, Chainguard `node-fips:20`, Fastify 5.8.5, `@superdoc/sdk` 2.8.0, `@superdoc/cli` 0.31.0, browser `superdoc` 2.11.0, `@hocuspocus/server` 4.6.0 (Stack).
- Health stays `GET /health`; admission stays 503; worker failure leaves last-good DOCX (Operational Envelope).
- Deferred correctly: Liveblocks, in-host MCP / `createAgentToolkit`, Python SDK bypass, template-first default, productized history, agent accept/reject.
- Open questions correctly: CLI RSS vs 8 GiB, sidebar v2 date, facade fail-closed vs source-map.

The three reconstructed old-spec **problems** landed as those ADs. The spine correctly refuses to revive the old LLD as the implementation plan.

---

## What did not land

Grouped by input. Each item is something a spine-only implementer can get wrong.

### 1. Brownfield host contracts

| Miss | Why it is load-bearing | Closest spine text |
| --- | --- | --- |
| `SUPERDOC_PUBLIC_LICENSE_KEY` is required at process start today; memlog says keep a SuperDoc license identity on the new host | `config/env.ts` uses `requireNonEmptyEnv`; `editor.factory.ts` passes it into SuperDoc; `tests/config-env.test.ts` locks boot failure without it. A new SDK host that drops the key either fails current deploys or silently loses attribution. | **Absent.** Not in ADs, Stack, or Operational Envelope. Logged in `.memlog.md` then dropped when constraints were compacted into AD-1–17. |
| `instrumentation.ts` must load before Fastify so HTTP/Fastify patches apply | Root `AGENTS.md` watchpoint; `server.ts` imports it first; memlog constraint. Structural Seed lists the file as “existing boot” but does not bind import order. | File name only in Structural Seed. |
| Upload wire: JSON `{ sessionId, user?, url }` **and** multipart; response `{ sessionId, fileName, collaborationUrl, user }` | justitia-agent `upload_document_tool.py` expects URL upload plus `sessionId` and `fileName`. Tests lock `collaborationUrl`. Companion §6.1 says keep those fields; the spine never freezes them. | AD-11 says “new routes expose Document API shapes.” |
| Upload analytics emit only after `save` + `saveMeta` + `saveBuffer` succeed; rehydration must not emit `SuperDoc Document Opened`; Amplitude no-ops when `AMPLITUDE_API_KEY` is empty; shutdown flush must not init a quiet client | Durable-upload contract spans upload route, analytics service, editor factory, shutdown, `config/env.ts`. AD-14 keeps Amplitude under redaction only. | AD-14. |
| `/search` is **case-sensitive**, HTML/NBSP/newline-normalized, and excludes `trackDelete` text | `routes/AGENTS.md`, `utils/regex.ts` (`g` only, not `i`), `search.route.ts` `includeDeletedText: false`. Companion maps `/search` → `query.match` `require: 'any'`. SuperDoc `query.match` default text selector is **case-insensitive**. Facade-as-written changes agent match sets. | AD-3 names `query.match`, not case or delete-exclusion. |
| Paragraph tools: missing `paraId` / text / context-guard / not-found / ambiguous → **400 never 404**; success payload includes `paraId`, `replacedText`, `updatedRange`, `matchCount` | justitia-agent expiry vs content-error split. AD-17 covers status class, not the success fields the agent already parses. | AD-17. |
| Export is a **binary** DOCX with `Content-Type` + `Content-Disposition: attachment; filename="{fileName}"`, comments/media included | Companion §6.1: “binary response unchanged.” AD-10 talks about a distinct artifact, not the HTTP body. | AD-10. |
| Memory-guard 503 includes `Retry-After` **and** `X-Memory-*` / `{ error, memory }` body; threshold is RSS vs `MEMORY_GUARD_RSS_MB` (default 7680), not `heapTotal` | Agent retries 503; infra tests lock headers. Open question mentions 8 GiB but not the current RSS rule or header contract. | AD-7 / AD-17 mention 503 + `Retry-After` only. |
| Websocket **pre-auth** in `collaboration/websocket.ts` requires an **in-memory** `sessions` entry and closes `1008` before `handleAuth` can rehydrate | Companion §2: “Redis-only sessions cannot join.” REST `withSession()` rehydrates; the socket path does not. Shared-mode / sidebar join of a cold session stays broken unless the spine binds “join succeeds from last-good DOCX / room persistence.” | AD-6 talks about host reopen, not browser join of a cold session. |
| Existing HTTP accept/reject routes (`/accept-track-changes-by-id`, `/accept-all-track-changes`, …) | AD-5 / deferred turn **agent** accept/reject off. Spine is silent on whether the current sidebar/internal HTTP review surface stays. | AD-5 “not from the agent by default.” |
| DOCX size / fetch timeout / YDoc size caps (`MAX_FILE_SIZE` 50MB, `FETCH_TIMEOUT` 30s) | URL-upload safety. Not an AD; not in Operational Envelope. | Absent. |
| Redis session TTL (`SUPERDOC_REDIS_SESSION_TTL_SECONDS` / `SESSION_TIMEOUT`, default 1800s) and Tribunal CI wait-on-`/health` | Agent expiry (404) is TTL-shaped. Spine freezes 404 meaning, not the TTL or CI boot contract. | AD-17. |

### 2. SuperDoc 2026 Document API / SDK / safety / v2 collaboration

Companion §4.1 lists rules “SuperDoc already enforces and this host must not weaken.” The spine kept revision + receipt + `sdBlockId`. It dropped the rest of that list.

| Miss | SuperDoc rule | Why the spine is not enough |
| --- | --- | --- |
| **`onMissing: 'error'` on reopen** (featured) | SDK default `seedFromDoc` blanks a room that looks empty during sync | AD-9 = browser `roomMode`, not SDK `onMissing`. See featured miss. |
| **`require: 'exactlyOne'`** is the safe default when one clause must change | `query.match` cardinality: `any` / `first` / `exactlyOne` / `all`. Prefer `exactlyOne` before a single mutation; `all` only when every hit is intended | AD-3 says “locate with `query.match`” and never binds cardinality. A `/document/query` that defaults to `any` or `first` lets a one-clause replace hit the wrong match. Companion §6.2 even uses `require: 'any'` for `/search` (discovery) without restating that **writes** must not inherit that default. |
| **Pending tracked deletions are excluded** from text queries unless `includeDeletedText: true` | SuperDoc query-content guide; current `/search` already excludes `trackDelete` | AD-3 / AD-5 never say the host must not re-include deleted text in mutation-grade search. A `projectHtml` / `find` facade that walks redline text will retarget accepted-side or deleted-side clauses. |
| **`doc.find` is not mutation-grade** | Companion §4.3; SuperDoc common workflows: use `query.match`, not `find`, for writes | AD-3 lists `query.match`, `extract`, `NodeAddress`. It does not forbid `find` as a write locator. |
| **`query.match` default match is case-insensitive** | SuperDoc query-content guide | Conflicts with brownfield case-sensitive `/search`. Neither spine nor companion binds a case mode on the facade or on `/document/query`. |
| **Operations that ignore `changeMode`** (`apply_style`, `set_paragraph_spacing`, `insert_page_break` always direct; `move_range` accepts then fails) | SuperDoc agent safety: an allowlist of tracked-capable actions is the only reliable guard | AD-5 sets host default `tracked` and limits direct mode. It does not say: do not advertise changeMode-ignoring ops as tracked; refuse or classify them as mechanical/direct. A Document API route that blindly forwards `changeMode: 'tracked'` can still silent-direct-edit. |
| **`save` refuses an existing path unless `force`** | Safety: leave `force` off so a typo cannot overwrite the source; export is a new artifact | AD-10 says “distinct output” and “do not overwrite the only copy” in spirit, but never names `force` or “model-/path-assembled output must not resolve to the source.” |
| **`partial` receipt is failure; a `failed` receipt can still have mutated; compare before/after revision before retry** | Safety page (toolkit receipts). Document API uses `receipt.success`, which AD-13 inspects | If the host later exposes toolkit-shaped receipts or plan step `partial`, AD-13’s “inspect `success` + retry stale once” is not enough and can double-apply. Spine should at least say: do not persist or retry until before/after revision is compared. |
| **Encrypted / password-protected DOCX fails at `open`** | Safety: handle explicitly, do not surface as a mid-run crash | No AD. Closest is AD-17 400 vs 503, which does not mention open-time file errors. |
| **`client.dispose()` in `finally` as well as `doc.close({ discard })`** | Safety close-sessions snippet | AD-6 says close the handle. Stack/seed never mention disposing the SDK client / CLI process on every path. |
| **Do not dispatch unadvertised toolkit names** (`superdoc_execute_code`, `agent_*`) | Safety; companion §4.5 | Correctly deferred by “do not embed the toolkit,” but there is no residual “if anyone adds a dispatcher, allowlist advertised names.” Easy to reintroduce later. |

Hocuspocus vs y-websocket is an open question in the companion (§10.4) and is **not** an open question in the spine. The spine Stack **pins** `@hocuspocus/server` 4.6.0 while AD-9 still says “Hocuspocus or y-websocket.” That is an unresolved fork, not a landed choice, and it collides with input 4 (the running sidebar is y-websocket-shaped).

### 3. justitia-agent HTTP contract

Landed: 404 = unknown/expired session; 400 = validation / missing target / ambiguous / context-guard; 503 + `Retry-After` = admission; do not use 404 for paragraph-not-found (AD-17). Agent stays on this host (AD-11).

Did not land:

| Miss | Evidence |
| --- | --- |
| **429 is retryable**, same class as 503. Agent `api_helper.py` and `test_superdoc_api_helper.py` retry **only** 429/503, not generic 5xx. Companion §6.3 reserves 429 for rate limits. Memlog listed 429 in the frozen contract. AD-17 dropped it. | A new 429 (or a 502/500 used as overload) either becomes an accidental retry signal or a non-retry that the agent already expects. |
| **`SUPEREDITOR_*` env names stay.** Agent and Tribunal CI still call this service `SUPEREDITOR` / `SUPEREDITOR_BASE_URL` (CI also uses `SUPERDOC_PORT` / `SUPERDOC_HEALTH_URL`). AD-11 says “keeps calling this host,” not “keep the env names.” | Rename-the-service cleanups will break justitia-agent and CI without a frontend/agent PR. |
| **Frozen current path list** for the facade window: `/upload`, `/search`, `/get-content`, `/replace`, `/replace-all`, `/insert-content`, `/add-comment`, `/get-comments`, `/export`, plus `/replace-in-paragraph` and `/insert-after-paragraph`. | AD-11 / Structural Seed say “compat/” exists. They do not list the paths the agent already imports. Dropping or renaming one during steps 1–3 is a cross-repo break. |
| **Upload-by-URL + `fileName` in the JSON response.** | See brownfield upload wire. |
| **Optional `user` on upload today** (anonymous default in `extractUploadContext`). AD-12 makes missing user a **400**. | This is a silent **tightening**, not a drop. Spine never flags the break. justitia-agent can omit `user` today and still upload. After cutover, the same payload 400s. |

### 4. angular-frontend sidebar collaboration URL coupling

This input is **not** in the spine as a contract.

Brownfield facts:

- Regional `superdocSocketUrls` in `angular-frontend/apps/sidebar-ai` **already end in `/collaboration`**.
- `docx-viewer.component.ts` passes that string as SuperDoc `modules.collaboration.url` — a **base path**, not `/collaboration/:documentId`.
- This host therefore serves `GET /collaboration?room=<sessionId>` (and `documentId`) as the y-websocket compatibility path, in addition to `GET /collaboration/:documentId`.
- Upload’s `collaborationUrl` is the **other** shape: `wss://host/collaboration/{sessionId}`.
- Watchpoint: keep the query flow unless frontend **and** deployed env configs change in lockstep.
- v1 rooms are a different document format; a v2 editor must not join them (this part **did** land in AD-9).

Spine Operational Envelope:

> sidebar `superdocSocketUrls` must move to v2 rooms in the same rollout as shared mode.

That binds **timing**, not **URL shape**. AD-9 binds **format** (v2 only), not path. AD-15 binds **port**, not path.

A Hocuspocus server on `/` or `/collaboration/:documentId` only, or a dropped `?room=` handler, breaks every regional sidebar even if shared-mode “moved to v2.” Companion open question §10.4 (keep y-websocket if it reduces frontend churn) also did not transfer to the spine Open Questions.

### 5. Cloud Run single port, Node 20, no boot-time process kill

Landed in AD-15, Stack, Operational Envelope:

- One public listener on `PORT`; REST + WS share it (`COLLAB_PORT === REST_PORT` today).
- Node 20; Chainguard `node-fips:20`.
- Do not reintroduce startup process killing (`lsof | kill` / `kill -9 0` class).

Did not land (boot/runtime envelope, still load-bearing):

| Miss | Why |
| --- | --- |
| `instrumentation.ts` before Fastify | See brownfield. |
| `SUPERDOC_PUBLIC_LICENSE_KEY` required | See brownfield. |
| Container entrypoint is `node --import tsx server.ts`, not `tsx` CLI; no tini; node is PID 1; no SIGTERM/SIGINT handler | Root `AGENTS.md` + `Dockerfile`. Easy to “clean up” into a boot crash or a double process. Spine says “existing boot; one PORT” only. |
| `NODE_OPTIONS=--max-old-space-size=7680 --expose-gc` on the 8 GiB box | Dockerfile. AD-7 / open question mention 8 GiB and RSS admission, not the heap cap or `--expose-gc`. |
| `package.json` `engines` is `>=18` while `.nvmrc` / Dockerfile / spine say 20 | Spine Stack pins 20; it does not say the npm `engines` field is stale and must not become the authority. |

### 6. Reconstructed old spec phases

| Phase | Problem (reconstructed) | Spine landing | Residual gap |
| --- | --- | --- | --- |
| 1 Structural editing | Stop flat-string / integer offsets; target blocks | AD-3 + conventions (`paraId` / `NodeAddress`) | Cardinality + deleted-text + case + `find` (above). Facade still allowed to emit a deprecated range field (companion only). |
| 2 Runtime memory | Editor out of the request process; 8 GiB does not fit many JSDOM sessions | AD-7 CLI process boundary; admission 503 | No bind that admission applies to upload, heavy plans, export, **and re-open** (companion §5.5). No bind that close is `finally` / best-effort so a failed edit cannot leak a worker (companion + SuperDoc safety). Measured CLI RSS remains an open question — correct. |
| 3 Consistency ripple | One write path; no host PM→Yjs bridge | AD-8 / AD-9 / AD-10 | `onMissing` default-blank (featured). Cold websocket join. **v1 room coexistence** during isolated-mode production (below). |

**v1 coexistence (phase 3 × input 4):** companion §5.2 says isolated mode is the production agent path until sidebar v2, and the v1 collaboration stack stays as a **temporary reader** for the old editor. AD-9’s title and rule are “Collaboration rooms are SuperDoc v2 **only**.” AD-16 deletes v1 collaboration once Document API + chosen access mode are the only writers. A spine-only reading can retire v1 rooms in step 1 and strand the current sidebar. The cutover table that sequences this lives only in the companion (§8). The spine has no equivalent gate: “v1 rooms remain the human-visible path until shared mode ships.”

---

## Silent tightenings (landed, but they break today’s callers)

These are in the spine and conflict with brownfield unless called out as a coordinated break:

1. **AD-12 — missing user is 400.** Today upload defaults `userid: "anonymous"` / `Anonymous User`. justitia-agent and some sidebar flows can omit `user`.
2. **AD-3 + companion facade — `/replace` `{ from, to }` and `/insert-content` `{ position }` fail closed (recommended).** Open question in the spine; agent still emits those payloads. Fine as an open question; not fine if a builder treats AD-3 as “delete offset routes in the first PR.”
3. **AD-9 “v2 only” vs current v1 sidebar** — see coexistence above.
4. **`query.match` case-insensitivity** if `/search` is mapped without a case flag — a silent behavior change, not a declared deprecation.

---

## Memlog constraint ledger

| Memlog `(constraint)` | Spine? |
| --- | --- |
| Cloud Run one port; no second listen; no boot-time host-process cleanup | AD-15 ✓ |
| 404 expiry; retry 429/503; paragraph content failures never 404 | AD-17 (429 dropped) |
| Service still named SUPEREDITOR; frozen current endpoint list | AD-11 (names + list dropped) |
| `superdocSocketUrls` end in `/collaboration`; v1≠v2 room format | Format ✓ (AD-9). Path **dropped**. |
| Node 20, Chainguard `node-fips:20`, `instrumentation.ts` first | Runtime ✓. Instrumentation **dropped**. |
| `SUPERDOC_PUBLIC_LICENSE_KEY` required; keep a license identity | **Dropped.** |
| Do not import `@superdoc/headless` / `document-api-v2-adapter` | AD-2 ✓ |
| Tracked consequential edits; separate output; close every path; explicit user; receipts; no document text in logs; one stale retry | Split across AD-5/6/10/12/13/14. Query-safety + `onMissing` + `force` + changeMode allowlist still out. |

---

## Recommendations (review only — spine was not edited)

If the spine is revised later, the minimum bind set is:

1. **AD-8/9/10:** Reopen of a previously populated room uses SDK `onMissing: 'error'`. Never rely on `seedFromDoc` after first seed. First seed is explicit `roomMode: 'create'` / `onMissing: 'seedFromDoc'` once.
2. **AD-9 / Operational Envelope:** Keep `/collaboration` as the public websocket **base path** and the y-websocket `?room=` (or equivalent v2 `serverUrl` + `documentId`) until angular-frontend env configs change in the same rollout. Pin Hocuspocus vs y-websocket as one open question, not a silent Stack pin.
3. **AD-3:** Mutation-grade query defaults to `require: 'exactlyOne'` (or `all` for replace-all). Pending tracked deletions stay excluded unless asked. `find` is not a write locator. Facade `/search` must declare case-sensitivity vs SuperDoc’s case-insensitive default.
4. **AD-17:** 429 remains a retryable overload/rate-limit signal. Do not invent other 5xx as “please retry.”
5. **AD-11 / Operational Envelope:** `SUPEREDITOR_*` env names, upload-by-URL, and `{ sessionId, fileName, collaborationUrl }` stay through the facade window. List the frozen current paths.
6. **AD-9 / cutover:** Isolated + v1 reader remain until sidebar SuperDoc v2; “v2 only” applies to **new** rooms / shared mode, not to deleting v1 in step 1.
7. **AD-12:** Call out the break: upload `user` becomes required.
8. **AD-13:** Do not persist or retry until receipt success **and** before/after revision are inspected; `partial` is failure.
9. **AD-5:** Allowlist operations that actually honor `changeMode`.
10. **Operational Envelope:** `SUPERDOC_PUBLIC_LICENSE_KEY`; `instrumentation.ts` first; `node --import tsx`; no tini / no boot kill (already); RSS admission on upload/plan/export/reopen; websocket join of a persisted-but-cold session must succeed.

---

## Reviewer conclusion

The spine is a sound initiative contract for **what kind of host this becomes**. It is not yet a complete consistency contract for **what today’s two consumers and SuperDoc’s defaults will do if a builder follows only the ADs**.

The AD compaction is the mechanism of loss: inherited constraints (SDK `onMissing` default, `/collaboration` base path, 429, `SUPEREDITOR_*`, license key, query cardinality, case, deleted text) were not decisions, so they never got a number. The companion still has most of them. The spine is the binding text. Those rules are not in it.
