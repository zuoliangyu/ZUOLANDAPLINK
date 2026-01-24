import { create } from "zustand";

// Application mode type
export type AppMode = "flash" | "rtt";

// App mode persistence key
const APP_MODE_KEY = "app_mode";

function loadAppMode(): AppMode {
  try {
    const saved = localStorage.getItem(APP_MODE_KEY);
    if (saved === "flash" || saved === "rtt") {
      return saved;
    }
  } catch (error) {
    console.error("Failed to load app mode:", error);
  }
  return "flash"; // Default to flash mode
}

function saveAppMode(mode: AppMode) {
  try {
    localStorage.setItem(APP_MODE_KEY, mode);
  } catch (error) {
    console.error("Failed to save app mode:", error);
  }
}

interface AppState {
  // Current application mode
  mode: AppMode;

  // Actions
  setMode: (mode: AppMode) => void;
}

export const useAppStore = create<AppState>((set) => ({
  mode: loadAppMode(),

  setMode: (mode) => {
    saveAppMode(mode);
    set({ mode });
  },
}));
