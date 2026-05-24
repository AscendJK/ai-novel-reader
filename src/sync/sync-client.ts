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
      console.log("[sync] login:", username, mode);
      const resp = await fetch("/api/sync/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, mode }),
      });
      console.log("[sync] register response:", resp.status);
      if (resp.status === 404) {
        const err = await resp.json().catch(() => ({}));
        console.log("[sync] register 404:", err);
        return { success: false, isNew: false, activeCount: 0, error: (err as any).error || "用户名不存在" };
      }
      if (!resp.ok) return { success: false, isNew: false, activeCount: 0 };
      const result: RegisterResult = await resp.json();
      console.log("[sync] registered:", result.isNew ? "new" : "existing", "active:", result.activeCount);

      this.username = username;
      this.clientId = result.clientId;
      this.activeCount = result.activeCount;
      localStorage.setItem("sync-username", username);
      localStorage.setItem("sync-clientId", result.clientId);

      return { success: true, isNew: result.isNew, activeCount: result.activeCount };
    } catch (e) {
      console.error("[sync] login error:", e);
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

  /** Full sync round: push local changes, pull merged data from server */
  async syncOnce(): Promise<boolean> {
    if (!this.username || !this.clientId || !this.gatherChanges || !this.applyData) {
      console.warn("[sync] syncOnce skipped — not ready");
      return false;
    }
    try {
      await this.doHeartbeat();

      const changes = await this.gatherChanges();
      console.log("[sync] pushing:", { novels: changes.novels?.length, chapters: changes.chapters?.length, summaries: changes.summaries?.length });
      const resp = await fetch("/api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: this.username, clientId: this.clientId, changes }),
      });
      if (resp.ok) {
        const r: PushResult = await resp.json();
        console.log("[sync] pull result:", r.merged, { novels: r.data?.novels?.length, chapters: r.data?.chapters?.length });
        if (r.merged && r.data) {
          await this.applyData(r.data);
        }
        return true;
      } else {
        console.warn("[sync] push failed:", resp.status);
      }
    } catch (e) { console.error("[sync] syncOnce error:", e); }
    return false;
  }

  private async doSync() {
    if (!this.username || !this.clientId || !this.gatherChanges || !this.applyData) return;
    if (this.isAiRunning()) return;
    await this.syncOnce();
  }
}

/** Singleton */
export const syncClient = new SyncClient();
