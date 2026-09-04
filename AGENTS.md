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
