import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { MAX_FILE_SIZE } from "./config/env.js";
import { collaborationRoutes } from "./collaboration/hocuspocus.js";
import { registerRoutes } from "./routes/index.js";

export async function createApp() {
  const app = Fastify({ logger: false, bodyLimit: MAX_FILE_SIZE });
  await app.register(cors, { origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] });
  await app.register(multipart);
  await app.register(websocket);
  await registerRoutes(app);
  await collaborationRoutes(app);
  return app;
}
