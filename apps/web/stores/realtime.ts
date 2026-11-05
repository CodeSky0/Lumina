import { create } from "zustand";

export type RealtimeStatus = "idle" | "connecting" | "connected" | "reconnecting" | "offline" | "maintenance";

interface RealtimeState {
  status: RealtimeStatus;
  setStatus: (status: RealtimeStatus) => void;
  syncing: boolean;
  setSyncing: (syncing: boolean) => void;
  markSynced: () => void;
  syncVersion: number;
  activeChannelId?: string;
  setActiveChannel: (channelId?: string) => void;
  requestedChannelId?: string;
  requestChannel: (channelId?: string) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: "idle",
  setStatus: (status) => set({ status }),
  syncing: false,
  setSyncing: (syncing) => set({ syncing }),
  markSynced: () => set((state) => ({ syncing: false, syncVersion: state.syncVersion + 1 })),
  syncVersion: 0,
  activeChannelId: undefined,
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
  requestedChannelId: undefined,
  requestChannel: (channelId) => set({ requestedChannelId: channelId }),
}));
