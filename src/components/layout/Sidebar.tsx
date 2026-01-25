import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Plug, Unplug, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useProbeStore } from "@/stores/probeStore";
import { useChipStore } from "@/stores/chipStore";
import { useLogStore } from "@/stores/logStore";
import { listProbes, connectTarget, disconnect, searchChips, getChipInfo, getConnectionStatus } from "@/lib/tauri";
import { PackManager } from "@/components/config/PackManager";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const {
    probes,
    selectedProbe,
    connected,
    connectionInfo,
    settings,
    loading,
    autoDisconnect,
    autoDisconnectTimeout,
    setProbes,
    selectProbe,
    setSelectedChipName, // 新增
    setConnected,
    setSettings,
    setLoading,
    setError,
    setAutoDisconnect,
    setAutoDisconnectTimeout,
  } = useProbeStore();

  const {
    searchResults,
    selectedChip,
    searchQuery,
    setSearchResults,
    selectChip,
    setChipInfo,
    setSearchQuery,
  } = useChipStore();

  const addLog = useLogStore((state) => state.addLog);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // 折叠状态
  const [interfaceSettingsOpen, setInterfaceSettingsOpen] = useState(false);
  const [autoDisconnectOpen, setAutoDisconnectOpen] = useState(false);

  const refreshProbes = useCallback(async () => {
    try {
      setLoading(true);
      const probeList = await listProbes();

      // 🔍 调试日志：查看探针列表数据
      console.log("=== 探针列表调试 ===");
      console.log("探针数量:", probeList.length);
      console.log("探针详细信息:", JSON.stringify(probeList, null, 2));
      probeList.forEach((probe, index) => {
        console.log(`探针 ${index + 1}:`, {
          identifier: probe.identifier,
          probe_type: probe.probe_type,
          dap_version: probe.dap_version,
          vendor_id: probe.vendor_id,
          product_id: probe.product_id,
        });
      });
      console.log("==================");

      setProbes(probeList);

      // 自动选择第一个探针（如果有且当前没有选择）
      if (probeList.length > 0 && !selectedProbe) {
        selectProbe(probeList[0]);
        console.log("🔍 自动选择的探针:", probeList[0]);
        addLog("info", `检测到 ${probeList.length} 个探针，已自动选择第一个`);
      } else {
        addLog("info", `检测到 ${probeList.length} 个探针`);
      }
    } catch (error) {
      setError(String(error));
      addLog("error", `探针检测失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setProbes, selectProbe, selectedProbe, setError, addLog]);

  useEffect(() => {
    refreshProbes();
  }, [refreshProbes]);

  const handleConnect = async () => {
    if (!selectedProbe || !selectedChip) {
      addLog("error", "请先选择探针和目标芯片");
      return;
    }

    try {
      setLoading(true);
      addLog("info", `正在连接 ${selectedChip}...`);

      const targetInfo = await connectTarget({
        probe_identifier: selectedProbe.identifier,
        target: selectedChip,
        interface_type: settings.interfaceType === "SWD" ? "Swd" : "Jtag",
        clock_speed: settings.clockSpeed,
        connect_mode: settings.connectMode === "Normal" ? "Normal" : "UnderReset",
      });

      // 从后端获取完整的连接信息
      const status = await getConnectionStatus();

      setConnected(true, status.info, targetInfo);

      addLog("success", `已连接到 ${selectedChip}`);
    } catch (error) {
      setError(String(error));
      addLog("error", `连接失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setConnected(false);
      addLog("info", "已断开连接");
    } catch (error) {
      addLog("error", `断开连接失败: ${error}`);
    }
  };

  const handleChipSearch = (query: string) => {
    setSearchQuery(query);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const results = await searchChips(query);
        setSearchResults(results);
      } catch (error) {
        addLog("error", `芯片搜索失败: ${error}`);
      }
    }, 300);

    setSearchTimeout(timeout);
  };

  const handleChipSelect = async (chipName: string) => {
    selectChip(chipName);
    setSearchQuery(chipName);
    setSearchResults([]);
    setSelectedChipName(chipName); // 同步到 probeStore

    try {
      const info = await getChipInfo(chipName);
      setChipInfo(info);
      addLog("info", `已选择芯片: ${chipName}`);
    } catch (error) {
      addLog("error", `获取芯片信息失败: ${error}`);
    }
  };

  // 🔍 调试日志：查看当前选中的探针
  // console.log("🔍 当前渲染状态:", {
  //   selectedProbe: selectedProbe,
  //   hasDapVersion: selectedProbe?.dap_version ? "有" : "无",
  //   dapVersion: selectedProbe?.dap_version,
  // });

  return (
    <aside className="w-72 border-r border-border bg-muted/30 overflow-y-auto p-3 space-y-3">
      {/* 探针选择 */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">调试探针</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={refreshProbes}
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Select
            value={selectedProbe?.probe_id || ""}
            onValueChange={(value) => {
              const probe = probes.find((p) => p.probe_id === value);
              selectProbe(probe || null);
            }}
            disabled={connected}
          >
            <SelectTrigger>
              {selectedProbe ? (
                <div className="flex items-center gap-2 w-full">
                  <span className="truncate flex-1 text-left">{selectedProbe.identifier}</span>
                  {selectedProbe.dap_version && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">
                      {selectedProbe.dap_version}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">选择探针</span>
              )}
            </SelectTrigger>
            <SelectContent>
              {probes.map((probe) => (
                <SelectItem key={probe.probe_id} value={probe.probe_id}>
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="truncate">{probe.identifier}</span>
                    {probe.dap_version && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">
                        {probe.dap_version}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 芯片选择 */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">目标芯片</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="relative">
            <Input
              placeholder="搜索芯片型号..."
              value={searchQuery}
              onChange={(e) => handleChipSearch(e.target.value)}
              disabled={connected}
            />
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-background border border-border rounded-md shadow-lg">
                {searchResults.map((chip) => (
                  <button
                    key={chip}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                    onClick={() => handleChipSelect(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pack管理 */}
      <PackManager />

      {/* 接口设置 */}
      <Collapsible open={interfaceSettingsOpen} onOpenChange={setInterfaceSettingsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="py-3 cursor-pointer hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">接口设置</CardTitle>
                {interfaceSettingsOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">接口类型</label>
            <Select
              value={settings.interfaceType}
              onValueChange={(value: "SWD" | "JTAG") =>
                setSettings({ interfaceType: value })
              }
              disabled={connected}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SWD">SWD</SelectItem>
                <SelectItem value="JTAG">JTAG</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">时钟速度</label>
            <Select
              value={String(settings.clockSpeed)}
              onValueChange={(value) =>
                setSettings({ clockSpeed: parseInt(value) })
              }
              disabled={connected}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100000">100 kHz</SelectItem>
                <SelectItem value="500000">500 kHz</SelectItem>
                <SelectItem value="1000000">1 MHz</SelectItem>
                <SelectItem value="2000000">2 MHz</SelectItem>
                <SelectItem value="4000000">4 MHz</SelectItem>
                <SelectItem value="10000000">10 MHz</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">连接模式</label>
            <Select
              value={settings.connectMode}
              onValueChange={(value: "Normal" | "UnderReset") =>
                setSettings({ connectMode: value })
              }
              disabled={connected}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Normal">正常</SelectItem>
                <SelectItem value="UnderReset">复位下连接</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">复位方式</label>
            <Select
              value={settings.resetMode}
              onValueChange={(value: "Software" | "Hardware") =>
                setSettings({ resetMode: value })
              }
              disabled={connected}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Software">软件复位</SelectItem>
                <SelectItem value="Hardware">硬件复位</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 自动断开设置 */}
      <Collapsible open={autoDisconnectOpen} onOpenChange={setAutoDisconnectOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="py-3 cursor-pointer hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">自动断开</CardTitle>
                {autoDisconnectOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">启用自动断开</label>
            <Button
              size="sm"
              variant={autoDisconnect ? "secondary" : "outline"}
              onClick={() => setAutoDisconnect(!autoDisconnect)}
              className="h-7 text-xs"
            >
              {autoDisconnect ? "已启用" : "已禁用"}
            </Button>
          </div>

          {autoDisconnect && (
            <div>
              <label className="text-xs text-muted-foreground">超时时间（秒）</label>
              <Select
                value={String(autoDisconnectTimeout / 1000)}
                onValueChange={(value) =>
                  setAutoDisconnectTimeout(parseInt(value) * 1000)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 秒</SelectItem>
                  <SelectItem value="10">10 秒</SelectItem>
                  <SelectItem value="30">30 秒</SelectItem>
                  <SelectItem value="60">60 秒</SelectItem>
                  <SelectItem value="120">120 秒</SelectItem>
                  <SelectItem value="300">300 秒</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                无操作超时后自动断开连接（RTT运行时不会断开）
              </p>
            </div>
          )}
        </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 连接按钮 */}
      <Button
        className={cn(
          "w-full transition-all",
          connected
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-primary hover:bg-primary/90",
          loading && "animate-pulse"
        )}
        onClick={connected ? handleDisconnect : handleConnect}
        disabled={loading || (!connected && (!selectedProbe || !selectedChip))}
      >
        {loading ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            {connected ? "断开中..." : "连接中..."}
          </>
        ) : connected ? (
          <>
            <Unplug className="h-4 w-4 mr-2" />
            断开连接
          </>
        ) : (
          <>
            <Plug className="h-4 w-4 mr-2" />
            连接设备
          </>
        )}
      </Button>

      {/* 连接信息 */}
      {connected && connectionInfo && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">连接信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {selectedProbe?.dap_version && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">DAP版本:</span>
                <span>{selectedProbe.dap_version}</span>
              </div>
            )}
            {connectionInfo.probe_serial && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">DAP序列号:</span>
                <span className="font-mono text-[10px]">{connectionInfo.probe_serial}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">目标:</span>
              <span>{connectionInfo.target_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">内核:</span>
              <span>{connectionInfo.core_type}</span>
            </div>
            {connectionInfo.chip_id !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">芯片ID:</span>
                <span className="font-mono">
                  0x{connectionInfo.chip_id.toString(16).toUpperCase().padStart(8, '0')}
                </span>
              </div>
            )}
            {connectionInfo.target_idcode !== null && connectionInfo.target_idcode !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">DP IDCODE:</span>
                <span className="font-mono">
                  0x{connectionInfo.target_idcode.toString(16).toUpperCase().padStart(8, '0')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </aside>
  );
}
