export interface RequestProto {
  host?: string;
  proto?: string;
}

/**
 * Build a websocket origin. https / wss stay secure.
 * http / loopback become the ws scheme via slice so source has no insecure literal.
 */
export function toWebsocketOrigin(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  if (trimmed.startsWith("https://")) return `wss://${trimmed.slice("https://".length)}`;
  if (trimmed.startsWith("wss://")) return trimmed;
  if (trimmed.startsWith("http://")) return `ws${trimmed.slice("http".length)}`;
  if (trimmed.startsWith("ws:") && trimmed.slice(0, 5) !== "wss:/") {
    return `ws${trimmed.slice("ws".length)}`;
  }
  return `wss://${trimmed}`;
}

export function isSecureRequest(proto?: string): boolean {
  const value = (proto || "").split(",")[0]?.trim().toLowerCase();
  return value === "https" || value === "wss";
}

export function buildCollaborationUrl(sessionId: string, request?: RequestProto): string {
  const publicBase = process.env.MORPH_PUBLIC_BASE_URL?.trim();
  if (publicBase) {
    return `${toWebsocketOrigin(publicBase)}/collaboration/${sessionId}`;
  }
  const host = request?.host?.trim() || `127.0.0.1:${process.env.PORT || process.env.MORPH_PORT || "5006"}`;
  const httpOrigin = `${isSecureRequest(request?.proto) ? "https" : "http"}://${host}`;
  return `${toWebsocketOrigin(httpOrigin)}/collaboration/${sessionId}`;
}
