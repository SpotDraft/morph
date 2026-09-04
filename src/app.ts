import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { MAX_FILE_SIZE } from "./config/env.js";
import { MorphError, httpErrorBody } from "./errors.js";
import { collaborationRoutes } from "./collaboration/hocuspocus.js";
import { registerRoutes } from "./routes/index.js";
import { sendError } from "./routes/helpers.js";

export async function createApp() {
  const app = Fastify({ logger: false, bodyLimit: MAX_FILE_SIZE });
  await app.register(cors, { origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] });
  await app.register(multipart);
  await app.register(websocket);
  await registerRoutes(app);
  await collaborationRoutes(app);
  app.setErrorHandler(async (err, _request, reply) => sendError(reply, err));
  app.setNotFoundHandler(async (request, reply) => {
    const mapped = new MorphError(
      "UNKNOWN_ROUTE",
      `Unknown route ${request.method} ${request.url}`,
      { status: 400, detail: { method: request.method, url: request.url } },
    );
    return reply.code(400).send(httpErrorBody(mapped));
  });
  return app;
}
