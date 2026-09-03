# Rubric Walker Review — SuperDoc Document-Engine Host Spine

- **Role:** BMAD architecture Reviewer Gate — rubric walker
- **Subject:** `docs/architecture/architecture-superdoc-redesign-2026-09-03/ARCHITECTURE-SPINE.md`
- **Companions consulted:** `.memlog.md`; `ARCHITECTURE-REDESIGN.md` only to test silent-requirement landing
- **Brownfield consulted:** `package.json`, `config/env.ts`, `collaboration/{AGENTS.md,websocket.ts}`, `routes/AGENTS.md`, `infra/AGENTS.md`, `sessions/AGENTS.md`, `services/analytics/AGENTS.md`, `AGENTS.md`
- **Altitude / purpose:** initiative / build-substrate
- **Parent spine:** none
- **Driving spec:** none present (five named source specs were reconstructed; no `CAP-n` map)
- **Date:** 2026-09-03
- **Intent:** independent critique. Spine not edited.

## Verdict

**concerns** — the paradigm and the JSDOM / offset / dual-write / v1-room cuts are real and mostly enforceable, but the spine leaves the host↔sidebar room contract and shared-mode durability as choose-your-own-adventure, which is exactly what an initiative spine is for.

## Checklist walk

| # | Good-spine test | Result | One-line read |
| --- | --- | --- | --- |
| 1 | Fixes the real divergence points for the level below and misses none | **concerns** | The three reconstructed problems (targeting, process memory, REST↔Yjs dual-write) are bound. The bound consumer `sidebar-viewer` can still pick an incompatible room provider, URL shape, and auth. Shared-mode recovery has two SoTs. |
| 2 | Every AD Rule is enforceable and actually prevents its stated divergence | **concerns** | AD-1–4, 7–8, 11, 14–15, 17 are testable. AD-5 “mechanical work”, AD-6/AD-10 “last-good **or** room”, AD-9 “Hocuspocus **or** y-websocket”, and AD-13 “retry once” (no actor) do not uniquely constrain two implementers. |
| 3 | Nothing under Deferred could let two units diverge | **pass** | Deferred items are “not now” and are already forbidden or gated by AD-5, AD-9, AD-11. The live forks sit in Rules and Open Questions, not in Deferred. |
| 4 | Named tech is verified-current | **concerns** | SuperDoc target pins match npm latest today. Stack also pins brownfield Fastify/ioredis/yjs that are behind current, and pins `@hocuspocus/server` 4.6.0 while `superdoc@2.11.0` / `@superdoc/cli@0.31.0` declare `@hocuspocus/provider` `^2.13.6`. |
| 5 | Ratifies rather than contradicts brownfield (redesign contradictions must be explicit) | **concerns** | JSDOM / PM-offset / custom Yjs-bridge / v1-collab retirement is explicit. License boot, `/collaboration` query join, optional upload user, 429 retry, host OOXML normalize, and analytics-on-editor-metadata are brownfield contracts the spine silently replaces or drops. |
| 6 | If a spec drove it, covers that spec’s capabilities | **n/a** | No `SPEC.md` / `CAP-n`. Reconstructed phase intent is covered at problem level. |
| 7 | If a parent spine is inherited, no new AD weakens it | **n/a** | Inherited Invariants: none. |
| 8 | Every altitude-owned dimension is decided, deferred, or an open question | **concerns** | Deploy / env / Redis / health / admission are present under Operational Envelope. Security-auth-license, collaboration transport (path + provider + auth), and session-TTL/export-eviction are whole dimensions left silent. |

## What the spine gets right

- Named paradigm (**document-engine command host**) actually carries the model: adapters around one engine loop, no second editor.
- AD-1 / AD-2 / AD-8 / AD-16 are the load-bearing cuts for this brownfield. A feature team cannot honestly keep `editor/replace.ts` or `syncEditorToCollaboration` and still claim compliance.
- JSDOM contradiction is intentional and explicit (paradigm diagram, AD-2, AD-7, AD-16, retiring-stack footnote). That satisfies the redesign exception to “ratify brownfield.”
- AD-17 freezes the justitia-agent 404/400/503 trap. AD-15 freezes the Cloud Run one-port / no-boot-kill invariant. Both are real inherited constraints, not restated folklore.
- Open Questions are real forks (CLI RSS budget, sidebar v2 date, facade fail-closed vs source map), not padding.
- Operational Envelope exists. This is not a domain-only draft that forgot deploy/infra/ops.

## 1. Divergence points for the level below

Altitude is initiative. The units one level down are features across the frontmatter binds: `host`, `documents`, `routes`, `collaboration`, `persistence`, `agent-tools`, `sidebar-viewer`.

### Bound and fixed

| Divergence two features could hit | Where it is fixed |
| --- | --- |
| Second editor / mark fabrication / hand-written PM or Yjs writes | AD-1, AD-2, AD-16 |
| `from`/`to` as the long-term targeting model | AD-3, AD-16, OQ-3 |
| Partial multi-edit turns | AD-4 |
| Silent direct rewrite of contract language | AD-5 |
| Immortal in-process JSDOM editor as store | AD-6, AD-7 |
| Host-owned PM→Yjs dual-write | AD-8 |
| v2 editor joining a v1 room | AD-9 |
| Redis YDoc as the only recoverability | AD-10 |
| Agent growing an unhosted SuperDoc write path | AD-11 |
| Generic `CLI` author | AD-12 |
| Throw-less success; retry storms | AD-13 |
| Clause text in logs | AD-14 |
| Second listen port / boot `lsof \| kill` | AD-15 |
| Permanent dual stack | AD-16 |
| Content 400 vs session 404 | AD-17 |

### Missed (two units can still choose incompatibly)

1. **Room provider + join URL + auth** for `collaboration` and `sidebar-viewer`. AD-9 allows Hocuspocus *or* y-websocket. Stack pins only `@hocuspocus/server`. Brownfield and memlog lock a `/collaboration` *base* URL plus `?room=` y-websocket query join. Redesign diagram uses `/collaboration/:id`. SuperDoc v2 Hocuspocus auth is `token`/`params`; the current socket has session-exists pre-auth only. Host room-server and angular-frontend can ship three incompatible rooms and all cite AD-9.
2. **Shared-mode durability.** AD-6 recovers from “last-good DOCX **or** the live v2 room.” AD-10 persists last-good after a host mutation batch and treats room state as “presence.” In shared mode the live document is the room (redesign §5.4). Persistence and documents features can pick opposite reopen rules after a browser-only edit, crash, or TTL.
3. **Query `require` default and `find` vs `match`.** Redesign §4.1 treats `require: 'exactlyOne'` and “do not write from `find`” as host-must-not-weaken SuperDoc rules. Spine AD-3 names `query.match` / `extract` / `NodeAddress` but not the require default. Routes and agent-tools can default `any` vs `exactlyOne` and still look compliant.
4. **Cutover reader window.** Redesign §5.2 keeps v1 collaboration as a temporary *reader* until sidebar v2. AD-9 says new rooms are v2. AD-16 deletes v1 once “Document API routes and the chosen access mode are the only writers.” Isolated mode can be the only writer while browsers still need v1 rooms. Collaboration and routes can delete or keep v1 at different steps.
5. **Who retries a stale receipt.** AD-13 says re-query and retry once. Host routes and justitia-agent (which already retries 429/503) can each implement that once → four attempts, or neither if each assumes the other.

These are initiative-altitude calls. Leaving them to code is how the last host grew a second write path.

## 2. AD Rule enforceability

Test: could a reviewer reject a PR with only the Rule text? Does following the Rule actually prevent the stated Prevents?

| AD | Prevents | Rule prevents it? | Enforceable? | Note |
| --- | --- | --- | --- | --- |
| AD-1 | Second home-grown editor/sync/mark stack | **Yes** | **Yes** | Import + write-path lint. Exception “except persist the engine’s own export” is necessary; see F6 for normalize/cleanup hiding in that exception. |
| AD-2 | JSDOM `Editor`, banned packages, custom track marks | **Yes** | **Yes** | “After the cutover” is dated by AD-16, not by a gate. Acceptable if AD-16 is sharpened. |
| AD-3 | Long-term `from`/`to` targeting | **Mostly** | **Mostly** | Binds routes + agent-tools only. Sidebar in-browser automation can keep PM offsets. No `require` default. Compat facade is correctly parked in OQ-3. |
| AD-4 | Partial multi-step agent turns | **Yes** | **Yes** | `preview` then `apply` + `atomic: true` + unique step id is testable. “Preview is not a lock” closes a real cheat. |
| AD-5 | Silent direct rewrites | **Partial** | **Partial** | Explicit `changeMode` flag is testable. “Limited to mechanical work” is not a rule. Agent accept/reject off is testable. |
| AD-6 | Immortal in-process editor as durable store | **Yes** for JSDOM | **No** for recovery | Open/use/persist/close is enforceable. “Reopen from last-good **or** live room” reintroduces two recovery stories. |
| AD-7 | JSDOM SuperDoc in the Fastify heap | **Yes** | **Yes** | Process boundary is observable. Worker-RSS how-to is an Open Question; admission “reject when it cannot take another open” still binds. |
| AD-8 | Custom PM-to-Yjs dual-write | **Yes** | **Yes** | Two modes, no host converter. Mode-at-upload/first-join is in conventions. |
| AD-9 | Mixing v1 rooms with a v2 editor | **Yes** for v1/v2 mix | **No** for v2 provider | Create-vs-join failure is enforceable. “Hocuspocus or y-websocket” does not pick one room. Shared gated on sidebar v2 is correct. |
| AD-10 | YDoc snapshots as only recoverability | **Yes** for isolated | **Partial** for shared | Persist-after-successful-batch is testable for host mutations. Human room edits + “room for presence” leave last-good stale. |
| AD-11 | Unhosted agent SuperDoc writes | **Yes** | **Yes** | HTTP boundary + facade-only old routes. |
| AD-12 | Generic `CLI` authorship | **Yes** | **Yes** | Missing user → 400 is testable. Silently contradicts today’s anonymous upload default (see brownfield). |
| AD-13 | Throw-less success; retry storms | **Partial** | **Partial** | `receipt.success` is enforceable. Retry-once with no actor can amplify storms. “Never drop `expectedRevision`” is good. |
| AD-14 | Clause text / PII in logs | **Yes** | **Yes** | Allowlist vs denylist is greppable. Amplitude/OTEL stay. |
| AD-15 | Second port; boot process-kill | **Yes** | **Yes** | Matches Cloud Run + Chainguard history. |
| AD-16 | Permanent JSDOM + Document API dual stack | **Yes** if “done” is defined | **Partial** | Delete list is concrete. Exit gate fights AD-9’s pre-v2 window (see missed #4). |
| AD-17 | 404-as-expiry confusion | **Yes** for named codes | **Yes** | Does not mention 429, which the agent already retries. |

## 3. Deferred — can it let two units diverge?

| Deferred item | Divergence if two units take it? | Already bound? | Rubric |
| --- | --- | --- | --- |
| Liveblocks as room provider | Yes, if someone shipped it | AD-9 names only Hocuspocus or y-websocket | OK as “not now” |
| SuperDoc MCP / `createAgentToolkit` in this host | Yes (second agent surface) | AD-11 + paradigm (deterministic HTTP host) | OK |
| justitia-agent Python `superdoc-sdk` bypass | Yes (the AD-11 Prevents) | AD-11 Rule | OK — Deferred restates a negative decision already bound |
| Content-control / template-first as default style | Low; still Document API | AD-3 addressing still applies | OK |
| Productized version history | Low unless it becomes a third SoT | AD-10 last-good remains durable artifact | OK; keep versions *off* the write path |
| Agent-driven accept/reject | Yes | AD-5 + convention “off unless later decision” | OK |

No Deferred item is an unbound fork. Do not confuse this pass with AD-9’s in-Rule “or”.

## 4. Named tech — re-verified 2026-09-03

Spine claims “npm versions verified 2026-09-03”. Re-checked against the npm registry the same day.

| Spine pin | npm latest (this review) | Fit |
| --- | --- | --- |
| Node.js 20 | project `.nvmrc` 20 | **Current for this repo.** Do not “upgrade” to 22/25; Chainguard + SuperDoc headless story is Node 20. |
| Fastify 5.8.5 | **5.12.1** | Brownfield pin (`package.json`). Memlog recorded the gap. Acceptable as ratification if labeled; not “current.” |
| `@superdoc/sdk` 2.8.0 | **2.8.0** (published 2026-09-01) | **Current.** Correct official Node surface. |
| `@superdoc/cli` 0.31.0 | **0.31.0** | **Current.** Bundled with that SDK. |
| `superdoc` 2.11.0 (browser v2) | **2.11.0** | **Current.** Correct unscoped v2 package. |
| `@hocuspocus/server` 4.6.0 | **4.6.0** | Latest *server* line. **Fit is unverified:** `superdoc@2.11.0` peer and `@superdoc/cli@0.31.0` depend on `@hocuspocus/provider` **`^2.13.6`**, not 4.x. Latest provider on npm is 4.6.0 — SuperDoc’s declared client is still 2.x. |
| ioredis 5.8.2 | **6.0.0** | Brownfield pin. Memlog did **not** record this major gap. |
| yjs 13.6.18 | **13.6.32** | Brownfield pin. Memlog recorded 13.6.32. CLI 0.31.0 depends on yjs **13.6.31**. Pinning 13.6.18 next to a CLI that wants 13.6.31 is a future dual-yjs risk. |
| Chainguard `node-fips` 20 | repo runtime base | Ratified. Digest not pinned in the spine (digest lives in the container file; OK as seed). |

`@harbour-enterprises/superdoc` 1.46.x and `@superdoc-dev/superdoc-yjs-collaboration` 1.0.x correctly marked retiring. Repo is `^1.46.2` / `^1.0.0`; npm 1.46.3 matches the memlog.

**Finding:** “verified-current” passed for the SuperDoc *names* and failed for *fit* on Hocuspocus majors and for honesty on ioredis/yjs/Fastify pins.

## 5. Brownfield ratification

This is a redesign. Contradicting the JSDOM stack is allowed only when explicit.

### Explicit (compliant)

- JSDOM `Editor` / `createHeadlessEditor` / `trackInsert` / `trackDelete` — AD-2, AD-16
- ProseMirror `from`/`to` as the model — AD-3, AD-16
- `syncEditorToCollaboration` dual-write — AD-8
- v1 `@superdoc-dev/superdoc-yjs-collaboration` rooms — AD-9, AD-16
- YDoc-as-body recoverability — AD-10
- One `PORT`, no boot process-kill — AD-15
- Node 20, Chainguard, Fastify host, Redis, `GET /health`, 503 admission — Stack + envelope
- Amplitude + OTEL remain, redacted — AD-14
- justitia-agent stays on HTTP; old routes become facade — AD-11

### Silent contradiction or drop (non-compliant with “ratify or say you are breaking it”)

| Brownfield fact | Spine | Risk |
| --- | --- | --- |
| `SUPERDOC_PUBLIC_LICENSE_KEY` is required at process start (`config/env.ts`); memlog says keep a SuperDoc license identity | Absent | New host can boot without org license and fall through to SuperDoc’s community/eval identity, or invent a different injection. Commercial/telemetry attribution breaks. |
| Sidebar treats `superdocSocketUrls` as a `/collaboration` **base**, and uses `/collaboration?room=` (collaboration AGENTS + websocket.ts) | Envelope says sockets “must move to v2 rooms”; no path, no query-join, no auth | Host and frontend diverge on join URL. |
| Upload `user` is optional; missing → `anonymous` | AD-12 missing user is 400 | Breaks current upload callers unless called out as a cutover incompatibility. |
| Agent retries **429** and **503** | AD-17 names 404/400/503 only | A routes feature can use 429 for content errors or stop emitting 429 for overload. |
| `normalizeDocx` / optional `cleanupExportedDocx` write OOXML around the engine | AD-1 allows OOXML only to persist the engine export | Infra can keep a second write path “for repair.” |
| Upload analytics reads editor/converter metadata (`getDocumentIdentifier`, created timestamp) | AD-2/AD-16 delete that editor; AD-14 says Amplitude stays | Analytics feature has no legal source for the existing event shape. |
| `instrumentation.ts` must load before Fastify | Structural seed lists the file; no rule | Easy to “clean up” and break OTEL, same class of boot footgun as the removed `lsof \| kill`. |
| Export schedules in-memory eviction (`EXPORT_SESSION_HOLD_MS`); Redis TTL 1800s; session timeout 30 min | AD-6 handle TTL only | Export/session features can expire or keep sessions incompatibly with agent retry/expiry. |
| Redis key families `superdoc:{doc,updates,meta,buffer}` | Envelope: meta + last-good; room optional | Persistence can keep YDoc keys as a shadow body next to last-good. |

AD-12’s 400-on-missing-user is a *good* safety rule. It still has to say it is a breaking change vs today’s anonymous default.

## 6. Altitude dimension coverage

Initiative owns the whole host plus two known consumers. Sweep:

| Dimension | Status | Where |
| --- | --- | --- |
| Design paradigm | **Decided** | Design Paradigm |
| Mutation authority / write path | **Decided** | AD-1, AD-2 |
| Addressing / identity | **Decided** (require-default hole) | AD-3, conventions |
| Multi-edit atomicity | **Decided** | AD-4 |
| Review / tracked-change policy | **Decided** + deferred accept/reject | AD-5 |
| Handle / session lifecycle | **Decided** for handles; **silent** for HTTP session TTL/export eviction | AD-6 |
| Process / memory | **Decided** + **open** budget | AD-7, OQ-1 |
| Access modes | **Decided** | AD-8 |
| Collaboration protocol (v1 vs v2) | **Decided** | AD-9 |
| Collaboration provider / URL / auth | **Silent** (Rule says “or”; no path/auth) | AD-9, Stack |
| Durability / SoT | **Decided** isolated; **fork** shared | AD-6, AD-10 |
| Agent HTTP boundary | **Decided** | AD-11 |
| Authorship | **Decided** | AD-12 |
| Receipts / retry | **Decided** (actor hole) | AD-13 |
| Telemetry redaction | **Decided** | AD-14 |
| Deploy / one port | **Decided** | AD-15, Operational Envelope |
| Environments / regional sockets | **Decided** at rollout-coupling level | Envelope |
| Infra / Redis | **Decided** | Envelope, AD-10 |
| Operations (health, admission, worker death) | **Decided** | Envelope |
| Migration / dual-stack end-state | **Decided** (reader-window hole) | AD-16 |
| HTTP status meanings | **Decided** (429 hole) | AD-17 |
| Security / transport auth / license identity | **Silent** | — |
| Config / env contract (`SUPEREDITOR_*`, Redis, license, analytics disable) | **Silent** | — |
| Rate limits | **Silent** (redesign reserved 429) | — |
| Cutover sequence | Companion only; not a spine job if AD-16 is sharp | — |

Operational envelope is **not** missing as a section. Security-auth-license, room transport, and session-expiry policy are the silent dimensions.

## 7. Silent requirements from the companion / memlog

Checked `ARCHITECTURE-REDESIGN.md` and `.memlog.md` for load-bearing constraints that the AD structure dropped.

| Source | Requirement | In spine? |
| --- | --- | --- |
| Memlog constraint | One port; no boot process-kill | **Yes** AD-15 |
| Memlog constraint | 404 expiry / 400 content / 503 retry | **Yes** AD-17 |
| Memlog constraint | Agent keeps calling this host; old tool names exist | **Yes** AD-11 |
| Memlog constraint | v2 editor must not join v1 room; sockets end in `/collaboration` | **Partial** — mix forbidden; path not bound |
| Memlog constraint | Node 20, Chainguard, instrumentation-before-Fastify | **Partial** — Node/Chainguard yes; instrumentation no Rule |
| Memlog constraint | Keep SuperDoc license identity | **No** |
| Redesign §4.1 | `require: 'exactlyOne'`; `find` is not for writes; pending deletes excluded unless asked | **No** |
| Redesign §4.4 / §5.6 | `onMissing: 'error'`; create vs join explicit | **Yes** AD-9 + conventions |
| Redesign §5.2 | v1 stack remains a temporary reader until sidebar v2 | **No** (conflicts with a strict reading of AD-9/16) |
| Redesign §5.4 | Shared durable = last-good **plus** room persistence; live = room | **No** — AD-6 “or”, AD-10 “presence” |
| Redesign §6.3 | 429 reserved for rate limits; agent retries it | **No** |
| Redesign §10 Q4 | Hocuspocus vs y-websocket is an open question | **Dropped** — Rule says both, Stack pins Hocuspocus, OQ list omits it |
| Redesign safety | Distinct output; close on every path; no unadvertised toolkit names | **Yes** AD-6, AD-10; toolkit in Deferred |
| AGENTS / analytics | Upload analytics only after durable persist; flush on shutdown without init | **No** |

The Q4 drop is the clearest distill failure: the companion knew the provider was a fork; the spine resolved it by writing “or” and pinning one package.

## Findings

Per finding: **discuss** / **defer** (to Deferred or Open Questions) / **autofix** (wording the author can apply without a new product call) / **ignore**.

### High

**F1 — AD-9 does not bind one v2 room for host and sidebar.**
Two bound units (`collaboration`, `sidebar-viewer`) can ship Hocuspocus 4.x vs y-websocket, `/collaboration/:id` vs `/collaboration?room=`, and token vs session-exists auth, all while citing AD-9. Brownfield and the frontend already depend on a `/collaboration` base + query join. SuperDoc v2 has no join-or-create; provider fields differ (Hocuspocus `token` vs y-websocket `params`). Stack-pinning `@hocuspocus/server` 4.6.0 without a Rule is seed, not an invariant.
- **Disposition:** discuss. Promote redesign §10 Q4 to an Open Question *or* pick one provider and bind URL + auth in AD-9. Verify Hocuspocus server 4.x against SuperDoc’s `^2.13.6` provider before pinning 4.6.0 as the host.

**F2 — Shared-mode source of truth is an “or”.**
AD-6: recover from last-good **or** the live room. AD-10: persist last-good after a host mutation batch; room state “may be persisted for presence.” Redesign §5.4: live document in shared mode *is* the room; durable is last-good *plus* room persistence. After a sidebar-only edit, crash, or warm-handle eviction, `documents` and `persistence` can reopen from stale DOCX and blank or fork the room (the failure AD-9’s create/join rules are trying to prevent).
- **Disposition:** discuss. Split the Rule by mode: isolated recovers from last-good only; shared recovers from the room and snapshots last-good from the engine on a defined cadence (and on host-mutation receipt). Stop calling room persistence “presence.”

**F3 — License / transport-auth / identity is a silent initiative dimension.**
Memlog requires keeping a SuperDoc license identity (`SUPERDOC_PUBLIC_LICENSE_KEY` is a hard start dependency today). SuperDoc still attributes commercial telemetry via `licenseKey` (community/eval default if omitted). AD-12 binds *author* identity only. Collaboration auth, upload user breaking-change, and license injection have no decided/deferred/open home. Operational Envelope covered Cloud Run and Redis and skipped this envelope.
- **Disposition:** discuss. Either an AD (license on `client` / Editor config; collaboration join authorized the same way session auth works today; AD-12 called out as breaking vs anonymous upload) or an explicit Deferred/Open Question if the team will not decide now.

### Medium

**F4 — AD-5 “mechanical work” and AD-13 retry actor are not rules.**
“Limited to mechanical work” cannot fail a PR. “Re-query and retry once” without “the host does this; the agent does not” (or the reverse) does not prevent retry storms — the thing AD-13 claims to Prevent. justitia-agent already retries 429/503.
- **Disposition:** autofix for actor (“the host retries stale codes once; callers do not”). discuss for what “direct” may cover, or drop “mechanical” and keep “explicit flag only.”

**F5 — Query defaults that SuperDoc already treats as safety did not land.**
Redesign §4.1: `require: 'exactlyOne'` when one clause must change; `find` is discovery-only; pending tracked deletions excluded unless asked. Without them, `routes` and `agent-tools` diverge on multi-match replaces and write from projection/find results while still “using `query.match`.”
- **Disposition:** autofix into Consistency Conventions (and bind AD-3 to `sidebar-viewer` for in-browser automation).

**F6 — AD-1’s persist exception plus host OOXML normalize is a second write path.**
Brownfield `normalizeDocx` / `cleanupExportedDocx` mutate bytes outside SuperDoc. AD-1 allows hand-written OOXML “to persist the engine’s own export.” Two infra/export units can keep or expand that stack.
- **Disposition:** discuss. Ratify import normalize as a pre-open adapter, or forbid post-engine OOXML except the SDK save bytes.

**F7 — AD-16 vs the v1 reader window.**
Companion: until sidebar v2, isolated is production writes and v1 collab stays a temporary reader. Spine never says that. A collaboration feature can delete v1 rooms at step 1–3; a frontend-coupled feature can keep creating them.
- **Disposition:** autofix. State: v1 rooms are read-only hangover until shared mode ships; no new v1 rooms; AD-16 delete includes that reader once sidebar v2 is the only browser.

**F8 — Frozen status contract omitted 429; session lifetime after export is unbound.**
Agent helper retries 429 and 503 and treats 404 as expiry. Export today evicts after `EXPORT_SESSION_HOLD_MS`. Spine binds 404/400/503 and handle close, not 429 meaning or whether export ends the HTTP session.
- **Disposition:** autofix AD-17 to reserve 429 for rate-limit/admission siblings (or say “do not send 429 until a later AD”). Defer export-eviction/TTL to an Open Question if the number is not being decided.

**F9 — Stack pins are a mix of current SuperDoc and stale brownfield, with one fit miss.**
ioredis 5.8.2 vs 6.0.0 unlogged. yjs 13.6.18 vs CLI’s 13.6.31 / npm 13.6.32. Hocuspocus server 4.6.0 vs SuperDoc’s provider `^2.13.6`. Fastify 5.8.5 vs 5.12.1 is logged and is ratification.
- **Disposition:** autofix labels (“brownfield, keep” vs “target”). discuss Hocuspocus major before anyone implements AD-9.

### Low

**F10 — Analytics stay, their source object is deleted.**
AD-14 keeps Amplitude upload analytics. Those events today read JSDOM editor metadata after durable persist and flush on shutdown without initializing a quiet process. No Rule replaces the metadata source or the persist-then-emit / flush-without-init gates.
- **Disposition:** defer to a one-line convention or a later analytics AD. Not a dual-write risk if AD-1 holds.

**F11 — Instrumentation boot order is a standing AGENTS.md invariant with no Rule.**
Same class as AD-15’s “do not reintroduce host-process cleanup.” A host-boot feature can move the import and break Fastify/HTTP patching.
- **Disposition:** autofix one sentence under AD-15 or Operational Envelope.

**F12 — AD-3 does not bind `sidebar-viewer`.**
Redesign §7.2 wants in-browser automation on `editor.doc` (Document API). A sidebar feature can keep PM offsets for “just the viewer tools.”
- **Disposition:** autofix Binds.

**F13 — Capability → Architecture Map omitted.**
No spec CAPs exist; omission is fine. If `bmad-spec` follows, the map should be added then — not a spine defect now.
- **Disposition:** ignore.

## Suggested parent-gate actions (walker does not edit)

Do **not** treat F13 as work. The smallest distill that would move this spine from concerns toward pass:

1. Bind one v2 provider + URL + auth (F1) or reopen it as an Open Question (do not leave “or” in the Rule).
2. Split isolated vs shared recovery (F2).
3. Put license + join auth + AD-12 breaking change somewhere visible (F3).
4. Apply the autofixes: retry actor, query conventions, v1 reader window, 429, Binds on AD-3, boot instrumentation, stack labels (F4–F5, F7–F9, F11–F12).

F6 and F10 can wait for a discuss pass; they are real but narrower.

## Compact summary (for gate rollup)

- **Verdict:** concerns
- **Top findings:** F1 room provider/URL/auth unbound; F2 shared-mode last-good vs room SoT; F3 license/auth dimension silent; F4/F13-adjacent: AD-5/AD-13 unenforceable phrases; F5 query safety defaults dropped
- **File:** `docs/architecture/architecture-superdoc-redesign-2026-09-03/reviews/review-rubric-walker.md`
