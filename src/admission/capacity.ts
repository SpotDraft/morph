import { memoryLimitMb, workerSlots, maxWarmHandles, handleIdleMs } from "../config/env.js";
import { persistKind } from "../persistence/store.js";
import { memorySnapshot } from "./memory.js";

/**
 * Measured on this image, Node 20 + @superdoc/sdk 2.8.0.
 * Tree RSS = Fastify process + one SuperDoc engine child.
 * Re-run `npm run bench:memory` (optional MORPH_BENCH_DOCX) after engine upgrades.
 */
export const MEASURED = {
  budgetMb: 2048,
  reserveMb: 256,
  hostOnlyMb: { tiny: 230, pingMsa: 280 },
  firstOpenMb: { tiny: 500, pingMsa: 610 },
  extraWarmMb: { tiny: 4, pingMsa: 11 },
  concurrentWriteSlots: 8,
  concurrentReplaceMs: { tiny: 151, pingMsa: 875 },
} as const;

export function estimateMaxWarmDocs(kind: "tiny" | "pingMsa" = "pingMsa"): number {
  const first = MEASURED.firstOpenMb[kind];
  const extra = MEASURED.extraWarmMb[kind];
  const remaining = MEASURED.budgetMb - first - MEASURED.reserveMb;
  if (extra <= 0) return 1;
  return Math.max(1, 1 + Math.floor(remaining / extra));
}

export function capacityReport(host: {
  warmHandles: number;
  openCount: number;
  slots: number;
  inFlight?: number;
  engineConnected: boolean;
  maxWarm?: number;
}) {
  const pingWarm = estimateMaxWarmDocs("pingMsa");
  const tinyWarm = estimateMaxWarmDocs("tiny");
  const memory = memorySnapshot();
  return {
    budget: {
      assumedMb: MEASURED.budgetMb,
      processLimitMb: memoryLimitMb(),
      rssMb: Math.round(memory.treeRssMb),
      hostRssMb: Math.round(memory.hostRssMb),
      engineRssMb: Math.round(memory.engineRssMb),
      guardSeesEngine: true,
      reserveMb: MEASURED.reserveMb,
    },
    documents: {
      maxWarmAt2GiB: { pingMsaSized: pingWarm, tinyFixture: tinyWarm, conservative: 80 },
      maxWarmConfigured: maxWarmHandles(),
      warmNow: host.warmHandles,
      extraMbPerWarm: MEASURED.extraWarmMb,
      firstOpenMb: MEASURED.firstOpenMb,
      idleCloseMs: handleIdleMs(),
    },
    requests: {
      maxConcurrentWrites: workerSlots(),
      inFlightWrites: host.inFlight ?? 0,
      readsOfWarmDocs: "not slot-limited; still subject to the memory guard",
      eightConcurrentReplaceMs: MEASURED.concurrentReplaceMs,
    },
    persist: {
      kind: persistKind(),
      requiredForMultiInstance: persistKind() === "redis" || Boolean(process.env.REDIS_URI),
      sessionful: true,
      redisHolds: ["morph:meta:*", "morph:last-good:*", "morph:original:*"],
      redisDoesNotHold: ["Yjs", "search maps", "comment lists", "warm SDK handles"],
    },
    collaboration: {
      isolatedEditsUseHocuspocus: false,
      v2Rooms: false,
    },
    notes: [
      "A session exists when last-good DOCX + meta exist. HTTP is request-scoped; the warm handle is a cache.",
      "Closing a handle does not free native engine RSS. Morph recycles the engine when the last warm handle closes.",
      "2 GiB is enough for ~80–100 Ping-MSA-sized warm docs with 256 MiB headroom. Concurrent writes default to 8.",
      "Redis is required on Cloud Run / multi-instance. Single-process tests use memory. MORPH_DATA_DIR is a one-box file store.",
    ],
  };
}
