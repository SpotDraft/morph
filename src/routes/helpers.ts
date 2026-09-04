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

export async function sendError(reply: FastifyReply, err: unknown) {
  const mapped = err instanceof MorphError ? err : fromEngineError(err);
  if (mapped) {
    if (mapped.retryAfter) reply.header("Retry-After", String(mapped.retryAfter));
    for (const [k, v] of Object.entries(memoryHeaders())) reply.header(k, v);
    return reply.code(mapped.status).send(httpErrorBody(mapped));
  }
  const message = err instanceof Error ? err.message : String(err);
  return reply.code(500).send({
    success: false,
    ok: false,
    code: "ENGINE_FAILURE",
    error: message,
    message,
    detail: {},
  });
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
