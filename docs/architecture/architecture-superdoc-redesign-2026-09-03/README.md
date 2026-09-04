# SuperDoc document-engine host — architecture run

Initiative-altitude redesign of this service around SuperDoc's Document API.

| File | Role |
| --- | --- |
| [IMPLEMENTATION-HANDOFF.md](./IMPLEMENTATION-HANDOFF.md) | Briefing for the implementation chat: aim, waves, parallel sub-agents, testable outcome |
| [ARCHITECTURE-SPINE.md](./ARCHITECTURE-SPINE.md) | Binding consistency contract (AD-1–AD-28) |
| [ARCHITECTURE-REDESIGN.md](./ARCHITECTURE-REDESIGN.md) | Human-facing as-is / to-be / cutover |
| [.memlog.md](./.memlog.md) | Append-only decision log for this run |
| [reviews/review-old-specs.md](./reviews/review-old-specs.md) | Reconciliation of the in-repo 2026 specs against the first spine |

Historical sources (repo root): `document_editor_redesign.md`, `document-editor-redesign-spec.md`, `document_editor_plan.txt`, `lld-phase-1-structural-editing.md`, `lld-phase-2-runtime-memory.md`, `lld-phase-3-consistency-ripple.md`.

Implementation of the isolated writer is this repo. `server.ts` in [SpotDraft/superdoc](https://github.com/SpotDraft/superdoc) is still the v1 JSDOM service.
