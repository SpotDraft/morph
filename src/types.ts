export type AccessMode = "isolated" | "shared";

export interface UserInfo {
  userid: string;
  username: string;
  name: string;
  email?: string;
}

export interface SessionMeta {
  sessionId: string;
  user: UserInfo;
  accessMode: AccessMode;
  fileName: string;
  roomId?: string;
  lastGoodRevision: string | number | null;
  lastGoodAt: string | null;
  capabilities?: unknown;
  createdAt: string;
}

export interface PersistRecord {
  meta: SessionMeta;
  lastGood: Buffer;
  original?: Buffer;
}

export interface ReceiptLike {
  success: boolean;
  operation?: string;
  failure?: { code?: string; message?: string; details?: unknown };
  beforeRevision?: string | number | null;
  afterRevision?: string | number | null;
  trackedChangeIds?: string[];
  [key: string]: unknown;
}
