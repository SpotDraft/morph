import type { FastifyReply, FastifyRequest } from "fastify";
import { memoryHeaders } from "../admission/memory.js";
import { fromEngineError } from "../documents/engine-error.js";
import { MorphError, httpErrorBody } from "../errors.js";

export function sessionIdOf(request: FastifyRequest): string {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const params = request.params as Record<string, string | undefined>;
  const query = request.query as Record<string, string | undefined>;
  const id =
    (typeof body.sessionId === "string" && body.sessionId) ||
    params.sessionId ||
    query.sessionId;
  if (!id) {
    throw new MorphError("VALIDATION", "sessionId is required", { status: 400 });
  }
  return id;
}

export function fromUnknown(err: unknown): MorphError {
  if (err instanceof MorphError) return err;
  const engine = fromEngineError(err);
  if (engine) return engine;
  const rec = err as { code?: string; statusCode?: number; message?: string; validation?: unknown };
  if (rec?.code === "FST_ERR_CTP_INVALID_JSON" || rec?.validation || rec?.code === "FST_ERR_VALIDATION") {
    return new MorphError("VALIDATION", rec.message || "Invalid request", {
      detail: { fastify: rec.code, validation: rec.validation ?? null },
    });
  }
  return new MorphError("ENGINE_FAILURE", rec?.message || String(err), { status: 503, retryAfter: 10 });
}

export async function sendError(reply: FastifyReply, err: unknown) {
  const mapped = fromUnknown(err);
  if (mapped.retryAfter) reply.header("Retry-After", String(mapped.retryAfter));
  for (const [k, v] of Object.entries(memoryHeaders())) reply.header(k, v);
  return reply.code(mapped.status).send(httpErrorBody(mapped));
}

export function wrap(
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await handler(request, reply);
    } catch (err) {
      return sendError(reply, err);
    }
  };
}
