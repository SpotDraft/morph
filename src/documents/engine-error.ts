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
  if (/ambiguous/i.test(message) || code === "AMBIGUOUS_TARGET") {
    return new MorphError("AMBIGUOUS_MATCH", message, { detail: { engineCode: code, details } });
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
