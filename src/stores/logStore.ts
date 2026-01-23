import { create } from "zustand";
import type { LogEntry } from "@/lib/types";

interface LogState {
  logs: LogEntry[];
  maxLogs: number;
  addLog: (level: LogEntry["level"], message: string) => void;
  clearLogs: () => void;
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  maxLogs: 1000,

  addLog: (level, message) =>
    set((state) => {
      const newLog: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: new Date(),
        level,
        message,
      };

      // 将新日志追加到末尾，保留最后maxLogs条
      const logs = [...state.logs, newLog].slice(-state.maxLogs);
      return { logs };
    }),

  clearLogs: () => set({ logs: [] }),
}));
