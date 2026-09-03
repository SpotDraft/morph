# Adversarial review — SuperDoc Document-Engine Host spine

- **Spine:** `docs/architecture/architecture-superdoc-redesign-2026-09-03/ARCHITECTURE-SPINE.md`
- **Companion (context only, not binding):** `ARCHITECTURE-REDESIGN.md`
- **Date:** 2026-09-03
- **Altitude attacked:** initiative spine → one level down (features / epics)
- **Method:** two next-level units, each obeying AD-1–AD-17 and every Consistency Convention *to the letter*, composed into an unshippable host
- **Focus:** holes a later implementer of `routes/document-api`, `routes/compat`, `collaboration` rooms, or `persistence` can hit while still claiming AD compliance

Companion text is cited only when it shows a freedom the spine left open, or a brownfield tripwire the spine did not close. It is not treated as a decision.

---

## Verdict

**The spine does not yet constrain a build.** It successfully forbids a second JSDOM editor and a host-owned PM→Yjs converter. It does not name a single owner, a single durable document, a single HTTP envelope, or a single recovery rule for the entities every next-level unit must share.

Two complete epic cuts — **Alpha (handle-centric isolated host)** and **Beta (room-centric shared host)** — can each satisfy every AD on the page. Integrated, they produce:

1. two durable copies of one document with opposite cold-start winners
2. two owners of session mode, room identity, and last-good write
3. two mutation paths (host SDK handle vs in-room browser engine) that never share a receipt
4. two HTTP contracts for the same SuperDoc operations
5. two legal resolutions of AD-1 vs AD-10 (may a collaboration adapter persist Yjs?)

That is not residual product taste. It is missing architecture. Each pair below is a hole that needs a new or tightened AD before `bmad-create-epics-and-stories` or implementation.

**Do not start cutover step 1 from this spine as written.**

---

## 1. Method

A spine at initiative altitude is a build substrate: next-level units must be able to implement in parallel without re-deciding shared types, owners, or write paths.

Attack:

1. Descend one level to the structural seed: `routes/document-api`, `routes/compat`, `collaboration`, `persistence` (plus `documents/` / `hosts/` as the implied session/handle owners).
2. For each pair, construct two feature specs that quote ADs for every choice.
3. Show the clash: shared-data shape, dual ownership, or conflicting mutation path.
4. Name the AD that must be added or tightened so only one of the two specs remains legal.

Letter-of-the-AD tricks used throughout (these are the spine's own escape hatches, not strawmen):

| Hatch | Where | How a compliant unit uses it |
| --- | --- | --- |
| Open question, not a rule | Spine Open Questions; AD-3 + AD-16 | Facade may fail closed *or* project `from`/`to` through a one-revision extract/source map |
| `Hocuspocus or y-websocket` | AD-9 | Rooms and sidebar-viewer pick opposite providers |
| Recover from last-good **or** live v2 room | AD-6 | Persistence always seeds last-good; rooms always restore the Yjs blob |
| Cold start **must** seed from last-good | AD-10 | Opposite of the AD-6 "or room" clause after a deploy |
| Room state **may** be persisted for presence | AD-10 | Presence = awareness JSON, *or* the full room document |
| Must not write Yjs except engine export | AD-1 | Strict rooms persist no Yjs; loose rooms persist the Hocuspocus doc as "room state" |
| Upload **or** first human join sets mode | Convention | `documents/` writes mode at upload; `collaboration/` writes mode on first WS |
| Preview is not a lock | AD-4 | Concurrent room edits are in-bounds; nobody owns the race |
| "Missing user identity is a 400" | AD-12 | `{ userid: "anonymous" }` is present identity, *or* it is missing identity |
| New routes expose Document API shapes | AD-11 | HTTP envelope is unspecified; SuperDoc types may be wrapped, sliced, or aliased at the wire |
| Persist after a successful **mutation batch** | AD-10 | A comment, a `trackChanges.decide`, a single `replace`, or only `mutations.apply` counts as a batch |
| Bind lists omit siblings | AD-2, AD-3 | Collaboration and persistence are not bound to SDK-only / query-only, so they invent coordinates |

---

## 2. Two next-level units (each fully AD-compliant)

These are the two features a later `bmad-create-epics-and-stories` run could emit from the same spine. Every bullet cites the AD that legalizes it.

### Feature Alpha — Handle-centric isolated host

*Owners it assumes:* `documents/` (session + handle), `routes/document-api`, `persistence/` as a dumb Redis adapter.

- Every HTTP mutation is a Document API call on a host-bound SDK handle (AD-1, AD-2).
- Request loop is `open → operate → inspect receipt → persist last-good DOCX → close` (AD-6, AD-13). Warm handle is optional cache; eviction always reopens from last-good bytes (AD-6, AD-10).
- Default `accessMode: isolated` at upload. Shared mode is not production until sidebar v2; until then no room is created (AD-8, AD-9).
- Cold restart always seeds from last-good DOCX. Room bytes, if any, are presence-only awareness and are never a document body (AD-10 letter: "a cold restart must be able to seed from last-good DOCX"; "Room state may be persisted for presence").
- Collaboration adapter does **not** write Yjs fragments. AD-1 binds collaboration adapters. Room hosting on `PORT` is a websocket upgrade that joins SuperDoc v2; persistence of the room document is refused as an AD-1 write (AD-1, AD-7, AD-15).
- Canonical HTTP is SuperDoc names copied into `POST /document/*` bodies plus `sessionId`. Mutation responses are full receipts. `expectedRevision` is required (AD-3, AD-11, Convention).
- Compat facade translates paragraph/query payloads into the same handle loop. Legacy `{ from, to }` **fails closed** (AD-3: do not derive locations from rendered HTML or copied PM positions; AD-16: do not reimplement `from`/`to` as the long-term model; Open Question allows fail-closed).
- Upload without a real user is 400. `client.open` always receives that user (AD-12).
- Multi-edit is `mutations.preview` then `mutations.apply` `{ atomic: true }` (AD-4). Compat `/replace-all` is one such apply.
- `changeMode` defaults to `tracked`. Compat never offers `direct` (AD-5).
- Stale revision: documents-layer retries once, never drops `expectedRevision` (AD-13).
- After export: distinct artifact, discard working copy, last-good unchanged, session remains (AD-10).
- One Fastify `PORT`; no boot-time process kill (AD-15).
- Status: unknown session 404; bad target / ambiguous / validation 400; admission 503 + `Retry-After` (AD-17).
- No JSDOM, no `@harbour-enterprises/superdoc` write path, no `@superdoc/headless` (AD-2, AD-16).

Alpha is a legal reading of the spine. It is the isolated-first cutover the companion sketches in steps 1–3.

### Feature Beta — Room-centric shared host

*Owners it assumes:* `collaboration/` (live document + mode flip), `routes/compat` (agent traffic still on old paths), `persistence/` as Yjs + DOCX store.

- Every *host* document change is still a Document API operation on a bound handle. The handle is opened with `{ doc, collaboration }` so the engine mutates the room, not a private DOCX (AD-1, AD-8). Browser edits are Document API on the *browser* bound handle (`superdoc.activeEditor.doc`). The host does not invent a second editor or converter (AD-1 Prevents; AD-8).
- Upload always returns `collaborationUrl` (brownfield + companion §6.1). Beta therefore sets `accessMode: shared` at upload — "set at upload or first human join" (Convention). Agent-only work still goes through a handle that is in the room; there is no second REST document to sync (AD-8: "Never maintain a REST document and a collaboration document that are synced by a host-owned converter").
- New rooms are SuperDoc v2 via **y-websocket** (AD-9 explicitly allows Hocuspocus *or* y-websocket). Path stays `/collaboration?room=<sessionId>` so current `superdocSocketUrls` keep working (AD-15: share `PORT`; path unspecified).
- Room create happens at upload (explicit create). Later SDK/browser connects are join. Creating an existing room or joining a missing room fails (AD-9, Convention).
- After a successful mutation batch, persist last-good DOCX *and* persist room state. Room state is the Hocuspocus/y-websocket Yjs document, persisted "for presence" so a restart can re-attach presence *and* the live body (AD-10 MAY). Crash recovery reopens from the **live v2 room** when room bytes exist (AD-6 "or from the live v2 room"). Last-good is the isolated-shaped fallback required by AD-10, used only when the room blob is missing.
- Collaboration *may* write Yjs fragments: they are not host-invented document mutations; they are the v2 room protocol the stack table lists (`yjs` "room persistence only"). AD-1's ban is read as banning a *custom* Yjs bridge, which AD-8 already names ("custom ProseMirror-to-Yjs dual-write"). Official room persistence is not that bridge.
- Compat is the agent HTTP boundary during the dual-write window (AD-11, AD-16). `/search` uses `query.match` `{ require: 'any' }` and **may still include a deprecated range field** (companion §6.2; spine does not forbid the field). `/replace { from, to }` is translated through a **one-revision `extract()` character map** — not rendered HTML, not a copied PM position, so AD-3's last sentence is not hit. The Open Question explicitly permits this attempt.
- Upload continues to accept a missing `user` by storing `{ userid: "anonymous", username: "Anonymous User" }` (today's `UserInfo`). Identity is not missing; AD-12's 400 does not fire. `client.open` receives that session user.
- One independent compat `/replace` uses the matching direct operation (AD-4). `/replace-all` is one atomic plan. Preview is not a lock.
- `changeMode: tracked` unless the caller sends an explicit `direct` flag (AD-5). Compat exposes the flag on the old body so mechanical cleanup can request it.
- Stale revision: the **route** retries once (AD-13 binds "all mutations", not a layer). Receipts are inspected before persist. HTTP responses on old routes stay `{ success }` because AD-11 says those routes are a facade only — the *host* inspects the receipt; the agent contract is not required to grow receipt fields.
- Export writes a distinct artifact and discards the working copy (AD-10). Compat `/export` also schedules session eviction as today — AD-10 does not say the session survives export; it says export is not the only copy of the pre-export document. Last-good remains until TTL/cleanup.
- Receipt failure after retry is mapped to **400** as a context-guard / missing-target failure (AD-17). `receipt.success: false` is never returned as HTTP 200 on facade routes (old agent checks HTTP, not receipts).
- JSDOM write helpers are unused by new traffic (AD-16). v1 collaboration is not used for new rooms (AD-9).

Beta is also a legal reading of the spine. It is the "shared room is the consistency answer" picture in companion §4.4–§5.6, plus the brownfield agent/sidebar contracts the spine never superseded.

### Why Alpha + Beta cannot ship together

Alpha's document-api implementer and persistence implementer will build Alpha. Beta's rooms implementer and compat implementer will build Beta. The structural seed *invites exactly that split*. The rest of this review is the incompatibility matrix of that split, plus the intra-seed pairs that fail even if both sides aim at the same cut.

---

## 3. Pairwise holes

Each subsection is one implementer pair. **A** and **B** are both letter-compliant. The clash is the hole. The closer is the AD to add or tighten.

---

### 3.1 `persistence` vs `collaboration` — two durable documents, opposite recovery

**The worst hole. Shared-data shapes, dual ownership, and conflicting mutation paths at once.**

#### Shared-data shapes that clash

| Field | Persistence (Alpha reading) | Rooms (Beta reading) |
| --- | --- | --- |
| Live document | CLI working copy behind a handle; not stored | v2 room Yjs document |
| Durable document | `last-good` DOCX bytes keyed by `sessionId` | Room blob (`superdoc:doc:*` / new `superdoc:room:*`) **plus** last-good as seed |
| "Presence" | Awareness JSON or nothing | Full Y.Doc snapshot + awareness |
| Recovery source after deploy | Last-good DOCX (AD-10) | Persisted room (AD-6 "live v2 room") |
| Redis delete on session delete | meta + last-good | room keys; meta may be left to persistence |
| TTL refresh | On last-good write | On room persist / WS activity |

Spine stack: `yjs (room persistence only)`. Spine AD-10: last-good is *the* durable artifact; room state *may* be persisted for presence. Those two sentences do not name a type for "room state" or a winner when last-good and room diverge.

#### Two owners of one entity

**Entity: the recoverable document for session S.**

- Persistence owns `last-good` and, citing AD-10, will **overwrite the room from last-good on cold start**. Human in-room edits that never produced a host receipt are discarded. Compliant: "After a successful mutation batch, persist last-good"; browser edits are not a host mutation batch; "cold restart must be able to seed from last-good".
- Rooms own the v2 document and, citing AD-6, will **restore the room blob and ignore last-good if the blob exists**. Host agent edits that persisted last-good but failed to flush into Redis room keys (AD-1-strict rooms refuse to write Yjs) are discarded. Compliant: "reopen from last-good DOCX **or** from the live v2 room".

No AD names a single owner or a compare rule (`afterRevision`, timestamp, vector).

**Entity: session `accessMode`.**

- Convention: set at upload **or** first human join, not inferred per request.
- `documents/` / persistence write `isolated` at upload (Alpha).
- `collaboration/` writes `shared` on first WS join (Beta; "first human join").
- A concurrent `POST /document/replace` still sees `isolated`, opens last-good, mutates, persists last-good. The room, just seeded, is a second document. This is not a "host-owned converter" (AD-8 Prevents). It is two legal opens of two access modes in the same millisecond. The convention forbids inferring mode *per request*; it does not make the join→mode write atomic with handle open.

**Entity: room id / `documentId`.**

- Companion (not binding) says `documentId: sessionId`.
- Spine never says that.
- Rooms may use `sessionId`, `room:${sessionId}`, or `fileName`.
- Persistence keys last-good by `sessionId`.
- SDK `open({ collaboration: { documentId } })` is called from `documents/` / document-api. If `documentId !==` persistence session key, shared open joins the wrong room or `onMissing: 'error'` (companion) / "joining a missing room is an explicit failure" (AD-9).

**Entity: room create.**

- AD-9 + Convention: create and join are separate; creating an existing room fails.
- Beta rooms: create at upload.
- Alpha/Beta document-api: `client.open({ doc, collaboration })` seeds an empty room (companion §4.4; spine does not forbid SDK seed). Seed is a create.
- First shared open after rooms-create: **creating an existing room → explicit failure**. Session is uploaded and unusable. Each side cites AD-9.

#### Conflicting state-mutation paths

1. **Host receipt path (document-api / compat):** SDK mutate → `receipt.success` → persist last-good (AD-10, AD-13). Room Yjs is updated only if the handle was opened in shared mode *and* the engine broadcasts into the room.
2. **Browser path (rooms):** in-editor Document API → engine in the room. No host receipt. Last-good is not updated (AD-10 is "after a successful mutation batch" — the host had none).
3. **Room persist path (Beta rooms):** Hocuspocus onChange → Redis Yjs. AD-1-strict Alpha rooms refuse this write.
4. **Cold-start seed path (Alpha persistence):** last-good DOCX → new room. This *is* a host-owned body copy from one store into another. AD-8 bans a converter between a REST document and a collaboration document; Alpha claims last-good is not a REST document, it is the durable artifact. Beta claims the seed just blanked the real document.

After a human types, then Cloud Run restarts:

- Alpha persistence: seed last-good → human edits gone.
- Beta rooms: restore Yjs → last-good stale; next isolated-shaped open (if mode bit was never flipped, or was flipped back) reloads last-good and fights the room.

#### Closer

New **AD-Recovery** and **AD-Mode**:

- Isolated: last-good is the only durable body; no room keys exist.
- Shared: the room is the only live body; last-good is a host-owned snapshot taken only by `documents/` via engine export, on a defined schedule (successful host receipt **and** last-client-disconnect / periodic flush).
- Cold start, shared: restore room blob if present; seed from last-good **only** when the room is missing; never seed last-good over an existing room.
- `roomId` / SDK `documentId` / WS path id **are** `sessionId`.
- Provider is one name (Hocuspocus **xor** y-websocket), not an or.
- `accessMode` has one writer (`documents/`). Upload writes `isolated` unless the caller requested shared. First human join calls `documents.promoteToShared()` which creates-or-fails the room, seeds if empty, then flips the bit **before** any SDK shared open. Document-api / compat refuse isolated open when mode is shared, and refuse shared open when mode is isolated.
- Room create is that promote (and optional shared upload). SDK `open({ collaboration })` is join-only (`onMissing: 'error'`). No second create.

---

### 3.2 `routes/document-api` vs `routes/compat` — two HTTP documents, two success contracts

#### Shared-data shapes that clash

Spine AD-11: new routes expose Document API shapes; old routes are a facade. Convention: SuperDoc names are not renamed. The **HTTP envelope** is unstated: path vs body, wrapping, required fields, what a facade may omit.

| Wire value | Document-api (Alpha) | Compat (Beta) |
| --- | --- | --- |
| Search / query in | `{ sessionId, select, require }` SuperDoc `query.match` | `{ sessionId, phrase }` |
| Search / query out | SuperDoc items, targets, refs, `evaluatedRevision` | `{ results, count }` plus deprecated `{ from, to }` (companion §6.2) |
| Replace in | `{ target \| ref, text, expectedRevision, changeMode }` | `{ from, to, text }` or `{ paraId, oldText, newText, expectedContext }` |
| Replace out | SuperDoc receipt (`success`, `failure.code`, before/after revision, tracked-change ids) | `{ success }` or paragraph `{ success, paraId, updatedRange, matchCount, ... }` |
| Content read | `extract` / `info` SuperDoc blocks | `get-content` HTML/text + optional `range` + homemade paragraph metadata |
| Comment create | `comments.create` + query target | `{ text, selection: { from, to } }` (today's `/add-comment`) |
| Comment id | SuperDoc comment id | Host `crypto.randomUUID()` mapped into Word (today) |
| Plan | Caller-supplied steps + step ids | Host-built plan from `/replace-all` matches |
| `require` default | `exactlyOne` (companion safety; spine silent) | `any` on `/search` |
| `expectedRevision` | Required on every mutation (AD-3) | Absent on old payloads; invented from last extract map or last query |
| User | Required on open / maybe on every request | Session user from upload, possibly anonymous |

An agent (or a dual-writing justitia-agent during cutover) that queries on `/document/query` and mutates on `/replace-in-paragraph`, or searches on `/search` and mutates on `/document/replace`, cannot form a legal target. Refs are valid only for the `evaluatedRevision` that produced them (Convention). Compat ranges are not refs. Document-api targets are not `{ from, to }`.

AD-3 binds routes and agent-tools: locate with `query.match`, `extract`, or `NodeAddress`; keep `expectedRevision`; do not derive from rendered HTML or copied PM positions. Beta's extract-map for `{ from, to }` claims compliance because the map is a fresh `extract()` at this revision, not HTML and not PM. Alpha's fail-closed claims compliance from the same AD's "not the long-term targeting model" (AD-16) and the "do not derive from rendered HTML" sentence if anyone uses `projectHtml` source maps (the Open Question's other option). **The Open Question and AD-3 are not the same decision.** Two facades ship.

#### Two owners of one entity

**Entity: the agent-visible operation result.**

- Document-api owns receipts (AD-13). HTTP 200 + `receipt.success: false` is a legal "call succeeded, mutation did not."
- Compat owns today's `{ success }` and AD-17 status mapping. A failed engine receipt becomes **400** (missing target / context-guard). After one stale retry, `REVISION_MISMATCH` is still not in AD-17's list. Alpha returns 200+receipt; Beta returns 400; a third reading returns 409 or 503.

justitia-agent treats **404 as expiry** and retries **429/503** only (brownfield; AD-17 freezes 404/400/503 but does not map receipt codes onto them). A 200 with `success: false` is a silent miss for old tools. A 400 is "fix the request." Same engine failure, opposite agent behavior, both AD-compliant.

**Entity: retry.**

- AD-13: on the stale family, re-query and retry **once**. Never drop `expectedRevision`.
- Alpha: `documents/` retries; routes do not.
- Beta: each facade route retries; if it also calls `documents/`, that layer retries too → up to two retries, or a retry that is no longer "once."
- A third reading: AD-13 binds "all mutations" so *both* layers must retry if they mutate. The spine does not name the retry owner.

**Entity: `changeMode`.**

- AD-5: default `tracked`; `direct` needs an explicit caller flag and is limited to mechanical work. "Mechanical" is undefined.
- Alpha document-api: exposes `changeMode`; default tracked; `direct` accepted whenever the flag is present (the flag *is* the limit).
- Alpha compat: never `direct`.
- Beta compat: accepts `direct` on the old body for "mechanical" replace-all of NBSP / whitespace (self-declared mechanical).
- Same clause, one path leaves a tracked mark, the other rewrites silently. Both cite AD-5.

**Entity: comments and track-changes.**

- Seed puts comments/review on `routes/document-api`.
- Brownfield `/add-comment`, `/get-comments` stay as facade (AD-11).
- Two writers create comments on the same document via Document API (AD-1 satisfied) with different ids, authors, and anchors (selection vs query target). Persistence that keys comments in session meta (not forbidden) fights SuperDoc-owned comments inside last-good / the room.

#### Conflicting state-mutation paths

- Document-api `/document/mutations/apply` with `atomic: true`.
- Compat `/replace-all` builds its own atomic plan of `text.rewrite` (companion §6.2).
- Compat `/replace` fires a direct operation (AD-4 "one independent edit").
- A dual-writing agent issues `/replace-all` and `/document/mutations/apply` in one turn. Two plans, two `expectedRevision`s, two last-good writes. Preview is not a lock (AD-4). AD-4 prevents *partially applied multi-step agent turns* inside **one** apply, not across two HTTP APIs.

Compat `/replace { from, to }` via extract-map vs document-api `/document/replace` via `query.match`: both write through the SDK (AD-1, AD-16), so they are not a second editor. They are two targeting systems on one handle. After the first write, the other system's coordinates are stale. Each retries once (AD-13) and then returns its own error shape.

#### Closer

Tighten **AD-3, AD-11, AD-13, AD-17**; add **AD-Envelope**:

- Canonical wire types are SuperDoc's, wrapped only by `{ sessionId }` (and host admission fields). No renamed receipt fields.
- Facade may keep old **request** names while justitia-agent still emits them. Facade **must not** emit writable `from`/`to` / `updatedRange` / PM `selection`. Search ranges, if present, are deprecated display-only and must not round-trip into any mutate. Legacy `{ from, to }` and `{ position }` **fail closed 400**. Close the Open Question.
- Every host mutation response the new agent tools see includes a receipt. Facade may additionally keep `{ success }` **equal to** `receipt.success`.
- HTTP mapping (frozen): session missing/expired → 404; `receipt.success === true` and persist ok → 200; `TARGET_NOT_FOUND`, `ADDRESS_STALE`, ambiguous match, validation, context-guard, `REVISION_*` / `STALE_*` after the single retry → 400; persist/engine-worker/admission failure → 503 + `Retry-After`; never 200 + failed receipt on facade routes the old agent still calls.
- Retry owner is `documents/` only. Routes call it once via the handle API. Compat does not implement its own retry.
- `changeMode` on facade is always `tracked`. `direct` is an allowlisted mechanical op set defined in a new AD (or forbidden until defined).
- Comments/track-changes: one address space (`query` / `NodeAddress`). Facade `/add-comment` with `selection` fails closed or translates via `query.match` in the same request and does not persist the selection.

---

### 3.3 `routes/document-api` vs `collaboration` — two bound handles, one revision token

#### Shared-data shapes that clash

| Token | Document-api | Rooms / browser |
| --- | --- | --- |
| `evaluatedRevision` / `expectedRevision` | Returned from host SDK `query.match`; required on next mutate | Browser handle has its own revision; host never sees it |
| Author | Session user on `client.open` (AD-12) | Sidebar awareness user (`UserInfo` or SuperDoc v2 user) |
| Tracked-change ids | From host receipt | From in-room engine; may not be in last-good |
| Warm handle | Cache in `documents/` (AD-6) | SDK client joined to the room; close = leave the room |

Revision type is unspecified (number, string, opaque token). Document-api may serialize `evaluatedRevision` as a number; rooms/SuperDoc may use a string hash. Persistence may store `lastGoodRevision` from `receipt.afterRevision`. After reopen, SuperDoc may renumber. Convention says refs are valid only for the producing revision; it does not say revisions are stable across close/open. Alpha closes every request (AD-6). Beta keeps a room-joined handle. The same `expectedRevision` is then either still valid (Beta) or meaningless (Alpha).

#### Two owners of one entity

**Entity: the bound handle for session S.**

- AD-1: every document change is a Document API operation on **a** bound handle.
- Document-api binds a host SDK handle per request (Alpha) or from the warm cache.
- The sidebar binds a browser handle on the same room (AD-8).
- AD-1's "Routes and collaboration adapters may only call that API" does not say there is one handle, or that browser edits are host-visible.

**Entity: last-good after a human edit.**

- Document-api persists last-good only after *its* receipts (AD-10).
- Rooms do not call persist-last-good (not a host mutation batch).
- Result: shared-mode last-good is defined as "last agent edit," not "last document change." Export and isolated-shaped reopen (or Alpha cold seed) drop human work. Both units cite AD-10.

**Entity: room liveness vs AD-9 create/join.**

- AD-6: close handle on success and failure.
- Shared open joins the room; close leaves it.
- If the room GC's when the last client leaves (legal room-server choice; spine silent), the next document-api open **joins a missing room → explicit failure** (AD-9). Re-create is also failure if a tombstone remains, or a blank create if the tombstone does not.
- Persistence still has last-good. Alpha would reopen isolated; but if mode is `shared`, Alpha must not (Convention: do not infer per request). Dead session: cannot join, cannot create, cannot isolate.

**Entity: admission.**

- AD-7: reject when host **or** worker RSS cannot take another open. 503 (AD-17).
- Document-api admits SDK/CLI workers.
- Rooms admit Yjs/Hocuspocus in the Fastify heap (AD-7: the API process **owns** room hosting).
- A session can be WS-admitted and SDK-rejected, or the reverse. No AD for websocket admission or for "human is in the room so the agent open must succeed."

#### Conflicting state-mutation paths

1. Agent: `query` (rev 4) → human types (rev 5) → agent `apply` expected 4 → `REVISION_MISMATCH` → re-query, retry once → human still typing → 400/receipt fail. AD-4 says preview is not a lock. No AD on shared-mode concurrency, occupancy, or "agent mutations queue behind in-room edits."
2. Agent apply succeeds, persist last-good, close handle (leave room). Human's in-flight edit lands. Room ≠ last-good.
3. `POST /document/track-changes/decide` exists for sidebar/internal tools (companion; Deferred: agent accept/reject off). The sidebar can also decide in-engine. Two decide paths, no single reviewer record.

#### Closer

New **AD-SharedWriters**:

- Shared mode has exactly one live body: the v2 room. Host and browser are two Document API clients of that room.
- Host handle open in shared mode is join-only, never seed-on-empty unless `documents/` is inside `promoteToShared`.
- `expectedRevision` is the SuperDoc revision of that room, passed through unchanged (opaque string/number as SuperDoc returns it). Host must not mint revisions.
- Last-good flush is mandatory after every **host** successful receipt **and** after last room client disconnects (host opens a short join, engine-exports, persists, closes). Persistence does not flush on its own.
- Close of a host handle must not destroy the room. Room lifetime = session lifetime (`documents/` delete).
- Admission is one function: if shared promote or host open would exceed host RSS **or** worker slots, 503 both HTTP and WS (WS close code named).
- Agent `trackChanges.decide` remains off (already Deferred / AD-5). Human decide in the editor is the only decide path until a later AD.

---

### 3.4 `routes/compat` vs `persistence` — what is a batch, what is meta, what is the buffer

#### Shared-data shapes that clash

Today Redis is `superdoc:meta:*`, `superdoc:buffer:*`, `superdoc:doc:*`, `superdoc:updates:*`. The spine says last-good replaces "YDoc as the only body." It does not say:

- whether last-good **is** `superdoc:buffer` (overwrite the original upload) or a new key
- the session meta schema (`any` in brownfield)
- whether comments, search maps, or `accessMode` live in meta

| Meta / blob | Compat (Beta) | Persistence (Alpha) |
| --- | --- | --- |
| `superdoc:buffer` | Original upload, needed for `projectHtml({ reviewMode: 'original' })` and brownfield rehydrate | Last-good DOCX (AD-10 replaces the old body story) |
| Session meta | May store last search ranges / extract map / `expectedContext` to serve the facade | `{ user, fileName, accessMode, lastGoodAt }` only |
| Comment records | May persist host comment ids in meta (today's shape) | Comments live only inside last-good / room |
| Persist trigger | After every successful facade HTTP call, including `/add-comment` | After a "mutation batch" = `mutations.apply` or maybe `replace`/`insert`, **not** comments |

If persistence overwrites `buffer` with last-good, compat/`project` original-view is gone. If persistence keeps `buffer` as the original and writes last-good elsewhere, compat export/reopen that still calls `loadBuffer()` (brownfield name) loads the **upload**, not the edited document. Both mappings are AD-10-compliant: last-good exists; the old key's meaning is unspecified.

#### Two owners of one entity

**Entity: last-good bytes.**

- AD-10 binds persistence and export: persist last-good after a successful mutation batch.
- AD-6 binds documents: persist last-good after a successful receipt, then close.
- Compat thinks it must persist because it performed a mutation (AD-10).
- Persistence thinks it is the writer (AD-10 Binds).
- Document-api/`documents/` thinks it is the writer (AD-6).
- Three callers, last-write-wins, no fencing. Two successful receipts in flight (agent plan + facade replace) persist in either order; the older export can land last.

**Entity: "mutation batch."**

- Compat `/replace-all`: one atomic apply → one persist (agreed).
- Compat `/replace` × N: N persists, or one debounced persist (persistence "batching" — the word is in AD-10).
- `comments.create`: document change (AD-1) but maybe not a "batch." Alpha persistence skips it. Reopen from last-good loses comments. Beta compat persists. Rooms already have the comment in Yjs. Three comment lifetimes.

**Entity: session TTL.**

- Persistence refreshes TTL on last-good write.
- Compat-only comment traffic that did not persist last-good does not refresh.
- Rooms refresh on WS.
- Agent-only isolated session with only `/get-content` / `/document/extract` (reads) expires under persistence TTL while the agent still holds `sessionId`. Next call is 404 (expiry). AD-17 makes that look like a dead session. No AD says reads refresh TTL.

#### Conflicting state-mutation paths

- Compat apply → persist last-good from handle.export().
- Persistence compact job (brownfield `compactState` on Yjs) still runs on `superdoc:doc:*` because the stack keeps yjs for room persistence. It does not update last-good. After compact, room ≠ last-good even with no edits.
- Export: AD-10 discard working copy when distinct output exists. Persistence may treat export as "session complete" and delete keys (today's delayed cleanup). Compat may keep the session so the agent can export twice. Document-api may keep last-good and the session forever (TTL). Three post-export states, all AD-10-legal.

#### Closer

New **AD-SessionRecord** and tighten **AD-10**:

- Persistence is a Redis adapter. It does not decide when to snapshot.
- `documents/` is the only last-good writer. Bytes come only from engine export of a host-bound handle. One in-flight persist per session (lock / generation).
- Keys: `meta`, `last-good`, optional `original` (upload bytes, immutable, only if `reviewMode: original` is required), optional opaque `room` blob. Do not reuse `superdoc:buffer` to mean both original and last-good.
- Meta schema is versioned and owned by `documents/`: `sessionId`, `user` (`UserInfo`), `accessMode`, `fileName`, `roomId` (= `sessionId` or absent), `lastGoodRevision` (opaque SuperDoc value or null), `lastGoodAt`, `capabilities`. No targeting maps. No comment lists.
- Persist last-good after every successful Document API write that changes the DOCX, including comments and (if ever enabled) decide. Reads refresh TTL.
- Export: distinct artifact; last-good unchanged; session remains until explicit delete or TTL; discard working copy only. Compat `/export` must not delete the session unless a later AD restores today's cleanup as product behavior.

---

### 3.5 `routes/document-api` vs `persistence` — handle lifecycle vs durable write

#### Shared-data shapes that clash

| Value | Document-api / `documents/` | Persistence |
| --- | --- | --- |
| `receipt.afterRevision` | Live handle revision; used as next `expectedRevision` | Stored as `lastGoodRevision`; after close/reopen may not match SuperDoc's new `evaluatedRevision` |
| Persist payload | Handle still open; export() then persist then close (AD-6 order) | Expects bytes + meta; may export again (second engine export, two last-goods) |
| Persist failure | Receipt already `success`; HTTP 200 (AD-13 says inspect receipt **before** persist, not that persist is in the success contract) | Throws; caller may 500/503; last-good stale, room/handle mutated |
| Warm handle vs Redis | Cache hit skips load | Load last-good on every "open" it sees |

AD-13's success contract is the receipt. Persist is after. If persist fails, Alpha document-api has already told the agent the mutation succeeded. The next isolated open loses the edit. Shared room may still have it (3.1). The spine never says "HTTP success requires durable last-good."

#### Two owners of one entity

**Entity: `client.open` / close.**

- AD-2 binds hosts and documents. Seed has both `hosts/` (SDK + CLI lifecycle) and `documents/` (session registry, mode, handle cache).
- Hosts: one CLI worker pool, admission by process count.
- Documents: one handle per session, admission by handle count.
- AD-7: "SDK-managed CLI process" — public contract is "the SDK manages the CLI." Both units can claim they do not choose the process model, then each implement a different cache (process cache vs handle cache). 503 fires at different times (AD-17).

**Entity: upload.**

- Not in the seed under `routes/document-api` or `compat`. Companion puts `POST /upload` in the canonical table.
- Documents, persistence, and both route trees can each implement upload. Mode, user, last-good, room create, `collaborationUrl`, analytics (AD-14 existing Amplitude) have no single entrypoint AD.

#### Conflicting state-mutation paths

- Document-api: persist-then-close.
- Persistence: close-then-export-from-last-known-path, or export after close from room.
- Isolated: after close, only last-good exists. If document-api persisted and persistence exported again from a discarded working copy, the second write can be empty or pre-mutation (AD-10: close uses **discard** when distinct output exists — export and mutate both close). A persist that runs after discard writes garbage over last-good.

#### Closer

Tighten **AD-6, AD-7, AD-13**:

- `hosts/` owns CLI/SDK client process lifecycle and worker-slot admission.
- `documents/` owns session record, mode, handle cache, and the open/use/receipt/persist/close loop. It is the only caller of `persistence.saveLastGood`.
- HTTP mutation success = `receipt.success && last-good persist ok`. Persist failure → 503; handle closed; last-good left on the previous snapshot; room (shared) still has the new body (call this out as a known shared-mode repair: next flush). Do not return 200.
- Upload is a `documents/` operation exposed once on HTTP (not once per route tree). It writes meta + last-good (and original if required) **before** returning. Room create is not upload's job unless the caller requested shared *and* `promoteToShared` runs in the same transaction.

---

### 3.6 `routes/compat` vs `collaboration` — v1 reader, v2 room, same URL

#### Shared-data shapes that clash

| Value | Compat (steps 1–3, isolated) | Rooms (AD-9 new rooms are v2) |
| --- | --- | --- |
| `collaborationUrl` on upload | Today's `/collaboration/:sessionId` (brownfield agent/sidebar) | v2 Hocuspocus URL, or y-websocket `?room=`, or both |
| Room format | v1 Yjs left alive as "temporary reader" (companion §5.2; spine AD-16 deletes v1 only when Document API + chosen access mode are the only **writers**) | v2 only; joining a v1 blob is not a v2 room |
| First sidebar connect | Old editor, v1 protocol | Reject non-v2 (AD-9) |

AD-9: "Shared-room mode cannot ship until the sidebar editor is on SuperDoc v2." It does **not** say the v2 room **server** cannot ship earlier, or that upload must stop advertising `collaborationUrl`.

- Compat/upload keeps returning `collaborationUrl` (companion §6.1 "keep `collaborationUrl`").
- Rooms ship v2-only (AD-9).
- Sidebar is still v1. Connect fails. Isolated agent path works. Human sidebar is down. Each unit is compliant: shared mode did not "ship"; new rooms are v2; facade did not reopen JSDOM.

Alternatively rooms keep a v1 reader path for the old editor (companion). Then one `sessionId` has a v1 room and a v2 room, or one socket that is v1. AD-9 "new rooms use SuperDoc v2" — the v1 path is not "new." Dual formats on one id.

#### Two owners of `collaborationUrl`

Upload (compat or documents) mints the URL. Rooms decide the protocol and path. Spine AD-15 only says they share `PORT`. Frontend `superdocSocketUrls` already end in `/collaboration` (brownfield). Hocuspocus vs y-websocket vs path-param vs query-param are all legal.

#### Conflicting state-mutation paths

During cutover, companion keeps v1 as a temporary **reader**. Readers still apply Yjs updates from the browser. A reader that can type is a writer. AD-16's deletion gate is "only writers." A v1 sidebar is a writer the rooms team can call a reader. Compat continues to write via SDK into last-good (isolated). Two live documents again (3.1), now with v1/v2 format mismatch (AD-9 Prevents, but only for "mixing v1 rooms with a v2 editor" — a v1 editor on a v1 room plus an SDK on last-good is not that mix).

#### Closer

Tighten **AD-9, AD-16**:

- Until sidebar v2 is the deployed editor, **do not create v2 rooms** and **do not return a v2 `collaborationUrl`**. Isolated is the only production mode. Existing v1 collaboration stays read/write for the old sidebar only; it is not a second write path for Document API traffic (SDK never joins v1).
- When shared mode ships, it is one rollout: v2 room server, v2 sidebar, `collaborationUrl` v2, v1 sockets off. Creating a v1 room after that date is a failure.
- Pin provider + URL shape in the spine (not the companion).

---

### 3.7 `documents/` vs `collaboration/` vs `persistence/` — three owners of the session

The seed splits one runtime entity across three folders:

```text
documents/       session registry, isolated vs shared mode, handle cache
collaboration/   v2 room server adapter
persistence/     Redis: meta, last-good DOCX, optional room state
```

The spine binds AD-6 to documents + persistence, AD-8 to documents + collaboration, AD-10 to persistence + export. **No AD says which module is the session authority.**

Letter-compliant split:

| Concern | documents/ | collaboration/ | persistence/ |
| --- | --- | --- | --- |
| Does session exist? | in-memory registry (today: `sessions` map; WS already 1008 if missing from memory) | auth = room exists | meta key exists |
| `GET /validate-session` | memory | — | Redis meta |
| WS join after crash | empty memory → reject (brownfield) | rehydrate room from Redis | has last-good; unused if rooms/auth don't ask |
| Delete | drop handle | drop room | drop keys |

Three "session exists" predicates. AD-17 404 is "unknown or expired session." Each implementer can 404/1008 when *its* store misses, while another store still has the session. Agent expires a live room; sidebar joins a session HTTP already 404'd; or the reverse.

Brownfield already has this bug (WS requires in-memory session; Redis-only cannot join). The spine does not close it.

#### Closer

New **AD-SessionAuthority**:

- `documents/` is the only session authority. Exists ⇔ Redis meta + last-good exist (isolated) or meta + last-good + room id exist (shared). Memory is a cache.
- HTTP 404 and WS failure use that same predicate (rehydrate-on-miss).
- `collaboration/` must not keep a parallel session table.
- `persistence/` must not delete keys except when `documents/` says so.

---

### 3.8 Identity, `UserInfo`, and SuperDoc author — `routes/*` vs `hosts/` vs rooms

AD-12: `client.open` always receives the session user; missing identity is 400; no default CLI author.

Unspecified:

- Shape of "session user" vs SuperDoc SDK user vs browser awareness user.
- Whether upload may invent `anonymous` (today) or must 400 (Alpha).
- Whether later mutations may send a different user (sidebar vs agent).
- Whether comments use `user.username` (today) or SuperDoc comment author fields.

Clash:

- Document-api 400s upload without user.
- Compat upload writes anonymous `UserInfo` so justitia-agent keeps working (identity not "missing").
- Hosts maps `UserInfo` → SDK `{ name: username, id: userid }` or `{ name: name, email }`.
- Rooms pass awareness from the websocket; sidebar sends a different userid than upload.
- Tracked changes: agent marks authored by anonymous/session; human marks authored by sidebar user. Review UI shows two people; analytics (AD-14) keys one session user.

AD-12 Prevents "generic `CLI` authorship." It does not prevent generic `anonymous` authorship, and it does not say one human identity per session.

#### Closer

Tighten **AD-12**:

- Session user is `UserInfo` (`userid`, `username`, plus optional name/email/image). Upload **requires** `userid` and `username`; `anonymous` / missing is 400. (If justitia-agent cannot yet send this, that is a companion consumer task, not a silent default.)
- `hosts/` maps that record to SuperDoc `open` user in one place.
- Browser awareness **must** use the same `userid` for the session's human, or a named guest list on the session record. A second identity is a new AD, not an implicit WS field.
- Comment/tracked-change author is the session user for host operations; browser operations use the joined awareness user that was registered on the session.

---

### 3.9 Block identity and leftover coordinates — document-api vs compat vs persistence

Convention: public block identity is `NodeAddress` / `nodeId`; imported DOCX paragraphs use native `paraId` when SuperDoc exposes it; `sdBlockId` is not a cross-open key.

Freedoms:

- SuperDoc "when it exposes" `paraId` — if it does not, what is the public id? Document-api waits for `query.match` only. Compat `/replace-in-paragraph` requires `paraId` (brownfield) and 400s if missing (AD-17). Same paragraph, one API unaddressable by `paraId`.
- Persistence / documents may cache `sdBlockId` on the warm handle (legal; session-scoped). After close/reopen Alpha drops them; Beta rooms keep them. Compat that stored `paraId` in the agent prompt still works; document-api refs do not.
- AD-3 lists `query.match`, `extract`, or block `NodeAddress`. Compat can target by `extract` + character offsets (the from/to loophole). Document-api can refuse any non-`NodeAddress` target. Shared type `Target` does not exist in the spine.

#### Closer

Tighten **AD-3** with a host `Target` union: SuperDoc target/ref as returned by `query.match` / `extract`, or `NodeAddress` with `paraId` when present. No character offsets. No `sdBlockId` on the wire. After any close/reopen, clients must query again (already implied; say it for HTTP).

---

### 3.10 Telemetry and analytics — both route trees vs `services/analytics`

AD-14: log operation name, session id, failure code, receipt status, timing; never document text, full mutation payloads, or complete receipts. Existing Amplitude upload analytics stay.

Holes:

- "Operation name" on facade is `/replace-all`; on document-api is `mutations.apply` / `text.rewrite`. Same edit, two dashboards.
- "Receipt status" vs "complete receipts" — may we log `failure.code` and `afterRevision`? Alpha logs both; Beta logs only HTTP status (receipt has targets; "complete receipt" banned).
- Upload analytics fire after durable persist (brownfield). If upload is owned by two trees (3.5), double-emit or none.
- Rooms have no analytics AD. Human joins/edits are invisible or logged with awareness names (PII; AD-14).

Not the worst hole. Still a shared-data shape (`SuperDoc Document Opened` and any new mutation event) with two writers.

#### Closer

Tighten **AD-14**: one event name table; facade operations map to Document API operation names; allowed fields enumerated; upload emit stays exactly once in `documents/` after first durable last-good.

---

## 4. AD-by-AD residual latitude

What a letter-compliant implementer may still choose. If two units may choose differently, the AD is not yet a substrate.

| AD | Still free (letter) | Split it causes |
| --- | --- | --- |
| **1** | What counts as "write Yjs fragments" vs official room persist; browser handles vs host handles; persist-export as a second writer | Rooms vs persistence (3.1); document-api vs rooms (3.3) |
| **2** | Binds hosts/documents only; rooms/persistence may import `yjs` / Hocuspocus as first-class | Two integration surfaces |
| **3** | HTTP `require` default; extract-map vs fail-closed; `paraId` optional; revision type | document-api vs compat (3.2, 3.9) |
| **4** | What "independent" means; who builds plans; preview storage; cross-API turns | Two apply paths (3.2) |
| **5** | "Mechanical"; where the explicit flag lives; browser decide | Mixed tracked/direct; two decide paths |
| **6** | Last-good **or** room; warm-cache policy; close destroys room or not | Recovery and handle/room lifetime (3.1, 3.3) |
| **7** | Process-per-handle vs pool; WS admission; who measures RSS | 503 at different times |
| **8** | Mode set at upload vs join; whether returning `collaborationUrl` implies shared; seed-from-last-good as converter or not | Dual documents (3.1, 3.6) |
| **9** | Hocuspocus xor y-websocket; URL shape; when the v2 server may appear; room id | Sidebar/host wire break; create/join deadlock |
| **10** | "Batch"; comments; persist vs HTTP success; buffer key meaning; export ends session?; room blob vs awareness; AD-6 vs AD-10 winner | Dual durable body (3.1, 3.4, 3.5) |
| **11** | HTTP envelope; facade response bodies; upload home | Two agent contracts (3.2) |
| **12** | `UserInfo` vs SDK user; anonymous; one vs many authors | Attribution drift (3.8) |
| **13** | Retry owner; HTTP for failed receipt; persist failure | Agent retry/expiry mistakes (3.2, 3.5) |
| **14** | Operation name vocabulary; mutation events | Split analytics |
| **15** | Path, protocol, WS admission | Rooms vs frontend (3.6) |
| **16** | Deletion gate ("chosen access mode"); v1 reader that can type; Open Question | Dual stack longer than intended (3.6) |
| **17** | Receipt-code → HTTP; WS close codes; 429; `Retry-After` value; room create/join failures | Agent 404/400 confusion |

Internal tensions (two ADs, opposite orders):

1. **AD-1 vs AD-10:** collaboration adapter must not write Yjs; room state may be persisted.
2. **AD-6 vs AD-10:** recover from room **or** last-good; cold start **must** seed last-good.
3. **AD-3 vs Open Question:** do not derive locations from HTML/PM; facade may try a projection source map.
4. **AD-8 vs upload `collaborationUrl`:** isolated agent-only vs always-advertised room.
5. **AD-12 vs brownfield anonymous upload:** missing user 400 vs today's default user.

A spine that contains unresolved contradictions is not a consistency contract. Next-level units will pick a side and both be "correct."

---

## 5. Dual-ownership map (one glance)

| Entity | Claimed by (legal readings) | Why the spine allows it |
| --- | --- | --- |
| Recoverable document body | persistence (last-good), collaboration (room blob), documents (handle export) | AD-6 or; AD-10 must seed last-good; AD-10 may persist room |
| `accessMode` | documents (upload), collaboration (first join) | Convention lists both moments |
| Room create / `documentId` | collaboration, documents/SDK seed, upload | AD-9 + SDK open unspecified |
| Last-good write | documents (AD-6), persistence (AD-10), routes (they mutated) | Three bind lists, no single writer |
| Session exists | memory registry, Redis meta, room table | No session-authority AD |
| Agent mutation HTTP | document-api, compat | AD-11 dual surface, no envelope |
| Retry | documents, each route tree | AD-13 binds "all mutations" |
| Author | upload `UserInfo`, SDK map, WS awareness | AD-12 names "session user" only |
| Comment | document-api, compat, in-room editor | Three Document API clients |
| Admission | hosts (workers), documents (handles), collaboration (RSS/WS) | AD-7 lists host and worker, not a function |
| `collaborationUrl` | upload response, rooms server | AD-15 port only |
| Export aftermath | persist keys, session TTL, today's delayed delete | AD-10 distinct artifact only |

---

## 6. Conflicting mutation-path map (one glance)

```text
                    ┌─ SDK handle, isolated last-good ── persist last-good ── close
 Agent HTTP ────────┤
                    └─ SDK handle, shared room ──────── persist last-good ── close (leave room)

 Sidebar v2 ────────── browser Document API ──────────── room Yjs ────────── (no host receipt)

 Sidebar v1 (cutover)─ v1 collaboration "reader" ─────── v1 Yjs ──────────── (AD-16 reader/writer hole)

 Room persist ──────── Hocuspocus/y-websocket onChange ─ Redis Yjs ───────── (AD-1 allowed or forbidden)

 Cold start Alpha ──── last-good DOCX ────────────────── seed / overwrite room
 Cold start Beta ───── Redis room blob ───────────────── ignore last-good
```

AD-1 says there is one mutation authority (Document API). That is true of *edits* and false of *durability*: last-good persist, room persist, and cold-start seed are three more writers of the bytes the next open will see. The spine treats those as adapters. Adapters with unspecified ordering are writers.

---

## 7. ADs to add or tighten

These are the minimum closes so that Alpha and Beta cannot both remain legal. Wording is substrate, not implementation.

### Tighten existing

**AD-1** — Add: the only *durable* writes of document bytes are (a) `documents/` persisting an engine export as last-good, and (b) the v2 room protocol applying Document API operations from a joined client. Persistence stores opaque blobs; it does not interpret or merge Yjs. Collaboration does not snapshot a second document format except the opaque room blob `documents/` asked for.

**AD-3** — Add: host `Target` = SuperDoc target/ref or `NodeAddress` (`paraId` when SuperDoc exposes it). No extract/HTML/PM offsets on mutate, including facade. Fail closed on `{ from, to }` and `{ position }`. Close the Open Question.

**AD-6** — Replace "last-good **or** room" with the recovery table in §3.1. Close does not destroy a shared room. Session validity is not handle liveness.

**AD-8** — Add: `accessMode` has one writer (`documents/`). Isolated open is illegal when mode is shared and vice versa. Advertising `collaborationUrl` does not set shared. Seed-from-last-good is allowed only inside `promoteToShared` when the room is missing.

**AD-9** — Pin one provider and the URL shape. `documentId === sessionId`. SDK shared open is join-only. v2 rooms and v2 `collaborationUrl` do not exist until shared mode ships with the sidebar.

**AD-10** — Add: last-good writer is `documents/` only; trigger = every successful DOCX-changing Document API receipt on a host handle, plus shared last-disconnect flush. Persist failure fails the HTTP mutation (503). Export does not delete the session and does not overwrite last-good. Room blob is opaque and never wins over an existing room on seed. Resolve the AD-6 clash here.

**AD-11** — Add the envelope and facade rules in §3.2. Upload lives in one place.

**AD-12** — Require `userid` + `username` at upload; no anonymous default; one mapping in `hosts/`; awareness ids are registered on the session.

**AD-13** — Retry owner = `documents/` once. HTTP mapping in §3.2. Success = receipt + last-good persist.

**AD-16** — v1 collaboration, if still up, is not a writer for Document API sessions. Deletion gate: isolated Document API is the only writer **or** shared v2 room is the only writer — never both, never v1+v2.

**AD-17** — Include the receipt-code mapping and WS "session missing" ≡ HTTP 404. Room create-existing / join-missing are 409/400 (pick one) on HTTP and a named WS close code — not 404.

### New ADs (holes that have no home)

**AD-18 Session authority.** `documents/` is the sole session predicate. Memory is cache. HTTP and WS use the same exists/rehydrate rule. Persistence deletes only on `documents/` command.

**AD-19 Session record.** Versioned meta schema in §3.4. No targeting maps. Keys for `meta`, `last-good`, optional `original`, optional opaque `room`. TTL refreshed on read and write.

**AD-20 Shared-mode promote.** Single operation: create room if missing, seed from last-good if empty, fail if room exists with different identity, flip `accessMode`, then allow shared opens. First human join and optional shared upload call this; nobody else creates rooms.

**AD-21 Shared writers and flush.** Host and browser are two Document API clients of one room. Last-good is a snapshot, not a second live body. Flush rules in §3.3.

**AD-22 Admission function.** One check used by upload, host open, heavy plan, export, promote, and WS join. 503 + `Retry-After` (named default seconds). Worker slots from `hosts/`; host RSS includes rooms.

Without AD-18–AD-22, tightening the originals still leaves three folders owning one session.

---

## 8. What this review is not

- Not a rejection of the paradigm. One engine, one Document API, last-good as durable bytes, v2 rooms, frozen 404/400/503, no JSDOM write path — those Prevents are right.
- Not an implementation plan. No code should move on the basis of Alpha or Beta; both must become illegal except the single cut the tightened spine names.
- Not a companion edit. Several holes exist *because* the companion decided things the spine left open (y-websocket-or-Hocuspocus, source-map Open Question, `documentId: sessionId`, upload `collaborationUrl`, v1 temporary reader). Promote those decisions into ADs or delete them.

---

## 9. Suggested spine patch order

If the next architecture pass closes holes rather than adding epics:

1. Resolve AD-1 / AD-6 / AD-10 (one live body, one durable snapshot, one recovery table, one last-good writer). This is the persistence ↔ rooms deadlock.
2. Add AD-18–AD-20 (session authority, record, promote). This is the three-folder deadlock.
3. Freeze the HTTP envelope and fail-closed facade (AD-3, AD-11, AD-13, AD-17). This is the document-api ↔ compat deadlock.
4. Pin room provider, URL, `documentId`, and the v1/v2 cutover gate (AD-9, AD-15, AD-16). This is the sidebar wire deadlock.
5. Close identity and admission (AD-12, AD-7, AD-22).

After that, a document-api epic and a rooms epic can proceed in parallel without inventing a second document.
