import type { FailureCode } from "../errors.js";

export function nextActionFor(code: FailureCode): string {
  switch (code) {
    case "SESSION_EXPIRED":
      return "Re-upload the DOCX. 404 means the session is gone, not that the clause is missing.";
    case "MISSING_USER":
      return "Send userid and username on upload. Do not use anonymous.";
    case "NO_MATCH":
      return "Call /document/inspect or /document/query with a shorter unique phrase, then retry.";
    case "AMBIGUOUS_MATCH":
      return "Add within.blockId from /document/inspect, or a longer unique phrase, and require exactlyOne.";
    case "PRECONDITION_FAILED":
    case "STALE_TARGET":
      return "Re-read the block with /document/block and send the current expectedText.";
    case "REVISION_MISMATCH":
    case "STALE_REVISION":
    case "ADDRESS_STALE":
      return "Host already retried once. Re-query and send the new evaluatedRevision. Do not drop expectedRevision.";
    case "TARGET_NOT_FOUND":
      return "The nodeId is gone. Call /document/inspect and use a fresh nodeId.";
    case "OFFSET_FORBIDDEN":
    case "POSITION_FORBIDDEN":
      return "Do not send from/to or a numeric position. Use query, blockId, or before/after a nodeId.";
    case "INVALID_ANCHOR":
    case "INVALID_LEVEL":
    case "STRUCTURE_VIOLATION":
    case "WOULD_SPLIT_BLOCK":
    case "WOULD_DAMAGE_TRACKED_CHANGE":
      return "Use a structural before/after target from /document/inspect. Do not insert inside a heading run.";
    case "CAPABILITY_UNAVAILABLE":
    case "NO_OP":
      return "This engine operation is unavailable or a no-op. If the message mentions a tracked wrapper, rewrite the whole clause with /document/replace instead of a range inside the prior redline. Otherwise pick another tool from GET /document/tools.";
    case "ADMISSION":
      return "Retry after Retry-After. The host is at its memory or worker-slot budget.";
    case "PERSIST_FAILED":
    case "ENGINE_FAILURE":
      return "Retry once after Retry-After. If it repeats, the last-good DOCX is still the session.";
    case "ENCRYPTED_DOC":
      return "Upload an unencrypted DOCX.";
    case "VALIDATION":
      return "Fix the request fields listed in detail and retry. Do not invent a second write path.";
    case "UNKNOWN_ROUTE":
      return "This path is not a tool. Call GET /document/tools and use an advertised path. This is not session expiry.";
    default:
      return "Read code and detail. Retry only 429/503. Treat 404 as session expiry.";
  }
}
