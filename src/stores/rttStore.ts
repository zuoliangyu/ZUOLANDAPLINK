import { create } from "zustand";
import type { RttChannel, RttLine, RttScanMode } from "@/lib/types";
import type { ColorParserConfig } from "@/lib/rttColorParser";
import { loadColorParserConfig, saveColorParserConfig } from "@/lib/rttColorParser";

interface RttState {
  // RTT 连接状态
  rttConnected: boolean;
  rttConnecting: boolean;

  // 运行状态
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
  displayMode: "text" | "hex"; // 新增：显示模式
  colorParserConfig: ColorParserConfig; // 新增：颜色解析配置

  // 配置
  scanMode: RttScanMode;
  scanAddress: number;
  pollInterval: number;

  // 统计
  totalBytes: number;
  lineIdCounter: number;

  // 操作
  setRttConnected: (connected: boolean) => void;
  setRttConnecting: (connecting: boolean) => void;
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
  setDisplayMode: (mode: "text" | "hex") => void; // 新增
  setColorParserConfig: (config: ColorParserConfig) => void; // 新增
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
  rttConnected: false,
  rttConnecting: false,
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
  displayMode: "text", // 新增：默认文本模式
  colorParserConfig: loadColorParserConfig(), // 新增：从 localStorage 加载配置
  scanMode: "auto",
  scanAddress: 0x20000000,
  pollInterval: 10, // 默认 10ms，更快的轮询
  totalBytes: 0,
  lineIdCounter: 0,

  setRttConnected: (rttConnected) => set({ rttConnected }),

  setRttConnecting: (rttConnecting) => set({ rttConnecting }),

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

  setDisplayMode: (displayMode) => set({ displayMode }), // 新增

  setColorParserConfig: (colorParserConfig) => {
    saveColorParserConfig(colorParserConfig); // 保存到 localStorage
    set({ colorParserConfig });
  },

  setScanMode: (scanMode) => set({ scanMode }),

  setScanAddress: (scanAddress) => set({ scanAddress }),

  setPollInterval: (pollInterval) => set({ pollInterval }),

  addBytes: (count) =>
    set((state) => ({ totalBytes: state.totalBytes + count })),

  reset: () =>
    set({
      rttConnected: false,
      rttConnecting: false,
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
  pendingBuffer: Map<number, { text: string; rawData: number[] }>
): Omit<RttLine, "id">[] {
  const lines: Omit<RttLine, "id">[] = [];
  const text = new TextDecoder().decode(new Uint8Array(data));
  const date = new Date(timestamp);

  // 获取该通道的未完成行
  const pending = pendingBuffer.get(channel) || { text: "", rawData: [] };
  const fullText = pending.text + text;
  const fullRawData = [...pending.rawData, ...data];

  // 按换行符分割
  const parts = fullText.split(/\r?\n/);

  // 最后一部分可能是不完整的行
  const lastPart = parts.pop() || "";

  // 计算最后一部分的字节长度
  const lastPartBytes = new TextEncoder().encode(lastPart);
  const lastRawData = fullRawData.slice(-lastPartBytes.length);
  pendingBuffer.set(channel, { text: lastPart, rawData: lastRawData });

  // 处理完整的行
  let currentOffset = 0;
  for (const part of parts) {
    if (part.trim()) {
      // 计算这一行的字节数据
      const lineBytes = new TextEncoder().encode(part);
      const lineRawData = fullRawData.slice(currentOffset, currentOffset + lineBytes.length);

      lines.push({
        channel,
        timestamp: date,
        text: part,
        level: parseLogLevel(part),
        rawData: lineRawData,
      });

      currentOffset += lineBytes.length + 1; // +1 for newline
    } else {
      currentOffset += 1; // empty line, just skip newline
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
