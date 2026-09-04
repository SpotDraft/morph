import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { SuperDocDocument } from "@superdoc/sdk";
import { admitOrThrow } from "../admission/memory.js";
import { MorphError } from "../errors.js";
import { getHost, type SdkHost } from "../hosts/sdk-host.js";
import { getPersistence, type Persistence } from "../persistence/store.js";
import type { AccessMode, ReceiptLike, SessionMeta, UserInfo } from "../types.js";
import { noteFirstOpen } from "../services/analytics.js";
import { asReceipt, assertReceipt, isRetryable, revisionOf } from "./receipts.js";

export interface CreateSessionInput {
  sessionId: string;
  user: UserInfo;
  fileName: string;
  bytes: Buffer;
}

export class DocumentRegistry {
  constructor(
    private readonly persist: Persistence = getPersistence(),
    private readonly host: SdkHost = getHost(),
  ) {}

  async exists(sessionId: string): Promise<boolean> {
    return this.persist.exists(sessionId);
  }

  async requireSession(sessionId: string): Promise<SessionMeta> {
    const rec = await this.persist.load(sessionId);
    if (!rec) {
      throw new MorphError("SESSION_EXPIRED", "Session not found or expired", { status: 404 });
    }
    await this.persist.touch(sessionId);
    return rec.meta;
  }

  async createIsolated(input: CreateSessionInput): Promise<SessionMeta> {
    admitOrThrow("upload");
    if (!input.user.userid || input.user.userid === "anonymous" || !input.user.username) {
      throw new MorphError("MISSING_USER", "userid and username are required", { status: 400 });
    }
    const now = new Date().toISOString();
    const meta: SessionMeta = {
      sessionId: input.sessionId,
      user: input.user,
      accessMode: "isolated",
      fileName: input.fileName || "document.docx",
      lastGoodRevision: null,
      lastGoodAt: now,
      createdAt: now,
    };
    await this.persist.save({ meta, lastGood: input.bytes, original: input.bytes });

    const doc = await this.host.openIsolated({
      sessionId: input.sessionId,
      user: input.user,
      lastGood: input.bytes,
    });
    try {
      const info = await doc.info();
      meta.capabilities = info.capabilities;
      const lastGood = await this.exportBytes(doc, input.sessionId, "last-good");
      const after = await doc.info().catch(() => info);
      meta.lastGoodRevision = after.revision ?? info.revision ?? revisionOf(doc);
      meta.lastGoodAt = new Date().toISOString();
      await this.persist.save({ meta, lastGood, original: input.bytes });
      noteFirstOpen(input.sessionId);
      return meta;
    } catch (err) {
      await this.host.closeHandle(input.sessionId);
      throw err;
    }
  }

  async withDoc<T>(
    sessionId: string,
    fn: (doc: SuperDocDocument, meta: SessionMeta) => Promise<T>,
  ): Promise<T> {
    const rec = await this.persist.load(sessionId);
    if (!rec) {
      throw new MorphError("SESSION_EXPIRED", "Session not found or expired", { status: 404 });
    }
    if (rec.meta.accessMode === "shared") {
      throw new MorphError("VALIDATION", "Isolated open is illegal while accessMode is shared", {
        detail: { accessMode: rec.meta.accessMode },
      });
    }
    await this.persist.touch(sessionId);
    const doc = await this.host.openIsolated({
      sessionId,
      user: rec.meta.user,
      lastGood: rec.lastGood,
    });
    this.host.markUsed(sessionId);
    return fn(doc, rec.meta);
  }

  async mutate<T extends ReceiptLike | Record<string, unknown>>(
    sessionId: string,
    operation: string,
    run: (doc: SuperDocDocument, meta: SessionMeta) => Promise<T>,
  ): Promise<T> {
    admitOrThrow(operation);
    return this.withDoc(sessionId, async (doc, meta) => {
      let active = doc;
      const runOnce = async (handle: SuperDocDocument, sessionMeta: SessionMeta) => {
        const raw = await run(handle, sessionMeta);
        const receipt = asReceipt(operation, raw, sessionMeta.lastGoodRevision);
        assertReceipt(receipt);
        return { raw, receipt };
      };

      let result: { raw: T; receipt: ReceiptLike };
      try {
        result = await runOnce(active, meta);
      } catch (err) {
        if (!isRetryable(err)) throw err;
        await this.host.closeHandle(sessionId);
        const rec = await this.persist.load(sessionId);
        if (!rec) throw err;
        active = await this.host.openIsolated({
          sessionId,
          user: rec.meta.user,
          lastGood: rec.lastGood,
        });
        result = await runOnce(active, rec.meta);
      }

      await this.flushLastGood(sessionId, active, result.receipt);
      return result.raw;
    });
  }

  async flushLastGood(sessionId: string, doc: SuperDocDocument, receipt?: ReceiptLike): Promise<void> {
    const rec = await this.persist.load(sessionId);
    if (!rec) return;
    try {
      const bytes = await this.exportBytes(doc, sessionId, "last-good");
      rec.meta.lastGoodAt = new Date().toISOString();
      rec.meta.lastGoodRevision = receipt?.afterRevision ?? rec.meta.lastGoodRevision;
      await this.persist.save({ ...rec, lastGood: bytes });
    } catch (err) {
      throw new MorphError("PERSIST_FAILED", "Failed to persist last-good DOCX", {
        status: 503,
        detail: { sessionId, cause: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  async exportBytes(doc: SuperDocDocument, sessionId: string, label: string): Promise<Buffer> {
    const out = path.join(os.tmpdir(), "morph-export", sessionId, `${label}-${randomUUID()}.docx`);
    await mkdir(path.dirname(out), { recursive: true });
    await this.host.saveDistinct(doc, out);
    return readFile(out);
  }

  async exportArtifact(sessionId: string): Promise<{ bytes: Buffer; fileName: string }> {
    admitOrThrow("export");
    return this.withDoc(sessionId, async (doc, meta) => {
      const bytes = await this.exportBytes(doc, sessionId, "artifact");
      return { bytes, fileName: meta.fileName };
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.host.closeHandle(sessionId);
    await this.persist.delete(sessionId);
  }

  async promoteToShared(sessionId: string): Promise<SessionMeta> {
    const rec = await this.persist.load(sessionId);
    if (!rec) {
      throw new MorphError("SESSION_EXPIRED", "Session not found or expired", { status: 404 });
    }
    if (rec.meta.roomId && rec.meta.roomId !== sessionId) {
      throw new MorphError("VALIDATION", "A different room identity already exists", {
        detail: { roomId: rec.meta.roomId },
      });
    }
    rec.meta.accessMode = "shared";
    rec.meta.roomId = sessionId;
    await this.persist.save(rec);
    return rec.meta;
  }

  collaborationUrl(sessionId: string, hostHeader?: string): string {
    const base =
      process.env.MORPH_PUBLIC_BASE_URL ||
      (hostHeader ? `ws://${hostHeader}` : `ws://127.0.0.1:${process.env.PORT || "5006"}`);
    const ws = base.replace(/^http/, "ws");
    return `${ws.replace(/\/$/, "")}/collaboration/${sessionId}`;
  }
}

let registry: DocumentRegistry | undefined;

export function getRegistry(): DocumentRegistry {
  registry ??= new DocumentRegistry();
  return registry;
}

export function setRegistry(next: DocumentRegistry): void {
  registry = next;
}

export function requireUser(raw: unknown): UserInfo {
  const user = (raw ?? {}) as Record<string, unknown>;
  const userid = typeof user.userid === "string" ? user.userid.trim() : "";
  const username = typeof user.username === "string" ? user.username.trim() : "";
  if (!userid || userid === "anonymous" || !username) {
    throw new MorphError("MISSING_USER", "userid and username are required", { status: 400 });
  }
  return {
    userid,
    username,
    name: typeof user.name === "string" ? user.name : username,
    email: typeof user.email === "string" ? user.email : undefined,
  };
}

export async function writeTemp(bytes: Buffer, name = "upload.docx"): Promise<string> {
  const dir = path.join(os.tmpdir(), "morph-upload", randomUUID());
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await writeFile(file, bytes);
  return file;
}
