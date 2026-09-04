# AGENTS.md

## Scope

`morph/` is the Document-engine command host. SuperDoc's Document API (via `@superdoc/sdk` 2.8.0) is the only writer. HTTP, Redis/file persistence, and admission are adapters.

## Read First

- `src/server.ts`
- `src/app.ts`
- `src/documents/registry.ts`
- `src/hosts/sdk-host.ts`
- `src/services/analytics.ts`
- `../docs/architecture/architecture-superdoc-redesign-2026-09-03/ARCHITECTURE-SPINE.md`

## Watchpoints

- Do not import `@harbour-enterprises/superdoc`, JSDOM, or write ProseMirror transactions.
- `from` / `to` and numeric `position` fail closed (400).
- 404 is session expiry only. Persist/admission failures are 503.
- Last-good DOCX is the durable snapshot. Export writes a distinct artifact and does not delete the session.
- Node 20 (`nvm use`). `@superdoc/sdk` pulls `@superdoc/sdk-linux-x64`.
- `mutations.apply` may reject `query.match`'s opaque revision and demand the live numeric revision. Retry from the engine error's "current revision".
- Comments are labeled `direct` — the engine refuses tracked comment create.
- Agent catalog is `GET /document/tools`. First read is `POST /document/inspect`. Capacity is `GET /document/capacity`. See `AGENT.md`.
- Redis (or file store) is last-good + meta only. Warm handles are a cache (`MORPH_MAX_WARM_HANDLES`). Write slots (`MORPH_WORKER_SLOTS`) bound in-flight mutates. Engine process is recycled when the last handle closes — closeHandle does not free native RSS by itself.
- Memory admission uses tree RSS (Fastify + engine children), not host-only `process.memoryUsage().rss`.
- `trackChanges.decide` and the v1 accept/reject facade send `changeMode: "direct"`. They are human review routes, not agent tools.
- `replace-all` reports `replaced: chosen.length`. Exclusions fall back to sequential tracked replaces (v2 rejects multi-step ref plans).
- Errors must include `code` + `nextAction`. Unknown engine throws become 503 ENGINE_FAILURE, never a bare 500. Unknown routes are 400 UNKNOWN_ROUTE.
