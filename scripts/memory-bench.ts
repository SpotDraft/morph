/**
 * Measure host + engine RSS while opening and editing many isolated docs.
 * Usage: SUPERDOC_PUBLIC_LICENSE_KEY=… node --import tsx scripts/memory-bench.ts
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentRegistry } from "../src/documents/registry.js";
import { applyReplace, queryMatch } from "../src/documents/query.js";
import { SdkHost } from "../src/hosts/sdk-host.js";
import { MemoryPersistence } from "../src/persistence/store.js";

process.env.SUPERDOC_PUBLIC_LICENSE_KEY ||= "morph-test-license";
process.env.MORPH_WORKER_SLOTS ||= "32";

const root = path.resolve(import.meta.dirname, "..");
const fixturePath =
  process.env.MORPH_BENCH_DOCX || path.join(root, "fixtures", "contract.docx");
if (fixturePath.endsWith("contract.docx")) {
  spawnSync("python3", [path.join(root, "scripts", "make-fixture.py")], { stdio: "inherit" });
}
const fixture = await readFile(fixturePath);
console.error(`fixture ${fixturePath} (${fixture.length} bytes)`);

function rssMb(pid: number): number {
  try {
    const status = readFileSync(`/proc/${pid}/status`, "utf8");
    const match = status.match(/VmRSS:\s+(\d+)\s+kB/);
    return match ? Number(match[1]) / 1024 : 0;
  } catch {
    return 0;
  }
}

function childPids(pid: number): number[] {
  try {
    const raw = readFileSync(`/proc/${pid}/task/${pid}/children`, "utf8").trim();
    if (!raw) return [];
    return raw.split(/\s+/).map(Number).filter(Boolean);
  } catch {
    try {
      const out = spawnSync("pgrep", ["-P", String(pid)], { encoding: "utf8" });
      return (out.stdout || "")
        .trim()
        .split("\n")
        .map(Number)
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}

function treePids(rootPid: number): number[] {
  const seen = new Set<number>();
  const walk = (pid: number) => {
    if (seen.has(pid)) return;
    seen.add(pid);
    for (const child of childPids(pid)) walk(child);
  };
  walk(rootPid);
  return [...seen];
}

function snapshot(label: string) {
  const pids = treePids(process.pid);
  const rows = pids.map((pid) => ({ pid, rssMb: Number(rssMb(pid).toFixed(1)) }));
  const total = rows.reduce((sum, row) => sum + row.rssMb, 0);
  return { label, nodeRssMb: Number(rssMb(process.pid).toFixed(1)), treeRssMb: Number(total.toFixed(1)), procs: rows };
}

const persist = new MemoryPersistence();
const host = new SdkHost();
const registry = new DocumentRegistry(persist, host);
const user = { userid: "bench", username: "Bench", name: "Bench" };

const series: Array<ReturnType<typeof snapshot> & { docs: number }> = [];
series.push({ ...snapshot("baseline"), docs: 0 });

const n = Number(process.env.MORPH_BENCH_DOCS || "12");
const ids: string[] = [];
for (let i = 0; i < n; i++) {
  const sessionId = `bench-${i}`;
  await registry.createIsolated({ sessionId, user, fileName: "contract.docx", bytes: fixture });
  ids.push(sessionId);
  series.push({ ...snapshot(`open-${i + 1}`), docs: i + 1 });
}

const t0 = Date.now();
await Promise.all(
  ids.slice(0, Math.min(8, ids.length)).map(async (sessionId) => {
    await registry.mutate(sessionId, "bench-replace", async (doc) => {
      const extract = await doc.extract();
      const sample =
        extract.blocks.find((b) => (b.text ?? "").trim().length >= 8)?.text?.slice(0, 24) ??
        "the";
      const match = await queryMatch(doc, {
        pattern: sample,
        require: "first",
        caseSensitive: true,
      });
      if (!match.items[0]?.target) return { success: true, skipped: true };
      return applyReplace(doc, {
        target: match.items[0].target,
        text: `${sample} `,
        expectedRevision: match.evaluatedRevision,
      });
    });
  }),
);
const concurrentMs = Date.now() - t0;
series.push({ ...snapshot("after-8-concurrent-replaces"), docs: ids.length });

for (const id of ids) await host.closeHandle(id);
series.push({ ...snapshot("after-close-handles"), docs: 0 });

await host.dispose();
series.push({ ...snapshot("after-dispose"), docs: 0 });

const first = series.find((s) => s.docs === 1);
const lastOpen = series.filter((s) => s.docs > 0).at(-1);
const deltaPerDoc =
  first && lastOpen && lastOpen.docs > 1
    ? (lastOpen.treeRssMb - first.treeRssMb) / (lastOpen.docs - 1)
    : first
      ? first.treeRssMb - series[0].treeRssMb
      : 0;
const baseline = series[0].treeRssMb;
const reserve = 256;
const budget = 2048;
const maxDocs = deltaPerDoc > 1 ? Math.max(1, Math.floor((budget - baseline - reserve) / deltaPerDoc)) : null;

const report = {
  budgetMb: budget,
  baselineTreeRssMb: baseline,
  enginePlusHostAtOneDocMb: first?.treeRssMb ?? null,
  approxMbPerAdditionalDoc: Number(deltaPerDoc.toFixed(1)),
  estimatedMaxWarmDocsAt2GiB: maxDocs,
  concurrentReplaces: Math.min(8, ids.length),
  concurrentReplaceMs: concurrentMs,
  series,
  notes: [
    "Tree RSS is this Node process plus SuperDoc engine children.",
    "A warm handle is a cache. Closing it does not delete last-good.",
    "Reads and writes against a closed handle rehydrate from last-good (file/Redis/memory).",
    "2 GiB estimate keeps 256 MiB headroom for the HTTP process and a burst replace.",
  ],
};

console.log(JSON.stringify(report, null, 2));
