export interface SyncData {
  summaries: unknown[];
  notes: unknown[];
  settings: Record<string, unknown>;
  progress: {
    readingPositions: Record<string, { chapterId: string; chapterIndex: number }>;
    lastOpened: Record<string, number>;
  };
  joinedNovelIds?: string[];
}

export interface PushPayload {
  username: string;
  clientId: string;
  changes: Partial<SyncData>;
  lastSyncTime: number;
}

export interface RegisterResult {
  clientId: string;
  token: string;
  activeCount: number;
  data: (SyncData & { username: string; lastSyncAt: number }) | null;
  isNew: boolean;
}

export interface HeartbeatResult {
  activeCount: number;
}

export interface PushResult {
  merged: boolean;
  data: SyncData & { username: string; lastSyncAt: number };
}
