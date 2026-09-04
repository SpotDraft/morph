import { MorphError, STALE_RETRY_CODES, mapEngineCode, type FailureCode } from "../errors.js";
import type { ReceiptLike } from "../types.js";

export function unwrapEngine(raw: unknown): Record<string, unknown> {
  const rec = (raw ?? {}) as Record<string, unknown>;
  const nested = rec.receipt;
  if (nested && typeof nested === "object") {
    return { ...rec, ...(nested as Record<string, unknown>) };
  }
  return rec;
}

export function asReceipt(operation: string, raw: unknown, before?: string | number | null): ReceiptLike {
  const rec = unwrapEngine(raw);
  const success = rec.success !== false && !rec.failure;
  const failure = rec.failure as ReceiptLike["failure"] | undefined;
  const after =
    rec.afterRevision ??
    rec.revision ??
    (rec.context as { revision?: number } | undefined)?.revision ??
    (rec.document as { revision?: number } | undefined)?.revision;
  return {
    ...rec,
    success,
    operation,
    failure,
    beforeRevision: before ?? null,
    afterRevision: after ?? null,
  };
}

export function assertReceipt(receipt: ReceiptLike): ReceiptLike {
  if (receipt.success) return receipt;
  const code = mapEngineCode(receipt.failure?.code);
  throw new MorphError(code, receipt.failure?.message || `${receipt.operation} failed`, {
    status: code === "ENGINE_FAILURE" ? 503 : 400,
    detail: {
      failure: receipt.failure,
      beforeRevision: receipt.beforeRevision,
      afterRevision: receipt.afterRevision,
    },
  });
}

export function isRetryable(err: unknown): err is MorphError {
  return err instanceof MorphError && STALE_RETRY_CODES.has(err.code as FailureCode);
}

/**
 * Only drop the warm handle when the engine may be in an unknown state.
 * A typed 400 (NO_MATCH, AMBIGUOUS_MATCH, PRECONDITION_FAILED, VALIDATION, …)
 * mutated nothing, so discarding it costs a full engine boot for free.
 */
export function shouldDiscardHandle(err: unknown): boolean {
  if (err instanceof MorphError) return err.code === "ENGINE_FAILURE";
  return true;
}

export function revisionOf(doc: { openResult?: { document?: { revision?: number } } }, fallback?: unknown): string | number | null {
  const fromOpen = doc.openResult?.document?.revision;
  if (fromOpen != null) return fromOpen;
  if (typeof fallback === "string" || typeof fallback === "number") return fallback;
  return null;
}
