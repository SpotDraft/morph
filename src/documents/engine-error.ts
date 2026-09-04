import { SuperDocCliError } from "@superdoc/sdk";
import { MorphError, mapEngineCode } from "../errors.js";

export function fromEngineError(err: unknown): MorphError | null {
  if (err instanceof MorphError) return err;
  if (!(err instanceof SuperDocCliError) && !(err instanceof Error)) return null;

  const code = err instanceof SuperDocCliError ? err.code : undefined;
  const details = err instanceof SuperDocCliError ? err.details : undefined;
  const message = err instanceof Error ? err.message : String(err);

  if (/zero nodes|no match|MATCH_NOT_FOUND|matched zero/i.test(message) || code === "MATCH_NOT_FOUND") {
    return new MorphError("NO_MATCH", message, { detail: { engineCode: code, details } });
  }
  if (/requires a target|is required|invalid argument|missing required/i.test(message)) {
    return new MorphError("VALIDATION", message, { detail: { engineCode: code, details } });
  }
  if (/ambiguous/i.test(message) || code === "AMBIGUOUS_TARGET") {
    return new MorphError("AMBIGUOUS_MATCH", message, { detail: { engineCode: code, details } });
  }
  if (/encrypted|password.?protect/i.test(message)) {
    return new MorphError("ENCRYPTED_DOC", message, { detail: { engineCode: code, details } });
  }
  if (/tracked-wrapper|unsupported-tracked/i.test(message)) {
    return new MorphError("CAPABILITY_UNAVAILABLE", message, {
      detail: {
        engineCode: code,
        details,
        workaround: "Rewrite the whole clause with /document/replace; do not target a range inside a prior redline.",
      },
    });
  }
  if (/unavailable|not supported|unsupported|not implemented/i.test(message)) {
    return new MorphError("CAPABILITY_UNAVAILABLE", message, { detail: { engineCode: code, details } });
  }
  if (code) {
    const mapped = mapEngineCode(code);
    return new MorphError(mapped, message, {
      status: mapped === "ENGINE_FAILURE" ? 503 : 400,
      detail: { engineCode: code, details },
    });
  }
  return null;
}

export function rethrowEngine(err: unknown): never {
  throw fromEngineError(err) ?? err;
}

/** Engine mismatch messages look like: expected-revision sd-… does not match current revision 0 */
export function currentRevisionFromMismatch(err: unknown): string | undefined {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  const match = message.match(/current revision\s+([^\s.]+)/i);
  return match?.[1];
}

export function isRevisionMismatchError(err: unknown): boolean {
  const mapped = fromEngineError(err);
  if (mapped?.code === "REVISION_MISMATCH" || mapped?.code === "STALE_REVISION") return true;
  if (err instanceof MorphError && (err.code === "REVISION_MISMATCH" || err.code === "STALE_REVISION")) return true;
  return /REVISION_MISMATCH|STALE_REVISION|does not match current revision/i.test(
    err instanceof Error ? err.message : String(err),
  );
}
