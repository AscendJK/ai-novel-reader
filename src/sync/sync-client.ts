import type { SyncData, RegisterResult, HeartbeatResult, PushResult } from "./types";
import { useUIStore } from "@/stores/ui-store";

const SYNC_INTERVAL = 30_000;
const HEARTBEAT_INTERVAL = 15_000;

type ChangeCallback = (data: SyncData) => Promise<void>;

export class SyncClient {
  private username: string | null = null;
  private clientId: string | null = null;
  private token: string | null = null;
  private activeCount = 0;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private gatherChanges: (() => Promise<Partial<SyncData>>) | null = null;
  private applyData: ChangeCallback | null = null;
  private isAiRunning: () => boolean = () => false;
  private onKicked: (() => void) | null = null;
  private reRegistering = false;
  private syncing = false;

  constructor() {
    this.username = localStorage.getItem("sync-username");
    this.clientId = localStorage.getItem("sync-clientId");
    this.token = localStorage.getItem("sync-token");
    // If we have username/clientId but no token (pre-auth migration), clear stale session
    if ((this.username || this.clientId) && !this.token) {
      this.username = null; this.clientId = null;
      localStorage.removeItem("sync-username");
      localStorage.removeItem("sync-clientId");
    }
  }

  get isLoggedIn() { return !!this.username && !!this.clientId && !!this.token; }
  get user() { return this.username; }
  get cid() { return this.clientId; }
  get connectionCount() { return this.activeCount; }

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
        return { success: false, isNew: false, activeCount: 0, error: (err as any).error || "用户名不存在" };
      }
      if (resp.status === 409) {
        const err = await resp.json().catch(() => ({}));
        return { success: false, isNew: false, activeCount: 0, error: (err as any).error || "用户名已存在" };
      }
      if (!resp.ok) return { success: false, isNew: false, activeCount: 0 };
      const result: RegisterResult = await resp.json();
      console.log("[sync] registered:", result.isNew ? "new" : "existing");

      this.username = username;
      this.clientId = result.clientId;
      this.token = result.token;
      this.activeCount = result.activeCount;
      localStorage.setItem("sync-username", username);
      localStorage.setItem("sync-clientId", result.clientId);
      if (result.token) localStorage.setItem("sync-token", result.token);

      return { success: true, isNew: result.isNew, activeCount: result.activeCount };
    } catch (e) {
      console.error("[sync] login error:", e);
      return { success: false, isNew: false, activeCount: 0 };
    }
  }

  start(opts: {
    gatherChanges: () => Promise<Partial<SyncData>>;
    applyData: ChangeCallback;
    isAiRunning: () => boolean;
    onKicked: () => void;
  }) {
    this.gatherChanges = opts.gatherChanges;
    this.applyData = opts.applyData;
    this.isAiRunning = opts.isAiRunning;
    this.onKicked = opts.onKicked;

    this.heartbeatTimer = setInterval(() => this.doHeartbeat(), HEARTBEAT_INTERVAL);
    this.syncTimer = setInterval(() => this.doSync(), SYNC_INTERVAL);
  }

  stop() {
    if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = null; }
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  async pushNow() {
    await this.doSync();
  }

  logout() {
    if (this.username && this.clientId) {
      fetch("/api/sync/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: this.username, clientId: this.clientId, token: this.token }),
      }).catch(() => {});
    }
    this.stop();
    this.username = null;
    this.clientId = null;
    this.token = null;
    this.activeCount = 0;
    localStorage.removeItem("sync-username");
    localStorage.removeItem("sync-clientId");
    localStorage.removeItem("sync-token");
  }

  // ── Full sync round ──

  async syncOnce(): Promise<boolean> {
    if (!this.username || !this.clientId || !this.gatherChanges || !this.applyData) {
      console.warn("[sync] syncOnce skipped — not ready");
      return false;
    }
    if (this.reRegistering || this.syncing) {
      console.log("[sync] syncOnce skipped — busy");
      return false;
    }
    this.syncing = true;
    try {
      const changes = await this.gatherChanges();
      console.log("[sync] pushing:", JSON.stringify({ s: changes.summaries?.length, n: changes.notes?.length, se: Object.keys(changes.settings||{}).length, p: Object.keys(changes.progress?.readingPositions||{}).length }));
      const resp = await fetch("/api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: this.username, clientId: this.clientId, token: this.token, changes }),
      });
      if (resp.status === 403) {
        console.warn("[sync] 403 from push, attempting re-register...");
        const reRegistered = await this.tryReRegister();
        if (reRegistered) {
          // Retry the push with new credentials
          const retryResp = await fetch("/api/sync/push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: this.username, clientId: this.clientId, token: this.token, changes }),
          });
          if (retryResp.ok) {
            const r: PushResult = await retryResp.json();
            if (r.merged && r.data) await this.applyData(r.data);
            return true;
          }
        }
        // Re-register failed — this is a real kick (another device logged in)
        console.warn("[sync] re-register failed, kicked");
        this.handleKicked();
        return false;
      }
      if (resp.ok) {
        const r: PushResult = await resp.json();
        console.log("[sync] pull ok");
        if (r.merged && r.data) {
          await this.applyData(r.data);
        }
        return true;
      } else {
        const errText = await resp.text().catch(() => "unknown");
        console.error("[sync] push failed:", resp.status, errText);
      }
    } catch (e) { console.error("[sync] syncOnce error:", e); }
    finally { this.syncing = false; }
    return false;
  }

  // ── private ──

  private async tryReRegister(): Promise<boolean> {
    if (!this.username) return false;
    this.reRegistering = true;
    try {
      const reReg = await fetch("/api/sync/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: this.username, mode: "join" }),
      });
      if (reReg.ok) {
        const result = await reReg.json();
        this.clientId = result.clientId;
        this.token = result.token;
        this.activeCount = result.activeCount;
        localStorage.setItem("sync-clientId", result.clientId);
        if (result.token) localStorage.setItem("sync-token", result.token);
        console.log("[sync] re-registered successfully");
        return true;
      }
    } catch { /* re-register failed */ }
    finally { this.reRegistering = false; }
    return false;
  }

  private async doHeartbeat() {
    if (!this.username || !this.clientId || useUIStore.getState().offlineMode) return;
    if (this.reRegistering) return;
    try {
      const resp = await fetch("/api/sync/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: this.username, clientId: this.clientId, token: this.token }),
      });
      if (resp.ok) {
        const r: HeartbeatResult = await resp.json();
        if (r.activeCount === 0) {
          console.warn("[sync] heartbeat 0, attempting re-register...");
          const ok = await this.tryReRegister();
          if (!ok) {
            console.warn("[sync] re-register failed, kicking");
            this.handleKicked();
          }
          return;
        }
        this.activeCount = r.activeCount;
      }
    } catch { /* server unreachable */ }
  }

  private async doSync() {
    if (!this.username || !this.clientId || !this.gatherChanges || !this.applyData) return;
    if (useUIStore.getState().offlineMode) return;
    if (this.isAiRunning()) return;
    if (this.reRegistering) return;
    await this.syncOnce();
  }

  private handleKicked() {
    this.stop();
    this.username = null;
    this.clientId = null;
    this.token = null;
    this.activeCount = 0;
    localStorage.removeItem("sync-username");
    localStorage.removeItem("sync-clientId");
    localStorage.removeItem("sync-token");
    if (this.onKicked) this.onKicked();
  }
}

export const syncClient = new SyncClient();
