import type { FastifyInstance } from "fastify";
import { capacityReport } from "../admission/capacity.js";
import { memorySnapshot } from "../admission/memory.js";
import { memoryLimitMb, workerSlots } from "../config/env.js";
import { getRegistry } from "../documents/registry.js";
import { getHost } from "../hosts/sdk-host.js";
import { persistKind } from "../persistence/store.js";
import { MorphError } from "../errors.js";
import { wrap } from "./helpers.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    service: "morph",
    uptime: process.uptime(),
    rssMb: Math.round(memorySnapshot().treeRssMb),
    memory: memorySnapshot(),
    memoryLimitMb: memoryLimitMb(),
    persist: persistKind(),
    host: getHost().stats(),
    workerSlots: workerSlots(),
    capacity: capacityReport(getHost().stats()),
    collaboration: {
      isolated: true,
      v2Rooms: false,
      note: "v2 rooms are not created until promoteToShared + sidebar SuperDoc v2",
    },
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
