import type { FastifyInstance } from "fastify";
import { rssMb } from "../admission/memory.js";
import { memoryLimitMb } from "../config/env.js";
import { getRegistry } from "../documents/registry.js";
import { MorphError } from "../errors.js";
import { wrap } from "./helpers.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    service: "morph",
    uptime: process.uptime(),
    rssMb: Math.round(rssMb()),
    memoryLimitMb: memoryLimitMb(),
  }));

  app.get(
    "/validate-session/:sessionId",
    wrap(async (request) => {
      const { sessionId } = request.params as { sessionId: string };
      const ok = await getRegistry().exists(sessionId);
      if (!ok) throw new MorphError("SESSION_EXPIRED", "Session not found or expired", { status: 404 });
      return { valid: true, sessionId };
    }),
  );

  app.get("/sessions", async () => ({ sessions: [], note: "list is not persisted as an index" }));

  app.delete(
    "/session/:sessionId",
    wrap(async (request) => {
      const { sessionId } = request.params as { sessionId: string };
      if (!(await getRegistry().exists(sessionId))) {
        throw new MorphError("SESSION_EXPIRED", "Session not found", { status: 404 });
      }
      await getRegistry().deleteSession(sessionId);
      return { success: true };
    }),
  );
}
