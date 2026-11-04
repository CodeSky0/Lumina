import { create } from "zustand";

export type RealtimeStatus = "idle" | "connecting" | "connected" | "reconnecting" | "offline" | "maintenance";

interface RealtimeState {
  status: RealtimeStatus;
  syncing: boolean;
  syncVersion: number;
  activeChannelId?: string;
  requestedChannelId?: string;
  setStatus: (status: RealtimeStatus) => void;
  setSyncing: (syncing: boolean) => void;
  markSynced: () => void;
  setActiveChannel: (channelId?: string) => void;
  requestChannel: (channelId?: string) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: "idle",
  syncing: false,
  syncVersion: 0,
  setStatus: (status) => set({ status }),
  setSyncing: (syncing) => set({ syncing }),
  markSynced: () => set((state) => ({ syncing: false, syncVersion: state.syncVersion + 1 })),
  setActiveChannel: (activeChannelId) => set({ activeChannelId }),
  requestChannel: (requestedChannelId) => set({ requestedChannelId }),
}));
