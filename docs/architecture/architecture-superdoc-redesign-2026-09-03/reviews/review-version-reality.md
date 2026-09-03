# Version / reality review — SuperDoc Document-Engine Host spine

**Reviewer role:** BMAD finalize — version and reality check  
**Date:** 2026-09-03 (re-check after the spine's claimed 2026-09-03 npm pass)  
**Spine:** `docs/architecture/architecture-superdoc-redesign-2026-09-03/ARCHITECTURE-SPINE.md`  
**Companion:** `docs/architecture/architecture-superdoc-redesign-2026-09-03/ARCHITECTURE-REDESIGN.md`  
**Memlog:** `docs/architecture/architecture-superdoc-redesign-2026-09-03/.memlog.md`  
**Spine edited?** No.

## Verdict

**Needs correction before finalize.**

The Document API mental model, official Node surface (`@superdoc/sdk`), do-not-import internals, SDK-joins-v2-rooms, and v1/v2 room incompatibility are confirmed against live SuperDoc docs and/or the published 2.8.0 SDK types. Most AD-1–AD-17 rules are either copied from those docs or grounded in this repo.

Two committed stack choices were **not** starter-checked and are now stale or unsafe:

1. **`@hocuspocus/server` 4.6.0 is npm-latest, not SuperDoc's v2 example.** SuperDoc's live collaboration starter pins `^2.13.6` (lock 2.15.3). Hocuspocus 4.6.0 also declares `engines.node: >=22`, which conflicts with this host's Node 20 pin.
2. **Companion shared-room reopen text copies `@superdoc-dev/sdk` docs (`onMissing`), not the pinned `@superdoc/sdk` 2.8.0 types (`roomMode`).** Official docs currently advertise both package names.

Do not treat the Stack table as build-ready until the Hocuspocus pin is reconciled with SuperDoc's 2.x starter and Node 20.

## How this review was done

Re-checked on 2026-09-03 against:

| Source | What was checked |
| --- | --- |
| `registry.npmjs.org` | Latest tags, publish times, engines, optional/peer deps for every named package |
| `@superdoc/sdk@2.8.0` tarball (`dist/index.d.ts`, `DocOpenParams`, runtime types) | Actual Node integration surface vs companion snippets |
| [docs.superdoc.dev](https://docs.superdoc.dev/) pages listed below | Document API, agents, safety, collaboration, migrate-from-v1 |
| `github.com/superdoc/docx-editor` `examples/collaboration/package.json` and `pnpm-workspace.yaml` catalog | Live v2 starter defaults |
| This repo: `package.json`, `package-lock.json`, `.nvmrc`, `Dockerfile`, `config/env.ts`, `server.ts`, `app.ts`, `collaboration/websocket.ts`, `routes/`, `editor/editor.factory.ts` | Brownfield pins and contracts |

SuperDoc pages fetched or searched:

- `/document-api/mental-model/`
- `/document-api/overview`
- `/document-api/query-content/`
- `/document-api/mutation-plans/`
- `/document-api/receipts-and-errors/`
- `/document-api/output-projections/`
- `/document-api/tracked-changes/`
- `/document-api/reference/mutations/apply`
- `/document-api/reference/create/paragraph`
- `/agents/overview/`
- `/agents/operate/safety/`
- `/start/features-and-surfaces/`
- `/document-engine/sdks`
- `/editor/collaboration/`
- `/editor/collaboration/run-a-server`
- `/editor/collaboration/upgrade-a-document/`
- `/editor/migrate-from-v1/overview/`
- leftover v1 guides under `/guides/collaboration/*` (not treated as v2 contract)

`go.superdoc.dev/examples/collaboration` returned HTTP 404 at review time; the same example was read from `github.com/superdoc/docx-editor` and `github.com/superdoc-dev/superdoc`.

---

## 1. npm / repo versions (re-check)

Claimed verification (memlog + user brief) vs live registry and this lockfile:

| Name | Spine / claimed | npm `latest` (2026-09-03) | This repo | Fit? |
| --- | --- | --- | --- | --- |
| Node.js | 20 | n/a | `.nvmrc` `20`; Dockerfile Chainguard `node-fips:20`; `package.json` `engines` is `>=18` | Pin matches project practice. `engines` field is looser than the spine. |
| Fastify | 5.8.5 | **5.12.1** (2026-08-18); `next` is `6.0.0-alpha.2` | `^5.8.5` → lock **5.8.5** | Honest repo pin. Latest is newer; not a lie. |
| `@superdoc/sdk` | 2.8.0 | **2.8.0** (published 2026-09-01; `next` `2.9.0-next.2`) | not installed | Version current. See §2 for the parallel `@superdoc-dev/sdk` line. |
| `@superdoc/cli` | 0.31.0 | **0.31.0** (2026-09-01; `next` `0.32.0-next.2`) | not installed | Version current. **Not a dependency of `@superdoc/sdk` 2.8.0.** |
| `superdoc` (browser v2) | 2.11.0 | **2.11.0** (2026-09-01; `legacy` **1.46.3**; `next` `2.12.0-next.13`) | not installed | Version current. Consumer pin. |
| `@hocuspocus/server` | 4.6.0 | **4.6.0** (2026-08-10) | not installed | Latest exists. **Not SuperDoc's starter. `engines.node` is `>=22`.** |
| ioredis | 5.8.2 | **6.0.0** (2026-07-31) | `^5.8.2` → lock **5.9.3** | "5.8.2 in repo" is the range, not the lock. Latest is 6. |
| yjs | 13.6.18 | **13.6.32** (2026-08-04) | `^13.6.18` → lock **13.6.19** | Claimed range is right; lock is 13.6.19. `superdoc` 2.11.0 peers `yjs ^13.6.19`. |
| `@harbour-enterprises/superdoc` | 1.46.x retiring; latest v1 1.46.3 | **1.46.3** (2026-08-26) | `^1.46.2` → lock **1.46.2** | Latest-v1 claim holds. Repo is one patch behind latest. |
| `@superdoc-dev/superdoc-yjs-collaboration` | 1.0.x retiring | **1.0.2** (package time 2025-11-06) | `^1.0.0` → lock **1.0.2** | Exists; still the current v1 collab server. |
| Chainguard `node-fips` | 20 | not re-resolved as a digest | Dockerfile pins `node-fips:20@sha256:11148647…` | Matches spine. Digest freshness not independently verified. |

Related packages the spine did not pin, checked because they sit on the same path:

| Name | npm `latest` | Notes |
| --- | --- | --- |
| `@superdoc-dev/sdk` | **1.21.3** (2026-08-02) | Still published. Document Engine SDK page still installs this name. |
| `@superdoc/headless` | **not found** | Docs still say do not import it. Not a public npm package today. |
| `@superdoc/document-api-v2-adapter` | **not found** | Same. |
| `@hocuspocus/provider` | **4.6.0**; latest 2.x is **2.15.3** | `superdoc` 2.11.0 and `@superdoc/cli` 0.31.0 peer/depend `^2.13.6`. |
| `@superdoc/mcp` | 0.18.0 | Exists; correctly deferred. |
| `@fastify/websocket` | 11.3.0 | Repo is `^11.2.0`. |
| `y-websocket` | 3.1.0 | Acceptable SuperDoc v2 transport; not a second architecture. |

### `@superdoc/sdk` 2.8.0 packaging (not just the version number)

npm description: “Node SDK for SuperDoc, wrapping the SuperDoc CLI…”.

Published shape:

- No runtime `dependencies`.
- `optionalDependencies`: `@superdoc/sdk-linux-x64` / darwin / windows at **2.8.0**.
- `@superdoc/sdk-linux-x64` description: “SuperDoc CLI and document host binaries… Selected automatically by `@superdoc/sdk`; do not install it directly.” `bin.superdoc` → `bin/superdoc`.
- Types export `SuperDocClient`, `createSuperDocClient`, `createAgentToolkit`, `SuperDocCliError`.
- Runtime types: `processMode: 'cli' | 'document'`; default path is embedded CLI; `documentHostPath` selects a standalone document host.
- **Does not depend on npm `@superdoc/cli`.** Listing both as the host stack implies a separate CLI install the SDK does not use.

`@superdoc/cli` 0.31.0 *does* exist and is the shell/CI surface. Its npm deps include `superdoc` **2.11.0**, `yjs` **13.6.31**, `@hocuspocus/provider` **^2.13.6**, `y-websocket` **^3.0.0**, `happy-dom`, Liveblocks clients. That is a different install graph than `@superdoc/sdk` + platform binary.

---

## 2. SuperDoc docs claims

### Document API mental model — **confirmed**

[Document API mental model](https://docs.superdoc.dev/document-api/mental-model/): query → keep address/target → mutate → inspect receipt. Browser and headless share names and shapes. Do not derive mutation locations from rendered DOM or copied text offsets.

[Agents overview](https://docs.superdoc.dev/agents/overview/) headless sequence:

```text
open → inspect state → mutate → check receipt → save → close
```

Spine loop (`open → inspect → query → target → mutate → inspect receipt → persist → close`) is that contract plus host persist. Not invented.

Confirmed API names used by the spine/companion:

| Claim | Live source |
| --- | --- |
| `query.match`, `require: 'exactlyOne' \| 'all' \| 'any' \| 'first'` | query-content |
| `evaluatedRevision` / `expectedRevision` | query-content, mutation-plans, receipts |
| `mutations.preview` then `mutations.apply` with `atomic: true`, unique step `id` | mutation-plans |
| `receipt.success`; absence of throw is not success | receipts-and-errors, replace-delete |
| Retry-once codes: `REVISION_MISMATCH`, `STALE_REVISION`, `ADDRESS_STALE`, `TARGET_NOT_FOUND`; no retry on `NO_OP` / capability failures; never drop `expectedRevision` | receipts-and-errors — **same list as AD-13** |
| `extract`, `info`, `find` (discovery only), `projectHtml` / `projectMarkdown` with `reviewMode` + `includeSourceMap` | SDKs table + output-projections |
| `NodeAddress` / `nodeId`; DOCX `paraId`; `sdBlockId` session-scoped | document-api/overview, common-workflows |
| `create.paragraph` with `at: { kind: 'after' }` | create.paragraph + common-workflows |
| `comments.create` / `list` / `patch`; `trackChanges.list` / `get` / `decide` | reference index, tracked-changes |
| `changeMode` optional, **defaults to direct**; host should force `tracked` for consequential edits | safety |
| Distinct output + `close({ discard: true })` | safety, review-tracked-changes |
| Default author is generic `CLI` if user omitted | SDKs + safety |
| Do not log document text, full payloads, or complete receipts | safety + receipts |
| Exclude accept/reject from agent tool surfaces | safety (`excludeActions`) |
| `createAgentToolkit` exists; host is right to defer embedding it | agents overview + `@superdoc/sdk` 2.8.0 exports |
| Do not dispatch unadvertised `superdoc_execute_code` / `agent_*` | safety |

Official mental-model snippets often use `require: 'first'`. Companion examples use `exactlyOne`. Both are documented; `exactlyOne` is the safer host default.

### Official Node surface / do-not-import `@superdoc/headless` — **confirmed, with a docs split**

[Agents overview](https://docs.superdoc.dev/agents/overview/) (2026-09-03):

> Package for Node.js SDK: **`@superdoc/sdk`**.  
> Do not import `@superdoc/headless` or `@superdoc/document-api-v2-adapter`. Those are implementation details.

[Migrate from v1](https://docs.superdoc.dev/editor/migrate-from-v1/overview/) repeats the same ban and adds `@superdoc/v2-host`.

Neither `@superdoc/headless` nor `@superdoc/document-api-v2-adapter` exists on npm today. The ban is still the published customer rule.

**Docs split (not flagged in the spine):**

| Page | Installs |
| --- | --- |
| `/agents/overview/`, `/agents/operate/safety/` | `@superdoc/sdk` |
| `/document-engine/sdks`, `/ai/agents/integrations` | `@superdoc-dev/sdk` |

Both packages are live. They are not the same version line (2.8.0 vs 1.21.3). The spine correctly follows the agents/safety pages and the 2.x package. The Document Engine SDK page is stale relative to that choice and still documents `onMissing` (see §3).

### SDK wraps CLI / process boundary — **confirmed for `@superdoc/sdk` 2.8.0**

- npm description: wraps the CLI.
- Agents + Document Engine SDK pages: “They manage the CLI process for you.”
- 2.8.0 types: spawn/embedded CLI (`resolveEmbeddedCliBinary`, `SuperDocCliError`, `processMode: 'cli' | 'document'`).
- Companion hedge (“or whatever process model that SDK version actually uses”) matches the types: default is embedded CLI; `documentHostPath` is an alternate host.

AD-7 is directionally right. It overstates “the CLI process” as the only runtime. It also overstates the need to npm-install `@superdoc/cli`.

Native `@superdoc/sdk-linux-x64` on Chainguard `node-fips:20` (FIPS, digest-pinned) was **not** executed in this review. libc flavor is not declared on the platform package. That is an unproven deploy assumption, not a docs error.

### SDK can join v2 collaboration rooms — **confirmed**

Document Engine SDKs page: `client.open({ collaboration: { providerType: 'hocuspocus', url, documentId } })` or `collabUrl` + `collabDocumentId` (y-websocket shorthand). If the room has content, `doc` is ignored; if empty, `doc` seeds.

`@superdoc/sdk` 2.8.0 `DocOpenParams` includes `collaboration.providerType: 'y-websocket' | 'hocuspocus' | 'liveblocks'`, `url` / `documentId` / `roomId`, and **`roomMode?: 'join' | 'create'`**.

### v1 / v2 room incompatibility — **confirmed**

[Migrate from v1](https://docs.superdoc.dev/editor/migrate-from-v1/overview/):

> V2 collaboration rooms use a different document format and require a separate migration. Do not connect a v2 editor directly to an existing v1 collaboration room.

Also: v1 `modules.collaboration = { ydoc, provider }` is not the v2 contract; v2 uses `document.v2Collaboration` and explicit create/join.

AD-9 is sourced. Leftover `/guides/collaboration/hocuspocus` still shows the v1 `{ ydoc, provider }` shape — the spine correctly ignored that page for the target.

### Create vs join — **confirmed (browser); SDK field name drifted**

[Connect to a collaboration room](https://docs.superdoc.dev/editor/collaboration/): `roomMode: 'create' | 'join'`. “V2 does not provide a join-or-create mode. Creating an existing room or joining a missing room fails.”

That is AD-9. The 2.8.0 SDK types use the same `roomMode` field.

The companion’s “always use `onMissing: 'error'`” text is from `/document-engine/sdks` (`@superdoc-dev/sdk`). **`onMissing` does not appear anywhere in `@superdoc/sdk` 2.8.0 types.** Reopen safety for the pinned SDK is `roomMode: 'join'`, not `onMissing`.

---

## 3. Starter defaults the spine leaned on

### SuperDoc v2 collaboration example — **spine did not use the live starter**

[Run a collaboration server](https://docs.superdoc.dev/editor/collaboration/run-a-server):

- `pnpm add @hocuspocus/server` — **unpinned**
- Standalone `Server.configure({ port: 1234 })`
- In-memory rooms; process restart clears them
- Two browsers: first `roomMode: 'create'`, second `roomMode: 'join'`
- Not Fastify, not one Cloud Run port

Companion §10: “pins `@hocuspocus/server` 4.6.0 because that is the v2 example server.”

That sentence is **false** against the repo SuperDoc actually ships:

`github.com/superdoc/docx-editor` (v2 monorepo), 2026-09-03:

- workspace catalog: `@hocuspocus/server` **^2.13.6**, `@hocuspocus/provider` **^2.13.6**
- `examples/collaboration/package.json`: `"@hocuspocus/server": "^2.13.6"`
- `pnpm-lock.yaml` resolves that example to **2.15.3**
- `superdoc` 2.11.0 peers `@hocuspocus/provider` **^2.13.6**
- `@superdoc/cli` 0.31.0 depends `@hocuspocus/provider` **^2.13.6**

npm `@hocuspocus/server@4.6.0`:

- `engines: { "node": ">=22" }`
- README: “runs on Node.js (22+)”
- Uses `crossws`; attach model is `Hocuspocus.handleConnection`, not the v2 example’s simple `Server.configure({ port })` plus this repo’s `@fastify/websocket` welcome() pattern

Following the **docs page** unpinned `pnpm add` today would install 4.6.0 and break the Node 20 / Chainguard envelope. Following the **example package.json** would install 2.15.x and stay on Node 20.

**Required correction:** pin SuperDoc’s 2.x Hocuspocus line (or explicitly justify 4.x after a Node 22 upgrade and a provider-compat test). Do not call 4.6.0 “the v2 example server.”

AD-15 (one Fastify `PORT`) is a **this-repo / Cloud Run** constraint, confirmed in `config/env.ts` (`COLLAB_PORT = REST_PORT`) and `app.ts`. It is not a SuperDoc starter default. Mounting Hocuspocus 2.x on the existing `@fastify/websocket` listener is plausible; mounting Hocuspocus 4.x on Node 20 Fastify is unproven and engine-blocked.

### SDK “CLI bundled, no separate install”

True for `@superdoc/sdk` (platform optional deps) and for the Document Engine page’s `@superdoc-dev/sdk`. The spine stack row for `@superdoc/cli` 0.31.0 is a **shell/CI package**, not the host’s required install.

---

## 4. Decision-by-decision

| ID | Reality basis | Status |
| --- | --- | --- |
| AD-1 Document API is the only writer | Mental model + agents overview; current `editor/replace.ts` / `insert.ts` are the second writer the rule prevents | Sourced |
| AD-2 `@superdoc/sdk` only; no `@superdoc/headless` / adapter / v1 Editor | Agents overview + migrate-from-v1; npm 2.8.0 exists; v1 write path is `@harbour-enterprises/superdoc` 1.46.x + JSDOM in `editor/editor.factory.ts` | Sourced. Flag the `@superdoc-dev/sdk` docs split. |
| AD-3 Query / public IDs, not PM offsets | Mental model + overview (`paraId` / `NodeAddress` / no `sdBlockId`); current agent contract is `from`/`to` in `routes/replace.route.ts` | Sourced |
| AD-4 Atomic mutation plans | mutation-plans page | Sourced |
| AD-5 Tracked by default | Safety: engine default is **direct**; tracked is host policy. Spine is explicit about that. | Sourced as policy |
| AD-6 Handle lifecycle; last-good DOCX | Safety close/save; last-good DOCX is host persistence (current Redis is YDoc-centric in `infra/persistence.ts`) | Policy + brownfield. Durable-DOCX choice is this design, not a SuperDoc product default. |
| AD-7 Engine behind SDK process | SDK 2.8.0 + docs. Over-precise on “CLI process” and on installing `@superdoc/cli`. Chainguard binary fit unverified. | Mostly sourced; packaging overstated |
| AD-8 Isolated DOCX vs shared v2 room | SDK open({ doc }) vs open({ doc, collaboration }); migrate-from-v1 forbids dual-format rooms | Sourced. Companion `onMissing` is the wrong field for 2.8.0. |
| AD-9 v2 rooms only; create/join explicit | migrate-from-v1 + editor/collaboration `roomMode` | Sourced. Hocuspocus **version** is not. |
| AD-10 Last-good DOCX durable; export distinct | Safety “write to a separate output” + `close({ discard: true })`; export-as-new-artifact is host policy | Sourced as policy |
| AD-11 This host stays the agent HTTP boundary | Brownfield `justitia-agent` SUPEREDITOR tools + AGENTS.md | Sourced from this org’s consumers, not SuperDoc |
| AD-12 Explicit author; missing user is 400 | Safety + SDKs (default `CLI`). **Today upload defaults to anonymous** (`routes/upload.route.ts`). 400 is a tightening, not current behavior. Open() typed fields are `userName` / `userEmail`; client options take `user: { name, email? }`. | Policy sourced; HTTP 400 and `client.open({ user })` shape are host inferences |
| AD-13 Receipts + one stale retry | receipts-and-errors — verbatim codes and “retry once / keep expectedRevision” | Sourced |
| AD-14 No document text in telemetry | Safety + existing Amplitude/OTEL in this repo | Sourced |
| AD-15 One Cloud Run port; no boot kill | `server.ts` has no `lsof` kill; `COLLAB_PORT = REST_PORT`; AGENTS.md documents the Chainguard SIGKILL incident | Sourced from this repo. SuperDoc example is a second port (1234). |
| AD-16 Compat then delete v1 write stack | Host migration policy; files to delete (`editor/replace.ts`, `insert.ts`, `createHeadlessEditor`) exist | Sourced from brownfield |
| AD-17 404 / 400 / 503 frozen | `sessions/session.middleware.ts` 404; paragraph routes 400; `infra/memory-guard.ts` 503 + `Retry-After`; `routes/AGENTS.md` + justitia-agent helper notes | Sourced from this repo |

Consistency conventions (NodeAddress, isolated vs shared mode, room create/join, no agent accept/reject, facade must not reopen JSDOM) match the docs and code cited above.

Deferred items (Liveblocks, MCP / `createAgentToolkit`, Python `superdoc-sdk` bypass, content controls, version history) all still exist as SuperDoc surfaces and are correctly left out of this host.

Open questions (CLI RSS on 8 GiB, sidebar v2 date, fail-closed `from`/`to`) remain open. 8 GiB / 7680 MB is real (`Dockerfile` `NODE_OPTIONS=--max-old-space-size=7680`, `MEMORY_GUARD_RSS_MB` default 7680).

---

## 5. Brownfield claims that were actually checked

Confirmed in this tree:

- One listen port; websocket on Fastify (`app.ts`, `collaboration/websocket.ts`, `config/env.ts`).
- No startup process kill (`server.ts`).
- `GET /health` exists.
- Admission 503 + `Retry-After` (`infra/memory-guard.ts`).
- Session missing → 404; paragraph/content failures → 400 (`routes/AGENTS.md`, `paragraph-edit.route.ts`).
- Current write path is JSDOM `createHeadlessEditor` + homemade `trackInsert` / `trackDelete` (`editor/editor.factory.ts`, `editor/replace.ts`).
- v1 collab is `@superdoc-dev/superdoc-yjs-collaboration` 1.0.2; accept requires an in-memory session (`collaboration/websocket.ts`).
- `SUPERDOC_PUBLIC_LICENSE_KEY` is required at process start and passed into the v1 Editor (`config/env.ts`, `editor/editor.factory.ts`).
- README still documents a second `COLLAB_PORT` — companion is right that README is stale.

Memlog constraint “keep a SuperDoc license identity” is **not** in the spine Stack or ADs. Whether `@superdoc/sdk` 2.8.0 still needs `SUPERDOC_PUBLIC_LICENSE_KEY` was **not** found in the 2.8.0 type surface (no license field in `SuperDocClientOptions` / `DocOpenParams`). That is an unverified cutover item, not a confirmed “drop the key.”

Current upload still invents `anonymous@sidebar.com` when user is missing. AD-12’s 400 is a behavior change.

---

## 6. Findings

### F1 — High — `@hocuspocus/server` 4.6.0 is not SuperDoc’s v2 starter and fights Node 20

Companion presents 4.6.0 as “the v2 example server.” SuperDoc’s v2 monorepo example and catalog pin **^2.13.6** (resolved **2.15.3**). `superdoc` 2.11.0 and `@superdoc/cli` 0.31.0 still depend on **provider 2.13.6**. Hocuspocus **4.6.0 requires Node >= 22**. The spine also pins Node 20 + Chainguard `node-fips:20`.

This is the clearest “asserted from npm latest / training-adjacent latest” miss. Shared-room step 4 cannot take 4.6.0 as settled.

### F2 — High — Two live Node SDK identities; companion copied the wrong collab reopen knob

Pinned package `@superdoc/sdk` 2.8.0 is real and is what agents/safety docs install. `/document-engine/sdks` still installs `@superdoc-dev/sdk` and documents `onMissing: 'error'`. **2.8.0 types have `roomMode`, not `onMissing`.** Shared-mode reopen text in the companion is therefore not reality-checked against the package the spine committed to.

### F3 — Medium — Stack row `@superdoc/cli` 0.31.0 is not how `@superdoc/sdk` 2.8.0 loads the engine

SDK 2.8.0 pulls `@superdoc/sdk-<platform>` binaries. Installing `@superdoc/cli` additionally pulls `superdoc` 2.11.0 + `happy-dom` + Hocuspocus provider 2.x into the API image — the opposite of AD-7’s “no JSDOM SuperDoc in the Fastify heap” if anyone imports it. Keep CLI as a documented sibling surface, not a host dependency, unless a measured reason appears.

### F4 — Medium — Hocuspocus-on-Fastify-same-port is a host invention, not a starter default

SuperDoc’s example listens on **1234** alone. This repo’s one-port rule is correct for Cloud Run. Combining them needs an explicit adapter design (Hocuspocus 2.x `handleConnection` vs current `SuperDocCollaboration.welcome`). 4.x `crossws` was not checked against `@fastify/websocket` 11.x.

### F5 — Low — Version table mixes ranges, locks, and latest

- ioredis: claimed 5.8.2 / lock **5.9.3** / npm latest **6.0.0**
- yjs: claimed 13.6.18 / lock **13.6.19** / npm latest **13.6.32**
- Fastify: repo 5.8.5 / latest 5.12.1 (already disclosed)
- `@harbour-enterprises/superdoc`: lock 1.46.2 / latest 1.46.3
- `package.json` `engines.node` is `>=18`, not 20

None of these break the design. They show the stack table was not lockfile-checked.

### F6 — Low — License key and SDK `runtime: 'v1' | 'v2'` omitted

Memlog requires keeping SuperDoc license identity. Spine is silent. 2.8.0 client options include `runtime?: 'v1' | 'v2'`. A host that forgets to pin `runtime: 'v2'` can reopen the v1 engine the redesign is deleting. Not a version lie; an unconfirmed default.

### F7 — Info — Leftover SuperDoc v1 guides still look current

`/guides/collaboration/hocuspocus` and `/editor/collaboration/overview` still teach `modules.collaboration = { ydoc, provider }`. The spine used the v2 pages. Anyone implementing from the leftover guides would rebuild the current host. Call that out in the companion; do not “fix” AD-9.

---

## 7. What does *not* need a flag

These were asserted *and* re-confirmed:

- Document API as the mutation contract; receipts; one stale retry; tracked-as-host-default; no clause text in logs; no generic CLI author.
- Do not import `@superdoc/headless` / `@superdoc/document-api-v2-adapter`.
- SDK can join the same v2 room as `superdoc` 2.11.0 / `v2Collaboration`.
- v1 Yjs rooms are a different format; sidebar v2 gates shared mode.
- `@superdoc/sdk` 2.8.0, `@superdoc/cli` 0.31.0, `superdoc` 2.11.0, Fastify 5.8.5-in-repo, Node 20, harbour 1.46.x latest 1.46.3 — versions exist as claimed.
- 404/400/503 meanings, one `PORT`, no boot `lsof | kill`, 8 GiB / 7680 MB guard — this repo.
- Deferred Liveblocks / MCP / Python bypass / agent accept-reject.

---

## 8. Unverified (not disproven)

- Measured CLI / platform-binary RSS vs 8 GiB (already an open question).
- Whether `@superdoc/sdk-linux-x64` 2.8.0 runs on Chainguard `node-fips:20`.
- Whether `@superdoc/sdk` still needs `SUPERDOC_PUBLIC_LICENSE_KEY`.
- Protocol compatibility of Hocuspocus **server 4.x** with SuperDoc’s **provider 2.13.6** (do not assume yes).
- Fastify 5.8.5 + `@fastify/websocket` 11 + Hocuspocus 2.x or 4.x on one Cloud Run port.
- angular-frontend SuperDoc v2 ship date (open question; not researched here).
- justitia-agent source was not in this workspace; 404/503 behavior is taken from this repo’s AGENTS.md / route comments.

---

## 9. Finalize bar

Before this spine is treated as build-substrate:

1. Replace or justify `@hocuspocus/server` 4.6.0 against SuperDoc’s **^2.13.6** example and Node 20. State `engines` if 4.x is kept.
2. State that Node integration is `@superdoc/sdk` 2.8.0 (platform binaries), that `@superdoc-dev/sdk` docs are a parallel stale line, and that reopen uses **`roomMode`** on 2.8.0 — not `onMissing`.
3. Demote `@superdoc/cli` from “host stack” to “CLI surface / bundled binary,” unless a separate install is required.
4. Optionally align the version table to lockfile vs latest (ioredis, yjs) and record the license-key / `runtime: 'v2'` cutover questions.

Document API decisions AD-1, AD-3–AD-6, AD-10, AD-13, AD-14, AD-16–AD-17 do not need re-litigation for version drift as of this re-check.
