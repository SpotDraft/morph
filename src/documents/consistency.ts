import type { SuperDocDocument } from "@superdoc/sdk";
import { buildOutline } from "./query.js";

const TERM_DEF = /["“]([A-Z][^"”]{1,80})["”]\s+(means|shall mean|refers to)/i;
const INLINE_DEF = /\((?:the|hereinafter)\s+["“]([^"”]+)["”]\)/i;
const REF_RE = /\b(Section|Clause|Article|Schedule|Exhibit|Annex)\s+([\d]+(?:\.[\d]+)*|\([a-z]\))/gi;

export interface TermHit {
  blockId: string;
  count: number;
  textPreview: string;
}

export interface RefHit {
  label: string;
  fromBlockId: string;
  resolvedBlockId: string | null;
  kind: "hardcoded";
}

export async function findTerm(doc: SuperDocDocument, term: string) {
  const outline = await buildOutline(doc);
  const extract = await doc.extract();
  const normalized = term.trim();
  let definitionBlockId: string | undefined;
  const occurrences: TermHit[] = [];

  for (const block of extract.blocks) {
    const text = block.text ?? "";
    if (TERM_DEF.test(text) && text.includes(normalized)) {
      definitionBlockId ??= block.nodeId;
    } else if (INLINE_DEF.test(text) && text.includes(normalized)) {
      definitionBlockId ??= block.nodeId;
    }
    const re = new RegExp(`\\b${escapeRe(normalized)}\\b`, "g");
    const count = (text.match(re) ?? []).length;
    if (count > 0) {
      occurrences.push({
        blockId: block.nodeId,
        count,
        textPreview: text.slice(0, 160),
      });
    }
  }

  return {
    term: normalized,
    definitionBlockId: definitionBlockId ?? null,
    occurrences,
    totalBlocks: outline.totalBlocks,
  };
}

export async function checkReferences(doc: SuperDocDocument) {
  const outline = await buildOutline(doc);
  const extract = await doc.extract();
  const labelToBlock = new Map<string, string>();
  for (const block of outline.blocks) {
    const label = block.numbering?.label;
    if (label) labelToBlock.set(String(label), block.nodeId);
  }

  const broken: Array<{ label: string; fromBlockId: string }> = [];
  const refs: RefHit[] = [];
  for (const block of extract.blocks) {
    const text = block.text ?? "";
    REF_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = REF_RE.exec(text))) {
      const label = m[2];
      const resolved = labelToBlock.get(label) ?? null;
      refs.push({ label, fromBlockId: block.nodeId, resolvedBlockId: resolved, kind: "hardcoded" });
      if (!resolved) broken.push({ label, fromBlockId: block.nodeId });
    }
  }

  return {
    broken,
    drifted: [] as Array<{ fromBlockId: string; label: string; wasBlockId: string; nowBlockId: string }>,
    total: refs.length,
    refs,
  };
}

function escapeRe(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
