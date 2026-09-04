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

Architecture: `../docs/architecture/architecture-superdoc-redesign-2026-09-03/`.
