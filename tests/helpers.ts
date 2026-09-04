import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";
import { DocumentRegistry, setRegistry } from "../src/documents/registry.js";
import { SdkHost, setHost } from "../src/hosts/sdk-host.js";
import { MemoryPersistence, setPersistence } from "../src/persistence/store.js";

process.env.SUPERDOC_PUBLIC_LICENSE_KEY ||= "morph-test-license";

const here = path.dirname(fileURLToPath(import.meta.url));
export const morphRoot = path.resolve(here, "..");
export const fixturePath = path.join(morphRoot, "fixtures", "contract.docx");

export function ensureFixture() {
  const result = spawnSync("python3", [path.join(morphRoot, "scripts", "make-fixture.py")], {
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("fixture generation failed");
}

export function testUser() {
  return { userid: "u-morph", username: "Morph Tester", name: "Morph Tester", email: "morph@example.com" };
}

export async function bootApp(): Promise<{
  app: FastifyInstance;
  persist: MemoryPersistence;
  host: SdkHost;
  registry: DocumentRegistry;
}> {
  process.env.SUPERDOC_PUBLIC_LICENSE_KEY ||= "morph-test-license";
  const persist = new MemoryPersistence();
  const host = new SdkHost();
  const registry = new DocumentRegistry(persist, host);
  setPersistence(persist);
  setHost(host);
  setRegistry(registry);
  const app = await createApp();
  return { app, persist, host, registry };
}

export async function uploadFixture(app: FastifyInstance, sessionId: string) {
  ensureFixture();
  const fs = await import("node:fs/promises");
  const bytes = await fs.readFile(fixturePath);
  const res = await app.inject({
    method: "POST",
    url: "/upload",
    headers: { "content-type": "application/json" },
    payload: {
      sessionId,
      user: testUser(),
      fileName: "contract.docx",
      base64: bytes.toString("base64"),
    },
  });
  return res;
}
