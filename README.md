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

Architecture: `../docs/architecture/architecture-superdoc-redesign-2026-09-03/`. This folder is not the Cloud Run entrypoint yet.
