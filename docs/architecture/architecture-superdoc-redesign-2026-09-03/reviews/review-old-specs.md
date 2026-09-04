# Old-spec reconciliation

**Date:** 2026-09-04  
**Spine edited:** yes (AD-1/3/4/7/10/13 tightened; AD-24–AD-28 added)  
**Sources:** repo-root `document_editor_redesign.md`, `document-editor-redesign-spec.md`, `document_editor_plan.txt`, `lld-phase-1-structural-editing.md`, `lld-phase-2-runtime-memory.md`, `lld-phase-3-consistency-ripple.md`

The first architecture run reconstructed these files from titles. That reconstruction got the three *problem names* right and Phase 3 *wrong*.

## What was better in the specs than the first spine

| Spec finding | First spine | Now |
| --- | --- | --- |
| Phase 3 is defined terms, hardcoded/field cross-refs, and numbering ripple. After a structural insert, refs must be re-resolved **globally** (the 6.3 → 6.4 drift example). Do not auto-fix. | Treated Phase 3 as REST-versus-Yjs | AD-28. Dual-write stays AD-8 / AD-21. |
| Agent read is a compact outline: role, parent/depth, computed numbering label (`4.2(a)`), tables/cells/footnotes/content-controls visible. Full text on demand with redline + surviving. | `extract()` as a dump | AD-24; `lists.get` for labels |
| `replace-all` that returns a count causes loops. Find-set (matches **and** exclusions) then atomic apply. | `require: all` | AD-25 |
| `expectedText` / `expectedContext` is a clause-identity guard, distinct from revision | Only `expectedRevision` | AD-26 |
| Bare “not successful” causes loops. Typed codes: `AMBIGUOUS_MATCH`, `WOULD_SPLIT_BLOCK`, `WOULD_DAMAGE_TRACKED_CHANGE`, … | SuperDoc codes only | AD-13 host-fill |
| Preview must not leak to last-good or viewers. Human approval later uses the same seam. | Preview named, leak rule missing | AD-27 |
| Memory win is “no JSDOM held per session,” not zero DOM. Recycle isolated processes. Global `window` is a race. | Process boundary only | AD-7 |
| Export must refresh or dirty `REF` / number fields | Absent | AD-10 |
| Never edit raw OOXML. Harvey/Nutrient: ID-addressed ops + validate-before-apply + diff self-verify | Implicit in AD-1 | AD-1 explicit |
| Insert-at-top is `before` the first block. Agent never types list prefixes. | Offset fail-closed | AD-3 |

## What we kept from the first spine (better than the specs)

- SuperDoc Document API / `@superdoc/sdk` 2.8.0 is the port. No `SuperdocLocalAdapter`, no ProseMirror JSON as durable state, no host-minted cell `blockId`s on the wire.
- Isolated vs shared, `documents` as session authority, Hocuspocus 2.x pin, last-good DOCX, frozen 404/400/503/429, one Cloud Run port.
- License-as-open-gate is obsolete: the later redesign and 2026-07-05 plan update treat the commercial partnership as resolving AGPL. Remaining gates are fidelity and memory.

## What we still will not do

Phase 0 on the current JSDOM stack is optional tactical work, not a second target. DIY happy-dom pool, Aspose, and Open XML SDK + Clippit stay fallbacks only if a measured SDK spike fails — then a new architecture run, not a silent adapter.
