import { create } from "zustand";
import type { RttChannel, RttLine, RttScanMode } from "@/lib/types";

interface RttState {
  // 连接状态
  isRunning: boolean;
  isPaused: boolean;
  error: string | null;

  // 通道信息
  upChannels: RttChannel[];
  downChannels: RttChannel[];
  selectedChannel: number; // -1 表示显示所有通道

  // 数据
  lines: RttLine[];
  maxLines: number;

  // 显示设置
  autoScroll: boolean;
  showTimestamp: boolean;
  searchQuery: string;

  // 配置
  scanMode: RttScanMode;
  scanAddress: number;
  pollInterval: number;

  // 统计
  totalBytes: number;
  lineIdCounter: number;

  // 操作
  setRunning: (running: boolean) => void;
  setPaused: (paused: boolean) => void;
  setError: (error: string | null) => void;
  setChannels: (upChannels: RttChannel[], downChannels: RttChannel[]) => void;
  selectChannel: (index: number) => void;
  addLine: (line: Omit<RttLine, "id">) => void;
  addLines: (lines: Omit<RttLine, "id">[]) => void;
  clearLines: () => void;
  setAutoScroll: (enabled: boolean) => void;
  setShowTimestamp: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
  setScanMode: (mode: RttScanMode) => void;
  setScanAddress: (address: number) => void;
  setPollInterval: (interval: number) => void;
  addBytes: (count: number) => void;
  reset: () => void;
}

// 从文本解析日志级别
function parseLogLevel(text: string): RttLine["level"] {
  const lowerText = text.toLowerCase();
  if (lowerText.includes("[error]") || lowerText.includes("[err]") || lowerText.includes("error:")) {
    return "error";
  }
  if (lowerText.includes("[warn]") || lowerText.includes("[warning]") || lowerText.includes("warning:")) {
    return "warn";
  }
  if (lowerText.includes("[debug]") || lowerText.includes("[dbg]")) {
    return "debug";
  }
  return "info";
}

export const useRttStore = create<RttState>((set) => ({
  // 初始状态
  isRunning: false,
  isPaused: false,
  error: null,
  upChannels: [],
  downChannels: [],
  selectedChannel: -1,
  lines: [],
  maxLines: 10000,
  autoScroll: true,
  showTimestamp: true,
  searchQuery: "",
  scanMode: "auto",
  scanAddress: 0x20000000,
  pollInterval: 10, // 默认 10ms，更快的轮询
  totalBytes: 0,
  lineIdCounter: 0,

  setRunning: (isRunning) => set({ isRunning, error: null }),

  setPaused: (isPaused) => set({ isPaused }),

  setError: (error) => set({ error, isRunning: false }),

  setChannels: (upChannels, downChannels) => set({ upChannels, downChannels }),

  selectChannel: (selectedChannel) => set({ selectedChannel }),

  addLine: (line) =>
    set((state) => {
      const id = state.lineIdCounter + 1;
      const newLine: RttLine = { ...line, id };
      const lines = [...state.lines, newLine].slice(-state.maxLines);
      return { lines, lineIdCounter: id };
    }),

  addLines: (newLines) =>
    set((state) => {
      let idCounter = state.lineIdCounter;
      const linesWithId: RttLine[] = newLines.map((line) => ({
        ...line,
        id: ++idCounter,
      }));
      const lines = [...state.lines, ...linesWithId].slice(-state.maxLines);
      return { lines, lineIdCounter: idCounter };
    }),

  clearLines: () => set({ lines: [], lineIdCounter: 0, totalBytes: 0 }),

  setAutoScroll: (autoScroll) => set({ autoScroll }),

  setShowTimestamp: (showTimestamp) => set({ showTimestamp }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setScanMode: (scanMode) => set({ scanMode }),

  setScanAddress: (scanAddress) => set({ scanAddress }),

  setPollInterval: (pollInterval) => set({ pollInterval }),

  addBytes: (count) =>
    set((state) => ({ totalBytes: state.totalBytes + count })),

  reset: () =>
    set({
      isRunning: false,
      isPaused: false,
      error: null,
      upChannels: [],
      downChannels: [],
      lines: [],
      totalBytes: 0,
      lineIdCounter: 0,
    }),
}));

// 辅助函数：将字节数据转换为文本行
export function parseRttData(
  data: number[],
  channel: number,
  timestamp: number,
  pendingBuffer: Map<number, string>
): Omit<RttLine, "id">[] {
  const lines: Omit<RttLine, "id">[] = [];
  const text = new TextDecoder().decode(new Uint8Array(data));
  const date = new Date(timestamp);

  // 获取该通道的未完成行
  const pending = pendingBuffer.get(channel) || "";
  const fullText = pending + text;

  // 按换行符分割
  const parts = fullText.split(/\r?\n/);

  // 最后一部分可能是不完整的行
  const lastPart = parts.pop() || "";
  pendingBuffer.set(channel, lastPart);

  // 处理完整的行
  for (const part of parts) {
    if (part.trim()) {
      lines.push({
        channel,
        timestamp: date,
        text: part,
        level: parseLogLevel(part),
      });
    }
  }

  return lines;
}

// 选择器：获取过滤后的行
export function useFilteredLines() {
  return useRttStore((state) => {
    let filtered = state.lines;

    // 按通道过滤
    if (state.selectedChannel >= 0) {
      filtered = filtered.filter((line) => line.channel === state.selectedChannel);
    }

    // 按搜索词过滤
    if (state.searchQuery.trim()) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter((line) =>
        line.text.toLowerCase().includes(query)
      );
    }

    return filtered;
  });
}
