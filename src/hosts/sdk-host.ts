import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SuperDocClient, type SuperDocDocument } from "@superdoc/sdk";
import { HANDLE_IDLE_MS, WORKER_SLOTS, superdocLicenseKey } from "../config/env.js";
import { MorphError } from "../errors.js";
import type { UserInfo } from "../types.js";
import { admitOrThrow } from "../admission/memory.js";

export interface OpenHandleOptions {
  user: UserInfo;
  lastGood: Buffer;
  sessionId: string;
}

interface WarmHandle {
  doc: SuperDocDocument;
  lastUsed: number;
  sessionId: string;
}

export class SdkHost {
  private client: SuperDocClient | null = null;
  private connecting: Promise<SuperDocClient> | null = null;
  private readonly warm = new Map<string, WarmHandle>();
  private openCount = 0;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.idleTimer = setInterval(() => {
      void this.reapIdle();
    }, Math.min(HANDLE_IDLE_MS, 30_000));
    this.idleTimer.unref();
  }

  slotsAvailable(): boolean {
    return this.openCount < WORKER_SLOTS;
  }

  async getClient(): Promise<SuperDocClient> {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;
    this.connecting = this.boot();
    try {
      this.client = await this.connecting;
      return this.client;
    } finally {
      this.connecting = null;
    }
  }

  private async boot(): Promise<SuperDocClient> {
    const client = new SuperDocClient({
      defaultChangeMode: "tracked",
      runtime: "v2",
      env: {
        ...process.env,
        SUPERDOC_PUBLIC_LICENSE_KEY: superdocLicenseKey(),
      },
      requestTimeoutMs: 120_000,
    });
    await client.connect();
    return client;
  }

  async openIsolated(opts: OpenHandleOptions): Promise<SuperDocDocument> {
    admitOrThrow("open");
    if (!this.slotsAvailable()) {
      throw new MorphError("ADMISSION", "No engine worker slots", {
        status: 503,
        retryAfter: 10,
        detail: { slots: WORKER_SLOTS, open: this.openCount },
      });
    }
    const existing = this.warm.get(opts.sessionId);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing.doc;
    }

    const client = await this.getClient();
    const workDir = path.join(os.tmpdir(), "morph-sdk", opts.sessionId);
    await mkdir(workDir, { recursive: true });
    const docPath = path.join(workDir, "working.docx");
    await writeFile(docPath, opts.lastGood);

    const doc = await client.open({
      doc: docPath,
      sessionId: opts.sessionId,
      runtime: "v2",
      userName: opts.user.username || opts.user.name,
      userEmail: opts.user.email,
    });
    this.openCount += 1;
    this.warm.set(opts.sessionId, { doc, lastUsed: Date.now(), sessionId: opts.sessionId });
    return doc;
  }

  markUsed(sessionId: string): void {
    const h = this.warm.get(sessionId);
    if (h) h.lastUsed = Date.now();
  }

  async closeHandle(sessionId: string, discard = true): Promise<void> {
    const h = this.warm.get(sessionId);
    if (!h) return;
    this.warm.delete(sessionId);
    this.openCount = Math.max(0, this.openCount - 1);
    try {
      await h.doc.close({ discard });
    } catch {
      // best-effort
    }
  }

  async saveDistinct(doc: SuperDocDocument, outPath: string): Promise<void> {
    await mkdir(path.dirname(outPath), { recursive: true });
    const result = await doc.save({ out: outPath, force: true });
    if (result && "saved" in result && result.saved === false) {
      throw new MorphError("ENGINE_FAILURE", "SDK save reported not saved", {
        status: 503,
        detail: { path: outPath },
      });
    }
  }

  async dispose(): Promise<void> {
    if (this.idleTimer) clearInterval(this.idleTimer);
    const ids = [...this.warm.keys()];
    await Promise.all(ids.map((id) => this.closeHandle(id)));
    if (this.client) {
      try {
        await this.client.dispose();
      } catch {
        // best-effort
      }
      this.client = null;
    }
  }

  private async reapIdle(): Promise<void> {
    const now = Date.now();
    for (const [id, h] of this.warm) {
      if (now - h.lastUsed > HANDLE_IDLE_MS) {
        await this.closeHandle(id);
      }
    }
  }
}

let host: SdkHost | undefined;

export function getHost(): SdkHost {
  host ??= new SdkHost();
  return host;
}

export function setHost(next: SdkHost): void {
  host = next;
}
