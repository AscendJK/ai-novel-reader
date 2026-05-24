import type { SyncData, RegisterResult, HeartbeatResult, PushResult } from "./types";

const SYNC_INTERVAL = 30_000;  // 30s between sync rounds
const HEARTBEAT_INTERVAL = 15_000;

type ChangeCallback = (data: SyncData) => Promise<void>;

export class SyncClient {
  private username: string | null = null;
  private clientId: string | null = null;
  private activeCount = 0;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private gatherChanges: (() => Promise<Partial<SyncData>>) | null = null;
  private applyData: ChangeCallback | null = null;
  private isAiRunning: () => boolean = () => false;

  constructor() {
    // Restore session from localStorage
    this.username = localStorage.getItem("sync-username");
    this.clientId = localStorage.getItem("sync-clientId");
  }

  get isLoggedIn() { return !!this.username && !!this.clientId; }
  get user() { return this.username; }
  get cid() { return this.clientId; }
  get connectionCount() { return this.activeCount; }

  /** Register or join a username. Returns {success, isNew, activeCount, error?}. */
  async login(username: string, mode: "create" | "join" = "create"): Promise<{ success: boolean; isNew: boolean; activeCount: number; error?: string }> {
    try {
      const resp = await fetch("/api/sync/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, mode }),
      });
      if (resp.status === 404) {
        const err = await resp.json().catch(() => ({}));
        return { success: false, isNew: false, activeCount: 0, error: (err as any).error || "用户名不存在" };
      }
      if (!resp.ok) return { success: false, isNew: false, activeCount: 0 };
      const result: RegisterResult = await resp.json();

      this.username = username;
      this.clientId = result.clientId;
      this.activeCount = result.activeCount;
      localStorage.setItem("sync-username", username);
      localStorage.setItem("sync-clientId", result.clientId);

      return { success: true, isNew: result.isNew, activeCount: result.activeCount };
    } catch {
      return { success: false, isNew: false, activeCount: 0 };
    }
  }

  /** Start sync loop. Must be called after login. */
  start(opts: {
    gatherChanges: () => Promise<Partial<SyncData>>;
    applyData: ChangeCallback;
    isAiRunning: () => boolean;
  }) {
    this.gatherChanges = opts.gatherChanges;
    this.applyData = opts.applyData;
    this.isAiRunning = opts.isAiRunning;

    // Heartbeat
    this.heartbeatTimer = setInterval(() => this.doHeartbeat(), HEARTBEAT_INTERVAL);

    // Sync loop
    this.syncTimer = setInterval(() => this.doSync(), SYNC_INTERVAL);
  }

  /** Stop sync timers */
  stop() {
    if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = null; }
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  /** Manually trigger a sync push (called after important changes) */
  async pushNow() {
    await this.doSync();
  }

  /** Logout */
  logout() {
    if (this.username && this.clientId) {
      fetch("/api/sync/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: this.username, clientId: this.clientId }),
      }).catch(() => {});
    }
    this.stop();
    this.username = null;
    this.clientId = null;
    this.activeCount = 0;
    localStorage.removeItem("sync-username");
    localStorage.removeItem("sync-clientId");
  }

  // ── private ──

  private async doHeartbeat() {
    if (!this.username || !this.clientId) return;
    try {
      const resp = await fetch("/api/sync/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: this.username, clientId: this.clientId }),
      });
      if (resp.ok) {
        const r: HeartbeatResult = await resp.json();
        this.activeCount = r.activeCount;
      }
    } catch { /* server unreachable */ }
  }

  private async doSync() {
    if (!this.username || !this.clientId || !this.gatherChanges || !this.applyData) return;
    // Skip if no other active connections
    if (this.activeCount < 2) return;
    // Skip if AI is running
    if (this.isAiRunning()) return;

    try {
      const changes = await this.gatherChanges();
      const resp = await fetch("/api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: this.username, clientId: this.clientId, changes }),
      });
      if (resp.ok) {
        const r: PushResult = await resp.json();
        if (r.merged && r.data) {
          await this.applyData(r.data);
        }
      }
    } catch { /* retry next round */ }
  }
}

/** Singleton */
export const syncClient = new SyncClient();
