import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { memoryGuardEnabled, memoryLimitMb } from "../config/env.js";
import { MorphError } from "../errors.js";

export function hostRssMb(): number {
  return process.memoryUsage().rss / (1024 * 1024);
}

/** @deprecated use hostRssMb() or treeRssMb() — kept so older call sites compile */
export function rssMb(): number {
  return treeRssMb();
}

function rssOf(pid: number): number {
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

export function treePids(rootPid = process.pid): number[] {
  const seen = new Set<number>();
  const walk = (pid: number) => {
    if (seen.has(pid)) return;
    seen.add(pid);
    for (const child of childPids(pid)) walk(child);
  };
  walk(rootPid);
  return [...seen];
}

/** Fastify RSS plus SuperDoc engine children. This is what admission must see. */
export function treeRssMb(): number {
  return treePids().reduce((sum, pid) => sum + rssOf(pid), 0);
}

export function memorySnapshot() {
  const host = hostRssMb();
  const tree = treeRssMb();
  return {
    hostRssMb: Number(host.toFixed(1)),
    treeRssMb: Number(tree.toFixed(1)),
    engineRssMb: Number(Math.max(0, tree - host).toFixed(1)),
    limitMb: memoryLimitMb(),
  };
}

export function shouldReject(): boolean {
  if (!memoryGuardEnabled()) return false;
  return treeRssMb() >= memoryLimitMb();
}

export function admitOrThrow(op: string): void {
  if (!shouldReject()) return;
  const memory = memorySnapshot();
  throw new MorphError("ADMISSION", `Memory guard rejected ${op}`, {
    status: 503,
    retryAfter: 15,
    detail: { error: "memory_guard", memory },
  });
}

export function memoryHeaders(): Record<string, string> {
  const snap = memorySnapshot();
  return {
    "X-Memory-Rss-Mb": String(Math.round(snap.treeRssMb)),
    "X-Memory-Host-Rss-Mb": String(Math.round(snap.hostRssMb)),
    "X-Memory-Engine-Rss-Mb": String(Math.round(snap.engineRssMb)),
    "X-Memory-Limit-Mb": String(snap.limitMb),
  };
}
