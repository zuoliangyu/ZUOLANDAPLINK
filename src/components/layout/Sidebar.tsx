import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Plug, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { listProbes, connectTarget, disconnect, searchChips, getChipInfo } from "@/lib/tauri";

export function Sidebar() {
  const {
    probes,
    selectedProbe,
    connected,
    settings,
    loading,
    setProbes,
    selectProbe,
    setConnected,
    setSettings,
    setLoading,
    setError,
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

  const refreshProbes = useCallback(async () => {
    try {
      setLoading(true);
      const probeList = await listProbes();
      setProbes(probeList);
      addLog("info", `检测到 ${probeList.length} 个探针`);
    } catch (error) {
      setError(String(error));
      addLog("error", `探针检测失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setProbes, setError, addLog]);

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

      setConnected(true, {
        probe_name: selectedProbe.identifier,
        target_name: selectedChip,
        core_type: targetInfo.core_type,
        chip_id: null,
      }, targetInfo);

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

    try {
      const info = await getChipInfo(chipName);
      setChipInfo(info);
      addLog("info", `已选择芯片: ${chipName}`);
    } catch (error) {
      addLog("error", `获取芯片信息失败: ${error}`);
    }
  };

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
            value={selectedProbe?.identifier || ""}
            onValueChange={(value) => {
              const probe = probes.find((p) => p.identifier === value);
              selectProbe(probe || null);
            }}
            disabled={connected}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择探针" />
            </SelectTrigger>
            <SelectContent>
              {probes.map((probe) => (
                <SelectItem key={probe.identifier} value={probe.identifier}>
                  {probe.identifier}
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

      {/* 接口设置 */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">接口设置</CardTitle>
        </CardHeader>
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
      </Card>

      {/* 连接按钮 */}
      <Button
        className="w-full"
        onClick={connected ? handleDisconnect : handleConnect}
        disabled={loading || (!connected && (!selectedProbe || !selectedChip))}
      >
        {connected ? (
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
    </aside>
  );
}
