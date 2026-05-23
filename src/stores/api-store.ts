import { create } from "zustand";
import type { ProviderConfig, ProviderType } from "@/api/types";
import { db } from "@/db/database";

interface APIState {
  providers: ProviderConfig[];
  activeProviderId: string | null;
  loaded: boolean;
  addProvider: (config: ProviderConfig) => void;
  removeProvider: (type: ProviderType) => void;
  updateProvider: (type: ProviderType, config: Partial<ProviderConfig>) => void;
  setActiveProvider: (type: ProviderType | null) => void;
  getActiveProvider: () => ProviderConfig | undefined;
  loadFromDB: () => Promise<void>;
}

function persist(providers: ProviderConfig[], activeId: string | null) {
  db.settings.put({ key: "api-providers", value: providers });
  db.settings.put({ key: "api-active-provider", value: activeId });
}

export const useAPIStore = create<APIState>((set, get) => ({
  providers: [],
  activeProviderId: null,
  loaded: false,

  loadFromDB: async () => {
    try {
      const [providersRecord, activeRecord] = await Promise.all([
        db.settings.get("api-providers"),
        db.settings.get("api-active-provider"),
      ]);
      const providers = (providersRecord?.value as ProviderConfig[]) || [];
      const activeId = (activeRecord?.value as string | null) || null;
      set({ providers, activeProviderId: activeId, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  addProvider: (config) =>
    set((s) => {
      const filtered = s.providers.filter((p) => p.type !== config.type);
      const providers = [...filtered, config];
      persist(providers, config.type);
      return { providers, activeProviderId: config.type };
    }),

  removeProvider: (type) =>
    set((s) => {
      const providers = s.providers.filter((p) => p.type !== type);
      const activeId = s.activeProviderId === type ? null : s.activeProviderId;
      persist(providers, activeId);
      return { providers, activeProviderId: activeId };
    }),

  updateProvider: (type, config) =>
    set((s) => {
      const providers = s.providers.map((p) => (p.type === type ? { ...p, ...config } : p));
      persist(providers, s.activeProviderId);
      return { providers };
    }),

  setActiveProvider: (type) => {
    const { providers } = get();
    persist(providers, type);
    set({ activeProviderId: type });
  },

  getActiveProvider: () => {
    const { providers, activeProviderId } = get();
    return providers.find((p) => p.type === activeProviderId);
  },
}));
