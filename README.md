# morph

Document-engine command host for SuperDoc. Everything for the new writer lives in this folder.

```text
agent HTTP → documents/ → @superdoc/sdk 2.8.0 → Document Engine process → last-good DOCX
```

## Run

```bash
cd morph
nvm use 20
export SUPERDOC_PUBLIC_LICENSE_KEY=...
npm start          # PORT=5006
npm test
npm run spike
```

Upload needs `userid` + `username` (no anonymous default). `POST /replace` with `from`/`to` is 400. Use `/document/query` + `/document/replace` or `/replace-in-paragraph`.

Proven against `@superdoc/sdk` 2.8.0 on Node 20:

- `query.match` `evaluatedRevision` is an opaque `sd-…:pkg:1` string. Some writes accept it; `mutations.apply` currently wants the live document revision (`0` on a fresh open). Morph retries once with the engine's "current revision".
- Heading insert uses `extract` + `create.paragraph({ at: { kind: "before", target } })`. A heading `nodeType` selector is not reliable.
- Nested replace results look like `{ document, receipt: { success }, context }`. The host unwraps `receipt`.
- `comments.create` is not tracked-capable; Morph sends `changeMode: "direct"` and labels the receipt.
- `text.rewrite` in v2 wants a `query.match` ref or a **single** text selector (`require: "all"` for replace-all).

## Agent loop

Read `AGENT.md`. Short version:

```text
upload → POST /document/inspect → query/block → mutate (replace|insert|table|format|list|heading) → inspect again → export
```

`GET /document/tools` is the catalog. `GET /document/capacity` is the live 2 GiB / slot report. Every error body has `code`, `detail`, `retryable`, and `nextAction`. Retry only 429/503. 404 is session expiry, not a missing clause. Unknown paths are 400 `UNKNOWN_ROUTE`, never a bare 500.

## Memory (measured on this image, Node 20 + SDK 2.8.0)

Tree RSS = Fastify process + one SuperDoc engine child.

| State | Tiny fixture (~3 KB) | Ping MSA (~224 KB) |
| --- | --- | --- |
| Host only | ~230 MB | ~280 MB |
| First open (host + engine) | ~500 MB | ~610 MB |
| Extra warm doc | ~1–4 MB | ~11 MB |
| 8 concurrent tracked replaces | 151 ms | 875 ms |
| Close handles | engine RSS stays | engine RSS stays |
| `client.dispose()` | back to host-only | back to host-only |

On a **2 GiB** box, for Ping-MSA-sized contracts: first open eats ~0.6 GiB, then about **80–100 warm documents** fit with 256 MiB headroom. Small fixtures are not the limiter. Concurrent **writes** are bounded by `MORPH_WORKER_SLOTS` (default 8) and engine CPU; 8 MSA replaces at once completed in under a second here. Reads of an already-warm doc are cheap. `MORPH_MAX_WARM_HANDLES` (default 64) caps the cache and is independent of write slots.

Closing a handle does **not** free native engine memory. Morph now disposes the engine when the last warm handle goes idle so a 2 GiB process can return to ~300 MB.

`npm run bench:memory` (optional `MORPH_BENCH_DOCX`, `MORPH_BENCH_DOCS`).

## Redis / hydration — not stateless, not JSDOM

Same idea as today's service, cleaner keys:

- A session **exists** when last-good DOCX + meta exist (`morph:meta:*`, `morph:last-good:*`).
- HTTP is **request-scoped**. The warm SDK handle is a cache. If the handle is gone, the next request **rehydrates** by writing last-good to a temp file and `open()` again.
- **Redis is required for Cloud Run / multi-instance** so another replica can serve the same `sessionId`. Single-process tests use memory. `MORPH_DATA_DIR` is a file store for one box without Redis.
- Redis does **not** hold Yjs / search maps / comment lists. It holds opaque bytes + meta. That is smaller than today's `superdoc:buffer` + YDoc snapshot pair.
- This is **not** a stateless per-request open-from-the-client-body editor. The agent keeps `sessionId`. Export does not delete the session.

## Collaboration

Isolated agent edits do **not** go through Hocuspocus. `collaborationUrl` is advertised; v2 rooms are **not** created until `promoteToShared` and the sidebar SuperDoc v2 ship together. Do not judge collaboration performance from this host yet — the v1 rooms in root `collaboration/` are still the human path.

Architecture: `../docs/architecture/architecture-superdoc-redesign-2026-09-03/`. This folder is not the Cloud Run entrypoint yet.
