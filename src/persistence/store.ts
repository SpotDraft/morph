import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import Redis from "ioredis";
import { DATA_DIR, REDIS_URI, SESSION_TTL_SECONDS } from "../config/env.js";
import type { PersistRecord, SessionMeta } from "../types.js";

export interface Persistence {
  save(record: PersistRecord): Promise<void>;
  load(sessionId: string): Promise<PersistRecord | null>;
  exists(sessionId: string): Promise<boolean>;
  delete(sessionId: string): Promise<void>;
  touch(sessionId: string): Promise<void>;
}

const KEY = {
  meta: (id: string) => `morph:meta:${id}`,
  lastGood: (id: string) => `morph:last-good:${id}`,
  original: (id: string) => `morph:original:${id}`,
};

export class MemoryPersistence implements Persistence {
  private readonly records = new Map<string, PersistRecord>();

  async save(record: PersistRecord): Promise<void> {
    this.records.set(record.meta.sessionId, {
      meta: { ...record.meta },
      lastGood: Buffer.from(record.lastGood),
      original: record.original ? Buffer.from(record.original) : undefined,
    });
  }

  async load(sessionId: string): Promise<PersistRecord | null> {
    const rec = this.records.get(sessionId);
    if (!rec) return null;
    return {
      meta: { ...rec.meta },
      lastGood: Buffer.from(rec.lastGood),
      original: rec.original ? Buffer.from(rec.original) : undefined,
    };
  }

  async exists(sessionId: string): Promise<boolean> {
    return this.records.has(sessionId);
  }

  async delete(sessionId: string): Promise<void> {
    this.records.delete(sessionId);
  }

  async touch(_sessionId: string): Promise<void> {}
}

export class FilePersistence implements Persistence {
  constructor(private readonly root: string) {}

  private dir(sessionId: string) {
    return path.join(this.root, encodeURIComponent(sessionId));
  }

  async save(record: PersistRecord): Promise<void> {
    const dir = this.dir(record.meta.sessionId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "meta.json"), JSON.stringify(record.meta));
    await writeFile(path.join(dir, "last-good.docx"), record.lastGood);
    if (record.original) {
      await writeFile(path.join(dir, "original.docx"), record.original);
    }
  }

  async load(sessionId: string): Promise<PersistRecord | null> {
    try {
      const dir = this.dir(sessionId);
      const meta = JSON.parse(await readFile(path.join(dir, "meta.json"), "utf8")) as SessionMeta;
      const lastGood = await readFile(path.join(dir, "last-good.docx"));
      let original: Buffer | undefined;
      try {
        original = await readFile(path.join(dir, "original.docx"));
      } catch {
        original = undefined;
      }
      return { meta, lastGood, original };
    } catch {
      return null;
    }
  }

  async exists(sessionId: string): Promise<boolean> {
    return (await this.load(sessionId)) != null;
  }

  async delete(sessionId: string): Promise<void> {
    await rm(this.dir(sessionId), { recursive: true, force: true });
  }

  async touch(_sessionId: string): Promise<void> {}
}

export class RedisPersistence implements Persistence {
  private readonly redis: Redis;

  constructor(uri: string) {
    this.redis = new Redis(uri, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  async connect(): Promise<void> {
    if (this.redis.status === "wait") await this.redis.connect();
  }

  async save(record: PersistRecord): Promise<void> {
    await this.connect();
    const id = record.meta.sessionId;
    const ttl = SESSION_TTL_SECONDS;
    const pipeline = this.redis.multi();
    pipeline.set(KEY.meta(id), JSON.stringify(record.meta), "EX", ttl);
    pipeline.set(KEY.lastGood(id), record.lastGood, "EX", ttl);
    if (record.original) {
      pipeline.set(KEY.original(id), record.original, "EX", ttl);
    }
    await pipeline.exec();
  }

  async load(sessionId: string): Promise<PersistRecord | null> {
    await this.connect();
    const [metaRaw, lastGood, original] = await Promise.all([
      this.redis.get(KEY.meta(sessionId)),
      this.redis.getBuffer(KEY.lastGood(sessionId)),
      this.redis.getBuffer(KEY.original(sessionId)),
    ]);
    if (!metaRaw || !lastGood) return null;
    return {
      meta: JSON.parse(metaRaw) as SessionMeta,
      lastGood,
      original: original ?? undefined,
    };
  }

  async exists(sessionId: string): Promise<boolean> {
    await this.connect();
    return (await this.redis.exists(KEY.meta(sessionId), KEY.lastGood(sessionId))) === 2;
  }

  async delete(sessionId: string): Promise<void> {
    await this.connect();
    await this.redis.del(KEY.meta(sessionId), KEY.lastGood(sessionId), KEY.original(sessionId));
  }

  async touch(sessionId: string): Promise<void> {
    await this.connect();
    const ttl = SESSION_TTL_SECONDS;
    await this.redis
      .multi()
      .expire(KEY.meta(sessionId), ttl)
      .expire(KEY.lastGood(sessionId), ttl)
      .expire(KEY.original(sessionId), ttl)
      .exec();
  }
}

let singleton: Persistence | undefined;

export function createPersistence(): Persistence {
  if (REDIS_URI) return new RedisPersistence(REDIS_URI);
  if (DATA_DIR) return new FilePersistence(DATA_DIR);
  return new MemoryPersistence();
}

export function getPersistence(): Persistence {
  singleton ??= createPersistence();
  return singleton;
}

export function setPersistence(store: Persistence): void {
  singleton = store;
}
