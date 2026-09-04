import type { FastifyInstance } from "fastify";
import { agentRoutes } from "./agent.js";
import { compatRoutes } from "./compat.js";
import { documentRoutes } from "./document.js";
import { healthRoutes } from "./health.js";
import { uploadRoutes } from "./upload.js";

export async function registerRoutes(app: FastifyInstance) {
  await healthRoutes(app);
  await uploadRoutes(app);
  await documentRoutes(app);
  await agentRoutes(app);
  await compatRoutes(app);
}
