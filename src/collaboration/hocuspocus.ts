import type { FastifyInstance } from "fastify";
import { getRegistry } from "../documents/registry.js";
import { MorphError } from "../errors.js";
import { wrap } from "../routes/helpers.js";

/**
 * Shared-mode rooms stay explicit. Until the sidebar is on SuperDoc v2 this
 * host advertises /collaboration but does not seed a v2 room on upload.
 * promoteToShared is the only room-create path (AD-20).
 */
export async function collaborationRoutes(app: FastifyInstance) {
  app.post(
    "/document/promote-to-shared",
    wrap(async (request) => {
      const body = (request.body ?? {}) as { sessionId?: string };
      if (!body.sessionId) throw new MorphError("VALIDATION", "sessionId is required");
      const meta = await getRegistry().promoteToShared(body.sessionId);
      return {
        sessionId: meta.sessionId,
        accessMode: meta.accessMode,
        roomId: meta.roomId,
        collaborationUrl: getRegistry().collaborationUrl(meta.sessionId, {
          host: request.headers.host,
          proto: String(request.headers["x-forwarded-proto"] || request.protocol || ""),
        }),
        note: "v2 rooms are not created until the sidebar SuperDoc v2 ships. Isolated agent edits do not use this path.",
      };
    }),
  );

  app.get(
    "/collaboration",
    wrap(async (request) => {
      const q = request.query as { room?: string; documentId?: string };
      const room = q.room || q.documentId;
      if (!room) throw new MorphError("VALIDATION", "room or documentId is required");
      const exists = await getRegistry().exists(room);
      if (!exists) throw new MorphError("SESSION_EXPIRED", "Session not found", { status: 404 });
      throw new MorphError(
        "CAPABILITY_UNAVAILABLE",
        "v2 rooms are not created until promoteToShared + sidebar SuperDoc v2 ship together",
        { detail: { room, hint: "POST /document/promote-to-shared" } },
      );
    }),
  );
}
