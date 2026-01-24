import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSerialStore, parseSerialData } from "@/stores/serialStore";
import type { SerialDataEvent, SerialStatusEvent } from "@/lib/serialTypes";
import { parseChartData } from "@/lib/parseChartData";

/**
 * Hook to listen for serial events
 * Automatically subscribes to serial data and status events on mount
 */
export function useSerialEvents() {
  const {
    addLines,
    updateStats,
    setRunning,
    setConnected,
    setError,
    addChartData,
    chartConfig,
    incrementParseSuccess,
    incrementParseFail,
  } = useSerialStore();

  const pendingBufferRef = useRef<{ text: string; rawData: number[] }>({
    text: "",
    rawData: [],
  });

  useEffect(() => {
    // Listen for serial data events
    const unlistenData = listen<SerialDataEvent>("serial-data", (event) => {
      const { data, timestamp, direction } = event.payload;

      // Update stats
      const currentStats = useSerialStore.getState().stats;
      updateStats({
        bytes_received: currentStats.bytes_received + data.length,
        bytes_sent: currentStats.bytes_sent,
      });

      // Parse data to lines
      const { lines, pending } = parseSerialData(
        data,
        timestamp,
        direction as "rx" | "tx",
        pendingBufferRef.current
      );
      pendingBufferRef.current = pending;

      if (lines.length > 0) {
        addLines(lines);

        // If chart is enabled, try to parse chart data
        if (chartConfig.enabled) {
          for (const line of lines) {
            const result = parseChartData(line.text, chartConfig);
            if (result.success && result.dataPoint) {
              addChartData(result.dataPoint);
              incrementParseSuccess();
            } else {
              incrementParseFail();
            }
          }
        }
      }
    });

    // Listen for serial status events
    const unlistenStatus = listen<SerialStatusEvent>("serial-status", (event) => {
      const { connected, running, error } = event.payload;
      setConnected(connected);
      setRunning(running);
      if (error) {
        setError(error);
      }
    });

    // Cleanup
    return () => {
      unlistenData.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
    };
  }, [
    addLines,
    updateStats,
    setRunning,
    setConnected,
    setError,
    addChartData,
    chartConfig,
    incrementParseSuccess,
    incrementParseFail,
  ]);
}

/**
 * Get serial statistics
 */
export function useSerialStats() {
  const { lines, stats, running, connected } = useSerialStore();

  return {
    lineCount: lines.length,
    bytesReceived: stats.bytes_received,
    bytesSent: stats.bytes_sent,
    running,
    connected,
    bytesReceivedFormatted: formatBytes(stats.bytes_received),
    bytesSentFormatted: formatBytes(stats.bytes_sent),
  };
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
