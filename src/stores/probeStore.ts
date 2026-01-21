import { create } from "zustand";
import type { ProbeInfo, TargetInfo, ConnectionInfo, DeviceSettings } from "@/lib/types";

interface ProbeState {
  // 状态
  probes: ProbeInfo[];
  selectedProbe: ProbeInfo | null;
  connected: boolean;
  connectionInfo: ConnectionInfo | null;
  targetInfo: TargetInfo | null;
  settings: DeviceSettings;
  loading: boolean;
  error: string | null;

  // 操作
  setProbes: (probes: ProbeInfo[]) => void;
  selectProbe: (probe: ProbeInfo | null) => void;
  setConnected: (connected: boolean, info?: ConnectionInfo | null, target?: TargetInfo | null) => void;
  setSettings: (settings: Partial<DeviceSettings>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const defaultSettings: DeviceSettings = {
  interfaceType: "SWD",
  clockSpeed: 1000000, // 1MHz
  connectMode: "Normal",
  resetMode: "Software",
  voltage: 3.3,
};

export const useProbeStore = create<ProbeState>((set) => ({
  probes: [],
  selectedProbe: null,
  connected: false,
  connectionInfo: null,
  targetInfo: null,
  settings: defaultSettings,
  loading: false,
  error: null,

  setProbes: (probes) => set({ probes }),

  selectProbe: (probe) => set({ selectedProbe: probe }),

  setConnected: (connected, info = null, target = null) =>
    set({ connected, connectionInfo: info, targetInfo: target }),

  setSettings: (settings) =>
    set((state) => ({ settings: { ...state.settings, ...settings } })),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  reset: () =>
    set({
      selectedProbe: null,
      connected: false,
      connectionInfo: null,
      targetInfo: null,
      loading: false,
      error: null,
    }),
}));
