import { createWriteStream } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance } from "fastify";
import { FETCH_TIMEOUT, MAX_FILE_SIZE } from "../config/env.js";
import { getRegistry, requireUser } from "../documents/registry.js";
import { MorphError } from "../errors.js";
import { wrap } from "./helpers.js";

async function fetchUrl(url: string): Promise<Buffer> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      throw new MorphError("VALIDATION", `Upload URL returned ${res.status}`, { status: 400 });
    }
    const len = Number(res.headers.get("content-length") || "0");
    if (len > MAX_FILE_SIZE) {
      throw new MorphError("VALIDATION", "File exceeds MAX_FILE_SIZE", { status: 400 });
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_FILE_SIZE) {
      throw new MorphError("VALIDATION", "File exceeds MAX_FILE_SIZE", { status: 400 });
    }
    return bytes;
  } finally {
    clearTimeout(t);
  }
}

export async function uploadRoutes(app: FastifyInstance) {
  app.post(
    "/upload",
    wrap(async (request, reply) => {
      const isMultipart = request.isMultipart?.() ?? false;
      let sessionId: string;
      let userRaw: unknown;
      let fileName = "document.docx";
      let bytes: Buffer;

      if (isMultipart) {
        const parts = request.parts();
        let buffer: Buffer | null = null;
        const fields: Record<string, string> = {};
        for await (const part of parts) {
          if (part.type === "file") {
            fileName = part.filename || fileName;
            const tmp = path.join(os.tmpdir(), `morph-up-${Date.now()}.docx`);
            await pipeline(part.file, createWriteStream(tmp));
            buffer = await readFile(tmp);
            await unlink(tmp).catch(() => undefined);
          } else {
            fields[part.fieldname] = String(part.value);
          }
        }
        if (!buffer) throw new MorphError("VALIDATION", "DOCX file is required");
        bytes = buffer;
        sessionId = fields.sessionId;
        userRaw = fields.user ? safeJson(fields.user) : undefined;
      } else {
        const body = (request.body ?? {}) as Record<string, unknown>;
        sessionId = String(body.sessionId || "");
        userRaw = body.user;
        if (typeof body.url === "string" && body.url) {
          bytes = await fetchUrl(body.url);
          fileName = (body.fileName as string) || fileNameFromUrl(body.url);
        } else if (typeof body.base64 === "string") {
          bytes = Buffer.from(body.base64, "base64");
        } else {
          throw new MorphError("VALIDATION", "Provide multipart file, url, or base64");
        }
        if (typeof body.fileName === "string") fileName = body.fileName;
      }

      if (!sessionId) throw new MorphError("VALIDATION", "sessionId is required");
      const user = requireUser(userRaw);
      const meta = await getRegistry().createIsolated({ sessionId, user, fileName, bytes });
      return reply.send({
        sessionId: meta.sessionId,
        fileName: meta.fileName,
        collaborationUrl: getRegistry().collaborationUrl(meta.sessionId, {
          host: request.headers.host,
          proto: String(request.headers["x-forwarded-proto"] || request.protocol || ""),
        }),
        user,
        accessMode: meta.accessMode,
        capabilities: meta.capabilities,
        lastGoodRevision: meta.lastGoodRevision,
      });
    }),
  );
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function fileNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.split("/").pop() || "document.docx");
  } catch {
    return "document.docx";
  }
}
