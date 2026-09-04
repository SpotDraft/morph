import { memoryGuardEnabled, memoryLimitMb } from "../config/env.js";
import { MorphError } from "../errors.js";

export function rssMb(): number {
  return process.memoryUsage().rss / (1024 * 1024);
}

export function shouldReject(): boolean {
  if (!memoryGuardEnabled()) return false;
  return rssMb() >= memoryLimitMb();
}

export function admitOrThrow(op: string): void {
  if (!shouldReject()) return;
  throw new MorphError("ADMISSION", `Memory guard rejected ${op}`, {
    status: 503,
    retryAfter: 15,
    detail: {
      error: "memory_guard",
      memory: { rssMb: Math.round(rssMb()), limitMb: memoryLimitMb() },
    },
  });
}

export function memoryHeaders(): Record<string, string> {
  return {
    "X-Memory-Rss-Mb": String(Math.round(rssMb())),
    "X-Memory-Limit-Mb": String(memoryLimitMb()),
  };
}
