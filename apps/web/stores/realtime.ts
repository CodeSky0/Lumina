import { create } from "zustand";

export type RealtimeStatus = "idle" | "connecting" | "connected" | "reconnecting" | "offline";

interface RealtimeState {
  status: RealtimeStatus;
  setStatus: (status: RealtimeStatus) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: "idle",
  setStatus: (status) => set({ status }),
}));
