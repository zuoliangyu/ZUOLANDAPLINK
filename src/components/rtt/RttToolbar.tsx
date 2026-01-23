import { useRttStore } from "@/stores/rttStore";
import { useLogStore } from "@/stores/logStore";
import { useProbeStore } from "@/stores/probeStore";
import { useChipStore } from "@/stores/chipStore";
import { startRtt, stopRtt, clearRttBuffer, connectRtt, disconnectRtt, getRttConnectionStatus } from "@/lib/tauri";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  Trash2,
  Download,
  ArrowDown,
  Search,
  FileText,
  Binary,
  Link,
  Unlink,
} from "lucide-react";
import { ColorSettingsDialog } from "./ColorSettingsDialog";
import { useEffect } from "react";

export function RttToolbar() {
  const {
    rttConnected,
    rttConnecting,
    isRunning,
    isPaused,
    autoScroll,
    searchQuery: rttSearchQuery, // 重命名避免冲突
    displayMode,
    scanMode,
    scanAddress,
    pollInterval,
    setRttConnected,
    setRttConnecting,
    setRunning,
    setPaused,
    setAutoScroll,
    setSearchQuery,
    setDisplayMode,
    setChannels,
    clearLines,
  } = useRttStore();

  const addLog = useLogStore((state) => state.addLog);
  const { selectedProbe, selectedChipName, settings } = useProbeStore();
  const { searchQuery: chipSearchQuery } = useChipStore(); // 重命名避免冲突

  // 检查 RTT 连接状态
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await getRttConnectionStatus();
        setRttConnected(status.connected);
      } catch {
        setRttConnected(false);
      }
    };
    checkStatus();
  }, [setRttConnected]);

  // RTT 连接（使用左侧边栏的全局配置）
  const handleRttConnect = async () => {
    if (!selectedProbe) {
      addLog("error", "请先在左侧选择调试探针");
      return;
    }

    // 优先使用 selectedChipName，如果为空则使用 chipSearchQuery（输入框的值）
    const chipName = selectedChipName || chipSearchQuery.trim();

    if (!chipName) {
      addLog("error", "请先在左侧输入目标芯片型号");
      return;
    }

    try {
      setRttConnecting(true);
      addLog("info", `正在连接 RTT (${chipName})...`);

      await connectRtt({
        probe_identifier: selectedProbe.identifier,
        target: chipName,
        interface_type: settings.interfaceType === "SWD" ? "Swd" : "Jtag",
        clock_speed: settings.clockSpeed,
        connect_mode: settings.connectMode === "Normal" ? "Normal" : "UnderReset",
      });

      setRttConnected(true);
      addLog("success", `RTT 连接成功: ${chipName}`);
    } catch (error) {
      addLog("error", `RTT 连接失败: ${error}`);
      setRttConnected(false);
    } finally {
      setRttConnecting(false);
    }
  };

  // RTT 断开
  const handleRttDisconnect = async () => {
    try {
      // 如果 RTT 正在运行，先停止
      if (isRunning) {
        await stopRtt();
        setRunning(false);
      }

      await disconnectRtt();
      setRttConnected(false);
      addLog("info", "RTT 已断开");
    } catch (error) {
      addLog("error", `RTT 断开失败: ${error}`);
    }
  };

  // 启动 RTT
  const handleStart = async () => {
    try {
      addLog("info", "正在启动 RTT...");
      const config = await startRtt({
        scan_mode: scanMode,
        address: scanMode === "exact" ? scanAddress : undefined,
        poll_interval: pollInterval,
      });

      setChannels(config.up_channels, config.down_channels);
      setRunning(true);
      addLog("success", `RTT 已启动，发现 ${config.up_channels.length} 个上行通道`);

      // 显示通道信息
      for (const ch of config.up_channels) {
        addLog("info", `  通道 ${ch.index}: ${ch.name || "(未命名)"} - ${ch.buffer_size} 字节`);
      }
    } catch (error) {
      addLog("error", `启动 RTT 失败: ${error}`);
    }
  };

  // 停止 RTT
  const handleStop = async () => {
    try {
      await stopRtt();
      setRunning(false);
      addLog("info", "RTT 已停止");
    } catch (error) {
      addLog("error", `停止 RTT 失败: ${error}`);
    }
  };

  // 暂停/继续
  const handleTogglePause = () => {
    setPaused(!isPaused);
  };

  // 清空
  const handleClear = async () => {
    clearLines();
    try {
      await clearRttBuffer();
    } catch {
      // 忽略错误
    }
  };

  // 格式化时间戳
  const formatTimestamp = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    const ms = date.getMilliseconds().toString().padStart(3, "0");
    return `${hours}:${minutes}:${seconds}.${ms}`;
  };

  // 导出为 TXT
  const handleExport = () => {
    const { lines } = useRttStore.getState();
    if (lines.length === 0) {
      addLog("warn", "没有数据可导出");
      return;
    }

    const content = lines
      .map((line) => {
        const time = formatTimestamp(line.timestamp);
        return `[${time}] [CH${line.channel}] ${line.text}`;
      })
      .join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rtt-log-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    addLog("success", `已导出 ${lines.length} 行数据`);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
      {/* RTT 连接/断开按钮 */}
      {!rttConnected ? (
        <Button
          size="sm"
          variant="outline"
          onClick={handleRttConnect}
          disabled={rttConnecting}
          className="gap-1"
        >
          <Link className="h-3.5 w-3.5" />
          {rttConnecting ? "连接中..." : "连接 RTT"}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={handleRttDisconnect}
          className="gap-1"
        >
          <Unlink className="h-3.5 w-3.5" />
          断开 RTT
        </Button>
      )}

      <div className="w-px h-5 bg-border" />

      {/* 启动/停止按钮 */}
      {!isRunning ? (
        <Button size="sm" onClick={handleStart} disabled={!rttConnected} className="gap-1">
          <Play className="h-3.5 w-3.5" />
          启动
        </Button>
      ) : (
        <Button size="sm" variant="destructive" onClick={handleStop} className="gap-1">
          <Square className="h-3.5 w-3.5" />
          停止
        </Button>
      )}

      {/* 暂停/继续按钮 */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleTogglePause}
        disabled={!isRunning}
        className="gap-1"
      >
        {isPaused ? (
          <>
            <RotateCcw className="h-3.5 w-3.5" />
            继续
          </>
        ) : (
          <>
            <Pause className="h-3.5 w-3.5" />
            暂停
          </>
        )}
      </Button>

      {/* 清空按钮 */}
      <Button size="sm" variant="outline" onClick={handleClear} className="gap-1">
        <Trash2 className="h-3.5 w-3.5" />
        清空
      </Button>

      <div className="w-px h-5 bg-border" />

      {/* 自动滚动 */}
      <Button
        size="sm"
        variant={autoScroll ? "secondary" : "outline"}
        onClick={() => setAutoScroll(!autoScroll)}
        className="gap-1"
      >
        <ArrowDown className="h-3.5 w-3.5" />
        自动滚动
      </Button>

      {/* 显示模式切换 */}
      <Button
        size="sm"
        variant={displayMode === "hex" ? "secondary" : "outline"}
        onClick={() => setDisplayMode(displayMode === "text" ? "hex" : "text")}
        className="gap-1"
      >
        {displayMode === "hex" ? (
          <>
            <Binary className="h-3.5 w-3.5" />
            Hex
          </>
        ) : (
          <>
            <FileText className="h-3.5 w-3.5" />
            文本
          </>
        )}
      </Button>

      <div className="flex-1" />

      {/* 搜索框 */}
      <div className="relative w-48">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="搜索..."
          value={rttSearchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 pl-7 text-xs"
        />
      </div>

      {/* 导出按钮 */}
      <Button size="sm" variant="outline" onClick={handleExport} className="gap-1">
        <Download className="h-3.5 w-3.5" />
        导出
      </Button>

      {/* 颜色设置 */}
      <ColorSettingsDialog />
    </div>
  );
}
