import { create } from "zustand";

interface FlashState {
  // 状态
  firmwarePath: string | null;
  firmwareSize: number;
  flashing: boolean;
  progress: number;
  phase: string;
  message: string;
  verifyAfterFlash: boolean;
  resetAfterFlash: boolean;

  // 操作
  setFirmwarePath: (path: string | null) => void;
  setFirmwareSize: (size: number) => void;
  setFlashing: (flashing: boolean) => void;
  setProgress: (progress: number, phase?: string, message?: string) => void;
  setVerifyAfterFlash: (verify: boolean) => void;
  setResetAfterFlash: (reset: boolean) => void;
  reset: () => void;
}

export const useFlashStore = create<FlashState>((set) => ({
  firmwarePath: null,
  firmwareSize: 0,
  flashing: false,
  progress: 0,
  phase: "",
  message: "",
  verifyAfterFlash: true,
  resetAfterFlash: true,

  setFirmwarePath: (firmwarePath) => set({ firmwarePath }),

  setFirmwareSize: (firmwareSize) => set({ firmwareSize }),

  setFlashing: (flashing) => set({ flashing }),

  setProgress: (progress, phase, message) =>
    set((state) => ({
      progress,
      phase: phase ?? state.phase,
      message: message ?? state.message,
    })),

  setVerifyAfterFlash: (verifyAfterFlash) => set({ verifyAfterFlash }),

  setResetAfterFlash: (resetAfterFlash) => set({ resetAfterFlash }),

  reset: () =>
    set({
      firmwarePath: null,
      firmwareSize: 0,
      flashing: false,
      progress: 0,
      phase: "",
      message: "",
    }),
}));
