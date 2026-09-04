import type { SuperDocDocument } from "@superdoc/sdk";
import { MorphError } from "../errors.js";
import {
  currentRevisionFromMismatch,
  fromEngineError,
  isRevisionMismatchError,
  rethrowEngine,
} from "./engine-error.js";
import { asReceipt } from "./receipts.js";
import type { ReceiptLike } from "../types.js";

export interface QueryInput {
  pattern?: string;
  select?: Record<string, unknown>;
  require?: "exactlyOne" | "all" | "any" | "first";
  caseSensitive?: boolean;
  wholeWord?: boolean;
  includeDeletedText?: boolean;
  within?: { nodeId: string; nodeType?: string };
  mode?: "contains" | "regex";
}

export interface MatchItem {
  id?: string;
  handle?: { ref?: string };
  address?: { nodeId?: string; nodeType?: string };
  target?: unknown;
  snippet?: string;
}

export interface MatchResult {
  total: number;
  items: MatchItem[];
  evaluatedRevision?: string;
}

export async function currentRevision(doc: SuperDocDocument): Promise<string | number> {
  try {
    const info = await doc.info();
    if (info.revision != null && info.revision !== "") return info.revision;
  } catch {
    // fall through to open snapshot
  }
  const fromOpen = doc.openResult?.document?.revision;
  if (fromOpen != null) return fromOpen;
  return 0;
}

export async function queryMatch(doc: SuperDocDocument, input: QueryInput): Promise<MatchResult> {
  const select =
    input.select ??
    ({
      type: "text",
      pattern: input.pattern ?? "",
      mode: input.mode ?? "contains",
      caseSensitive: input.caseSensitive ?? false,
      wholeWord: input.wholeWord ?? false,
    } as const);

  const params: Record<string, unknown> = {
    select,
    require: input.require ?? "any",
  };
  if (input.within?.nodeId) {
    params.within = {
      kind: "block",
      nodeType: input.within.nodeType ?? "paragraph",
      nodeId: input.within.nodeId,
    };
  }

  try {
    const raw = await doc.query.match(params as never);
    return {
      total: raw.total ?? raw.items?.length ?? 0,
      items: (raw.items ?? []) as MatchItem[],
      evaluatedRevision: raw.evaluatedRevision,
    };
  } catch (err) {
    rethrowEngine(err);
  }
}

export function assertExactlyOne(result: { total?: number; items?: unknown[] }, pattern: string) {
  const total = result.total ?? result.items?.length ?? 0;
  if (total === 0) {
    throw new MorphError("NO_MATCH", `No match for ${pattern}`, { detail: { matchCount: 0 } });
  }
  if (total > 1) {
    throw new MorphError("AMBIGUOUS_MATCH", `Ambiguous match for ${pattern}`, {
      detail: { matchCount: total },
    });
  }
}

export async function buildOutline(doc: SuperDocDocument) {
  const [extract, info, lists] = await Promise.all([
    doc.extract(),
    doc.info(),
    doc.lists.list().catch(() => null),
  ]);

  const listById = new Map<string, { marker?: string; level?: number; path?: number[] }>();
  const listItems = (lists as { items?: Array<Record<string, unknown>> } | null)?.items ?? [];
  for (const item of listItems) {
    const address = item.address as { nodeId?: string } | undefined;
    const id = address?.nodeId ?? (item.nodeId as string | undefined);
    if (id) {
      const path = item.path as number[] | undefined;
      listById.set(id, {
        marker: item.marker as string | undefined,
        level: (item.level as number | undefined) ?? (path ? Math.max(0, path.length - 1) : undefined),
        path,
      });
    }
  }

  const blocks = (extract.blocks ?? []).map((block, index) => {
    const numbering = listById.get(block.nodeId);
    const role =
      block.type === "heading"
        ? `heading${block.headingLevel ?? 1}`
        : block.tableContext
          ? "cell"
          : numbering
            ? "listItem"
            : block.type;
    return {
      blockId: block.nodeId,
      nodeId: block.nodeId,
      type: block.type,
      role,
      depth: block.headingLevel ?? (block.tableContext ? 3 : 0),
      parentId: null as string | null,
      numbering: numbering
        ? {
            label: numbering.marker ?? numbering.path?.join(".") ?? null,
            level: numbering.level ?? null,
            path: numbering.path ?? null,
          }
        : null,
      textPreview: (block.text ?? "").slice(0, 160),
      textLength: (block.text ?? "").length,
      hasTrackedChanges: Boolean(block.textSpans?.some((s) => (s.trackedChanges?.length ?? 0) > 0)),
      gridPos: block.tableContext
        ? { row: block.tableContext.rowIndex, col: block.tableContext.columnIndex }
        : null,
      index,
    };
  });

  return {
    totalBlocks: blocks.length,
    revision: info.revision,
    counts: info.counts,
    outline: info.outline,
    blocks,
  };
}

export async function getBlock(doc: SuperDocDocument, blockId: string) {
  const [node, extract, html] = await Promise.all([
    doc.getNodeById({ nodeId: blockId }).catch(() => null),
    doc.extract(),
    doc.projectHtml({ reviewMode: "redline" } as never).catch(() => null),
  ]);
  const block = extract.blocks.find((b) => b.nodeId === blockId);
  if (!block && !node) {
    throw new MorphError("TARGET_NOT_FOUND", `Block not found: ${blockId}`, { detail: { blockId } });
  }
  const text = block?.text ?? "";
  return {
    blockId,
    type: block?.type ?? "unknown",
    text,
    surviving: text,
    redline: html,
    hasTrackedChanges: Boolean(block?.textSpans?.some((s) => (s.trackedChanges?.length ?? 0) > 0)),
    node,
  };
}

export function textOfBlock(extract: { blocks: Array<{ nodeId: string; text: string }> }, blockId: string) {
  return extract.blocks.find((b) => b.nodeId === blockId)?.text ?? "";
}

export function assertExpectedText(haystack: string, expected?: string) {
  if (!expected) return;
  if (!haystack.includes(expected)) {
    throw new MorphError("PRECONDITION_FAILED", "expectedText was not present in the target block", {
      detail: { expectedText: expected },
    });
  }
}

export async function assertExpectedTextOnMatch(
  doc: SuperDocDocument,
  match: MatchResult,
  expected?: string,
) {
  if (!expected) return;
  const extract = await doc.extract();
  const blockId = match.items[0]?.address?.nodeId;
  const haystack = blockId
    ? textOfBlock(extract, blockId)
    : extract.blocks.map((b) => b.text).join("\n");
  assertExpectedText(haystack, expected);
}

function isFailedRevisionReceipt(receipt: { success: boolean; failure?: { code?: string } }) {
  const code = receipt.failure?.code;
  return !receipt.success && (code === "REVISION_MISMATCH" || code === "STALE_REVISION");
}

export async function withRevisionRetry<T>(
  doc: SuperDocDocument,
  preferred: string | number | undefined,
  run: (expectedRevision: string | number) => Promise<T>,
): Promise<T> {
  const live = await currentRevision(doc);
  const firstRev = preferred ?? live;
  const fallbacks: Array<string | number> = [firstRev];
  if (String(live) !== String(firstRev)) fallbacks.push(live);
  const opened = doc.openResult?.document?.revision;
  if (opened != null && !fallbacks.some((r) => String(r) === String(opened))) fallbacks.push(opened);
  if (!fallbacks.some((r) => String(r) === "0")) fallbacks.push(0);

  let lastErr: unknown;
  for (const rev of fallbacks) {
    try {
      const raw = await run(rev);
      const receipt = asReceipt("mutate", raw, rev);
      if (isFailedRevisionReceipt(receipt)) {
        lastErr = new MorphError("REVISION_MISMATCH", receipt.failure?.message || "revision mismatch");
        continue;
      }
      return raw;
    } catch (err) {
      if (!isRevisionMismatchError(err)) throw fromEngineError(err) ?? err;
      const hinted = currentRevisionFromMismatch(err);
      lastErr = err;
      if (hinted && !fallbacks.some((r) => String(r) === hinted)) {
        fallbacks.push(hinted);
      }
    }
  }
  throw fromEngineError(lastErr) ?? lastErr;
}

export async function applyReplace(
  doc: SuperDocDocument,
  args: { target?: unknown; ref?: string; text: string; expectedRevision?: string | number },
) {
  return withRevisionRetry(doc, args.expectedRevision, (expectedRevision) =>
    doc.replace({
      target: args.target as never,
      ref: args.ref,
      text: args.text,
      expectedRevision: String(expectedRevision),
      changeMode: "tracked",
    } as never),
  );
}

export async function applyAtomic(
  doc: SuperDocDocument,
  args: { steps: unknown[]; expectedRevision?: string | number; changeMode?: string },
) {
  return withRevisionRetry(doc, args.expectedRevision, (expectedRevision) =>
    doc.mutations.apply({
      atomic: true,
      steps: args.steps as never,
      expectedRevision: String(expectedRevision),
      changeMode: args.changeMode || "tracked",
    }),
  );
}

export async function createComment(
  doc: SuperDocDocument,
  args: { text: string; target: unknown },
): Promise<ReceiptLike> {
  // Comment anchors are not a tracked-change operation on this engine (AD-5: label direct).
  const raw = await doc.comments.create({
    text: args.text,
    target: args.target as never,
    changeMode: "direct",
  } as never);
  return {
    ...asReceipt("comments.create", raw),
    changeMode: "direct",
    trackedUnsupported: true,
  };
}

export async function resolveNodeType(
  doc: SuperDocDocument,
  nodeId: string,
  fallback = "paragraph",
): Promise<string> {
  try {
    const extract = await doc.extract();
    const block = extract.blocks.find((b) => b.nodeId === nodeId);
    if (block?.type) return block.type;
  } catch {
    // keep fallback
  }
  return fallback;
}

export function replaceAllSteps(
  search: string,
  replace: string,
  matches: MatchItem[],
  excludedIds: Set<string>,
  selectOpts?: { caseSensitive?: boolean; wholeWord?: boolean },
) {
  const excluded: Array<{ blockId?: string; reason: string }> = [];
  const chosen: MatchItem[] = [];
  for (const item of matches) {
    const blockId = item.address?.nodeId;
    if (blockId && excludedIds.has(blockId)) {
      excluded.push({ blockId, reason: "excluded by caller" });
      continue;
    }
    chosen.push(item);
  }

  const replacement = { args: { replacement: { text: replace } } };
  const refs = chosen.map((item) => item.handle?.ref).filter((ref): ref is string => Boolean(ref));

  // v2 text.rewrite accepts a ref from query.match or a single text selector.
  if (excluded.length === 0) {
    return {
      chosen,
      excluded,
      steps: [
        {
          id: "replace-all-0",
          op: "text.rewrite" as const,
          where: {
            by: "select" as const,
            select: {
              type: "text" as const,
              pattern: search,
              caseSensitive: selectOpts?.caseSensitive,
              wholeWord: selectOpts?.wholeWord,
            },
            require: "all" as const,
          },
          ...replacement,
        },
      ],
    };
  }

  if (refs.length === chosen.length && chosen.length > 0) {
    return {
      chosen,
      excluded,
      steps: chosen.map((item, i) => ({
        id: `replace-all-${i}`,
        op: "text.rewrite" as const,
        where: { by: "ref" as const, ref: item.handle!.ref as string },
        ...replacement,
      })),
    };
  }

  throw new MorphError(
    "CAPABILITY_UNAVAILABLE",
    "v2 replace-all with exclusions needs query.match refs; omitted matches cannot use a single selector",
    { detail: { chosen: chosen.length, refs: refs.length, excluded: excluded.length } },
  );
}
