import type { FastifyInstance } from "fastify";
import { getRegistry } from "../documents/registry.js";

/**
 * Shared-mode rooms stay explicit. Until the sidebar is on SuperDoc v2 this
 * host advertises /collaboration but does not seed a v2 room on upload.
 * promoteToShared is the only room-create path (AD-20).
 */
export async function collaborationRoutes(app: FastifyInstance) {
  app.post("/document/promote-to-shared", async (request, reply) => {
    const body = (request.body ?? {}) as { sessionId?: string };
    if (!body.sessionId) return reply.code(400).send({ code: "VALIDATION", error: "sessionId is required" });
    const meta = await getRegistry().promoteToShared(body.sessionId);
    return {
      sessionId: meta.sessionId,
      accessMode: meta.accessMode,
      roomId: meta.roomId,
      collaborationUrl: getRegistry().collaborationUrl(meta.sessionId, request.headers.host),
    };
  });

  app.get("/collaboration", async (request, reply) => {
    const q = request.query as { room?: string; documentId?: string };
    const room = q.room || q.documentId;
    if (!room) return reply.code(400).send({ code: "VALIDATION", error: "room or documentId is required" });
    const exists = await getRegistry().exists(room);
    if (!exists) return reply.code(404).send({ code: "SESSION_EXPIRED", error: "Session not found" });
    return reply.code(400).send({
      code: "VALIDATION",
      error: "v2 rooms are not created until promoteToShared + sidebar SuperDoc v2 ship together",
      detail: { room, hint: "POST /document/promote-to-shared" },
    });
  });
}
