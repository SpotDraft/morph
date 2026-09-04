# Agent contract

This is the document the **agent** (justitia-agent or any other caller) should follow. Morph is a sessionful Document-engine host, not a stateless “send the DOCX on every request” editor.

## How the agent learns what to edit

```text
POST /upload
POST /document/inspect          ← compact outline, tables with cell nodeIds, lists, headings
POST /document/query            ← unique phrase → target + evaluatedRevision
POST /document/block            ← full text for one nodeId (send this back as expectedText)
POST /document/replace | insert | table/cell | format | list/insert | heading
POST /document/inspect          ← addresses are stale after every write
POST /export                    ← does not delete the session
```

`GET /document/tools` is the catalog. `GET /document/capacity` is the live memory / slot report.

Do **not** flatten the document and guess character offsets. `from` / `to` and numeric `position` are 400 `OFFSET_FORBIDDEN` / `POSITION_FORBIDDEN`.

## Failures

Every error body is:

```json
{
  "success": false,
  "code": "NO_MATCH",
  "message": "…",
  "detail": {},
  "retryable": false,
  "retryAfter": null,
  "nextAction": "Call /document/inspect or /document/query …"
}
```

| HTTP | Meaning | Agent action |
| --- | --- | --- |
| 404 | Session gone (`SESSION_EXPIRED`) | Re-upload. Not a missing clause. |
| 400 | Targeting / validation / unknown route | Read `code` + `nextAction`. Fix the request. |
| 429 / 503 | Admission, persist, or engine | Retry once after `Retry-After`. |

There is no bare 500. Unknown engine throws become 503 `ENGINE_FAILURE`. Unknown paths become 400 `UNKNOWN_ROUTE`, not 404.

## Redis / hydration — same idea as today, cleaner keys

Edits are **not stateless**. The agent keeps `sessionId`.

- A session **exists** when `morph:meta:{id}` and `morph:last-good:{id}` exist (optional `morph:original:{id}`).
- HTTP is request-scoped. The warm SDK handle is a **cache**. If the handle (or the replica) is gone, the next request writes last-good to a temp file and `open()` again.
- **Redis is required on Cloud Run / multi-instance.** Single-process tests use in-memory persist. `MORPH_DATA_DIR` is a one-box file store.
- Redis does **not** hold Yjs, search maps, or comment lists. Smaller than today’s `superdoc:buffer` + YDoc snapshot.
- Export does **not** delete the session. TTL (default 1800s) refreshes on read and write.

## 2 GiB — how many documents, how many requests

Measured on this image (Node 20 + `@superdoc/sdk` 2.8.0). Tree RSS = Fastify + one SuperDoc engine child.

| | Tiny fixture | Ping MSA (~224 KB) |
| --- | --- | --- |
| First open | ~500 MB | ~610 MB |
| Extra warm doc | ~1–4 MB | ~11 MB |
| 8 concurrent tracked replaces | 151 ms | 875 ms |

On a **2 GiB** box, Ping-MSA-sized contracts:

- **~80–100 warm documents** with 256 MiB headroom (`GET /document/capacity` → `documents.maxWarmAt2GiB`).
- **8 concurrent writes** by default (`MORPH_WORKER_SLOTS`). Extra writes get 503 `ADMISSION` + `Retry-After`.
- Reads of an already-warm doc are not slot-limited; they still hit the memory guard (`MEMORY_GUARD_RSS_MB`), which now sums **tree RSS** (Fastify + engine child).
- Closing a handle does **not** free native engine RSS. Morph disposes the engine when the last warm handle goes idle.

Set `MEMORY_GUARD_RSS_MB=2048` to enforce the 2 GiB ceiling. `MORPH_MAX_WARM_HANDLES` caps the cache (default 64). Those are independent: slots bound **in-flight writes**, warm handles bound **cached opens**. Author email is omitted from redlines unless `MORPH_INCLUDE_AUTHOR_EMAIL=true`.

## Collaboration

Isolated agent edits **do not go through Hocuspocus**. `collaborationUrl` is advertised; v2 rooms are **not** created until `promoteToShared` and the sidebar SuperDoc v2 ship together. Do not judge collaboration performance from morph. The v1 rooms in [superdoc](https://github.com/SpotDraft/superdoc) remain the human path.

## Word surface

The engine can do far more than replace (tables, lists, format, headings, comments, track changes). Morph exposes the operations the agent needs to *target correctly*:

- Tables: `/document/table/cell` rewrites the cell paragraph as a **tracked** replace (v2 `tables.setCellText` is not tracked-capable). `/document/table/row` uses engine `above`/`below`.
- Format: `/document/format` (`bold|italic|underline|strike|highlight`)
- Lists: `/document/list/insert` — never type `4.2(a)`
- Headings: `/document/heading`
- Comments: `/document/comments` (labeled `direct`)
- Multi-edit: `/document/mutations/preview` then `/document/mutations/apply`

Human review (not agent tools): `POST /accept-all-track-changes`, `/reject-all-track-changes`, `/accept-track-changes-by-id`, `/reject-track-changes-by-id`, and `POST /document/track-changes/decide`. Decide is `changeMode: "direct"`.

If an engine method is missing, the host returns `CAPABILITY_UNAVAILABLE` plus `nextAction` — not a 500. Track-over-track spans that refuse a range rewrite should be retried as a whole-clause `/document/replace`.
