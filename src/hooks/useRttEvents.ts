import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useRttStore, parseRttData } from "@/stores/rttStore";
import type { RttDataEvent, RttStatusEvent } from "@/lib/types";

/**
 * 监听 RTT 事件的 Hook
 * 在组件挂载时自动订阅 RTT 数据和状态事件
 */
export function useRttEvents() {
  const { addLines, addBytes, setRunning, setError } = useRttStore();
  const pendingBufferRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    // 监听 RTT 数据事件
    const unlistenData = listen<RttDataEvent>("rtt-data", (event) => {
      // 如果暂停，不处理数据
      if (useRttStore.getState().isPaused) {
        return;
      }

      const { channel, data, timestamp } = event.payload;

      // 统计字节数
      addBytes(data.length);

      // 解析数据为文本行
      const lines = parseRttData(data, channel, timestamp, pendingBufferRef.current);

      if (lines.length > 0) {
        addLines(lines);
      }
    });

    // 监听 RTT 状态事件
    const unlistenStatus = listen<RttStatusEvent>("rtt-status", (event) => {
      const { running, error } = event.payload;
      setRunning(running);
      if (error) {
        setError(error);
      }
    });

    // 清理
    return () => {
      unlistenData.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
    };
  }, [addLines, addBytes, setRunning, setError]);
}

/**
 * 获取 RTT 统计信息
 */
export function useRttStats() {
  const { lines, totalBytes, isRunning } = useRttStore();

  return {
    lineCount: lines.length,
    totalBytes,
    isRunning,
    bytesFormatted: formatBytes(totalBytes),
  };
}

// 格式化字节数
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
