function intEnv(name: string, fallback: string): number {
  return parseInt(process.env[name] || fallback, 10);
}

export const PORT = intEnv("PORT", process.env.MORPH_PORT || "5006");
export const SESSION_TTL_SECONDS = intEnv("SUPERDOC_REDIS_SESSION_TTL_SECONDS", "1800");
export const REDIS_URI = process.env.REDIS_URI || "";
export const DATA_DIR = process.env.MORPH_DATA_DIR || "";
export const MAX_FILE_SIZE = intEnv("MAX_FILE_SIZE", "52428800");
export const FETCH_TIMEOUT = intEnv("FETCH_TIMEOUT", "30000");
export const HANDLE_IDLE_MS = intEnv("MORPH_HANDLE_IDLE_MS", "120000");
export const WORKER_SLOTS = intEnv("MORPH_WORKER_SLOTS", "8");
export const PUBLIC_BASE_URL = process.env.MORPH_PUBLIC_BASE_URL || "";

/** Read at call time so tests can set the key after ESM imports hoist. */
export function memoryLimitMb(): number {
  return intEnv("MEMORY_GUARD_RSS_MB", "7680");
}

export function memoryGuardEnabled(): boolean {
  return process.env.ENABLE_MEMORY_GUARD?.toLowerCase() !== "false";
}

export function superdocLicenseKey(): string {
  const value = process.env.SUPERDOC_PUBLIC_LICENSE_KEY?.trim();
  if (!value) {
    throw new Error("SUPERDOC_PUBLIC_LICENSE_KEY is required and cannot be empty");
  }
  return value;
}

/** @deprecated prefer superdocLicenseKey() — kept for boot-time display */
export const MEMORY_GUARD_RSS_MB = memoryLimitMb();
export const ENABLE_MEMORY_GUARD = memoryGuardEnabled();

export function loadEnv() {
  return {
    PORT,
    SUPERDOC_PUBLIC_LICENSE_KEY: superdocLicenseKey(),
  };
}
