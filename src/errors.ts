export type FailureCode =
  | "SESSION_EXPIRED"
  | "MISSING_USER"
  | "AMBIGUOUS_MATCH"
  | "PRECONDITION_FAILED"
  | "STALE_TARGET"
  | "WOULD_SPLIT_BLOCK"
  | "WOULD_DAMAGE_TRACKED_CHANGE"
  | "STRUCTURE_VIOLATION"
  | "INVALID_ANCHOR"
  | "INVALID_LEVEL"
  | "OFFSET_FORBIDDEN"
  | "POSITION_FORBIDDEN"
  | "VALIDATION"
  | "NO_MATCH"
  | "TARGET_NOT_FOUND"
  | "REVISION_MISMATCH"
  | "STALE_REVISION"
  | "ADDRESS_STALE"
  | "NO_OP"
  | "CAPABILITY_UNAVAILABLE"
  | "ENGINE_FAILURE"
  | "PERSIST_FAILED"
  | "ADMISSION"
  | "ENCRYPTED_DOC";

export class MorphError extends Error {
  readonly code: FailureCode;
  readonly status: number;
  readonly detail: Record<string, unknown>;
  readonly retryAfter?: number;

  constructor(
    code: FailureCode,
    message: string,
    options?: {
      status?: number;
      detail?: Record<string, unknown>;
      retryAfter?: number;
    },
  ) {
    super(message);
    this.name = "MorphError";
    this.code = code;
    this.status =
      options?.status ??
      (code === "SESSION_EXPIRED"
        ? 404
        : code === "ADMISSION" || code === "PERSIST_FAILED" || code === "ENGINE_FAILURE"
          ? 503
          : 400);
    this.detail = options?.detail ?? {};
    this.retryAfter = options?.retryAfter;
  }
}

export function httpErrorBody(err: MorphError) {
  return {
    success: false,
    ok: false,
    code: err.code,
    error: err.message,
    message: err.message,
    detail: err.detail,
  };
}

export function mapEngineCode(code: string | undefined): FailureCode {
  switch (code) {
    case "REVISION_MISMATCH":
    case "STALE_REVISION":
    case "ADDRESS_STALE":
    case "TARGET_NOT_FOUND":
    case "NO_OP":
    case "CAPABILITY_UNAVAILABLE":
    case "TRACK_CHANGE_COMMAND_UNAVAILABLE":
      return code === "TRACK_CHANGE_COMMAND_UNAVAILABLE" ? "CAPABILITY_UNAVAILABLE" : code;
    case "MATCH_NOT_FOUND":
      return "NO_MATCH";
    case "AMBIGUOUS_TARGET":
      return "AMBIGUOUS_MATCH";
    default:
      return "ENGINE_FAILURE";
  }
}

export const STALE_RETRY_CODES = new Set<FailureCode>([
  "REVISION_MISMATCH",
  "STALE_REVISION",
  "ADDRESS_STALE",
  "TARGET_NOT_FOUND",
]);
