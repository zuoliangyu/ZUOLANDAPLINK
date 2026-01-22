import { create } from "zustand";
import type { EraseMode } from "@/lib/types";

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
  eraseMode: EraseMode;

  // 操作
  setFirmwarePath: (path: string | null) => void;
  setFirmwareSize: (size: number) => void;
  setFlashing: (flashing: boolean) => void;
  setProgress: (progress: number, phase?: string, message?: string) => void;
  setVerifyAfterFlash: (verify: boolean) => void;
  setResetAfterFlash: (reset: boolean) => void;
  setEraseMode: (mode: EraseMode) => void;
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
  eraseMode: "SectorErase",

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

  setEraseMode: (eraseMode) => set({ eraseMode }),

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
