import { useState, useEffect } from "react";
import {
  FolderOpen,
  Save,
  Unlock,
  Download,
  Trash2,
  CheckCircle,
  Upload,
  Zap,
  RotateCcw,
  Square,
  Play,
  Cpu,
  HardDrive,
  Layers,
  Settings,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProbeStore } from "@/stores/probeStore";
import { useChipStore } from "@/stores/chipStore";
import { useFlashStore } from "@/stores/flashStore";
import { useLogStore } from "@/stores/logStore";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { flashFirmware, eraseChip, eraseSector, verifyFirmware, readFlash } from "@/lib/tauri";
import { listen } from "@tauri-apps/api/event";
import type { FlashProgressEvent, EraseMode } from "@/lib/types";
import { EraseDialog } from "@/components/dialogs/EraseDialog";
import { formatBytes, formatHex, cn } from "@/lib/utils";
import { LogPanel } from "@/components/log/LogPanel";

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

function ToolbarButton({ icon, label, onClick, disabled }: ToolbarButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            disabled={disabled}
            className="h-8 w-8"
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ToolbarSeparator() {
  return <div className="w-px h-6 bg-border mx-1" />;
}

// Flash Mode Toolbar Component
function FlashToolbar() {
  const { connected } = useProbeStore();
  const { selectedFlashAlgorithm } = useChipStore();
  const {
    firmwarePath,
    setFirmwarePath,
    flashing,
    setFlashing,
    setProgress,
    verifyAfterFlash,
    resetAfterFlash,
    eraseMode,
    setEraseMode,
  } = useFlashStore();
  const addLog = useLogStore((state) => state.addLog);
  const [eraseDialogOpen, setEraseDialogOpen] = useState(false);

  useEffect(() => {
    const unlisten = listen<FlashProgressEvent>("flash-progress", (event) => {
      const { phase, progress, message } = event.payload;
      setProgress(progress * 100, phase, message);
      addLog("info", message);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setProgress, addLog]);

  const handleOpenFile = async () => {
    const file = await open({
      multiple: false,
      filters: [
        { name: "固件文件", extensions: ["hex", "bin", "elf", "axf", "out", "ihex"] },
        { name: "所有文件", extensions: ["*"] },
      ],
    });

    if (file) {
      setFirmwarePath(file);
      addLog("info", `已选择固件文件: ${file}`);
    }
  };

  const handleSaveProject = async () => {
    const path = await save({
      filters: [{ name: "项目文件", extensions: ["daplink"] }],
    });

    if (path) {
      addLog("info", `项目已保存: ${path}`);
    }
  };

  const handleFlash = async () => {
    if (!firmwarePath) {
      addLog("error", "请先选择固件文件");
      return;
    }

    if (!connected) {
      addLog("error", "请先连接设备");
      return;
    }

    try {
      setFlashing(true);
      setProgress(0, "init", "开始烧录");
      addLog("info", `开始烧录: ${firmwarePath}`);

      await flashFirmware({
        file_path: firmwarePath,
        verify: verifyAfterFlash,
        skip_erase: false,
        reset_after: resetAfterFlash,
        erase_mode: eraseMode,
        flash_algorithm: selectedFlashAlgorithm || undefined,
      });

      addLog("success", "烧录成功");
    } catch (error) {
      addLog("error", `烧录失败: ${error}`);
    } finally {
      setFlashing(false);
    }
  };

  const handleErase = async () => {
    if (!connected) {
      addLog("error", "请先连接设备");
      return;
    }
    setEraseDialogOpen(true);
  };

  const handleEraseConfirm = async (mode: "full" | "custom", address?: number, size?: number) => {
    try {
      setFlashing(true);

      if (mode === "full") {
        addLog("info", "开始全片擦除");
        await eraseChip();
        addLog("success", "全片擦除完成");
      } else if (mode === "custom" && address !== undefined && size !== undefined) {
        addLog("info", `开始擦除 0x${address.toString(16).toUpperCase()} - 0x${(address + size).toString(16).toUpperCase()} (${size} 字节)`);
        await eraseSector(address, size);
        addLog("success", "自定义范围擦除完成");
      }
    } catch (error) {
      addLog("error", `擦除失败: ${error}`);
    } finally {
      setFlashing(false);
    }
  };

  const handleVerify = async () => {
    if (!firmwarePath) {
      addLog("error", "请先选择固件文件");
      return;
    }

    if (!connected) {
      addLog("error", "请先连接设备");
      return;
    }

    try {
      setFlashing(true);
      addLog("info", "开始校验");
      const result = await verifyFirmware(firmwarePath);
      if (result) {
        addLog("success", "校验通过");
      } else {
        addLog("error", "校验失败");
      }
    } catch (error) {
      addLog("error", `校验失败: ${error}`);
    } finally {
      setFlashing(false);
    }
  };

  const handleRead = async () => {
    if (!connected) {
      addLog("error", "请先连接设备");
      return;
    }

    const path = await save({
      filters: [{ name: "二进制文件", extensions: ["bin"] }],
    });

    if (path) {
      try {
        setFlashing(true);
        addLog("info", "开始读取Flash");
        const data = await readFlash(0x08000000, 0x10000); // 64KB
        addLog("success", `已读取 ${data.length} 字节到 ${path}`);
      } catch (error) {
        addLog("error", `读取失败: ${error}`);
      } finally {
        setFlashing(false);
      }
    }
  };

  return (
    <div className="flex items-center h-10 px-2 border-b border-border bg-muted/30">
      <div className="flex items-center gap-1">
        {/* File operations */}
        <ToolbarButton
          icon={<FolderOpen className="h-4 w-4" />}
          label="打开固件文件"
          onClick={handleOpenFile}
        />
        <ToolbarButton
          icon={<Save className="h-4 w-4" />}
          label="保存项目"
          onClick={handleSaveProject}
        />
        <ToolbarSeparator />

        {/* Device operations */}
        <ToolbarButton
          icon={<Unlock className="h-4 w-4" />}
          label="解锁芯片"
          disabled={!connected || flashing}
        />
        <ToolbarSeparator />

        {/* Flash operations */}
        <ToolbarButton
          icon={<Trash2 className="h-4 w-4" />}
          label="擦除Flash"
          disabled={!connected || flashing}
          onClick={handleErase}
        />

        {/* Erase mode selector */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">烧录模式:</span>
                <Select
                  value={eraseMode}
                  onValueChange={(value) => setEraseMode(value as EraseMode)}
                  disabled={flashing}
                >
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SectorErase">扇区擦除</SelectItem>
                    <SelectItem value="ChipErase">整片擦除</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>烧录时的擦除模式：扇区擦除只擦除需要写入的区域（快），整片擦除会清空整个Flash（慢但彻底）</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <ToolbarButton
          icon={<Download className="h-4 w-4" />}
          label="烧录固件"
          disabled={!connected || flashing || !firmwarePath}
          onClick={handleFlash}
        />
        <ToolbarButton
          icon={<CheckCircle className="h-4 w-4" />}
          label="校验"
          disabled={!connected || flashing || !firmwarePath}
          onClick={handleVerify}
        />
        <ToolbarButton
          icon={<Upload className="h-4 w-4" />}
          label="读取Flash"
          disabled={!connected || flashing}
          onClick={handleRead}
        />
        <ToolbarButton
          icon={<Zap className="h-4 w-4" />}
          label="一键烧录"
          disabled={!connected || flashing || !firmwarePath}
          onClick={handleFlash}
        />
        <ToolbarSeparator />

        {/* Control operations */}
        <ToolbarButton
          icon={<RotateCcw className="h-4 w-4" />}
          label="复位"
          disabled={!connected || flashing}
        />
        <ToolbarButton
          icon={<Square className="h-4 w-4" />}
          label="停止"
          disabled={!connected || flashing}
        />
        <ToolbarButton
          icon={<Play className="h-4 w-4" />}
          label="运行"
          disabled={!connected || flashing}
        />
      </div>

      {/* Status display */}
      <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
        {firmwarePath && (
          <span className="max-w-[200px] truncate text-xs" title={firmwarePath}>
            {firmwarePath.split(/[\\/]/).pop()}
          </span>
        )}
      </div>

      {/* Erase dialog */}
      <EraseDialog
        open={eraseDialogOpen}
        onOpenChange={setEraseDialogOpen}
        onConfirm={handleEraseConfirm}
      />
    </div>
  );
}

// Flash Mode Content Component
function FlashContent() {
  const { connected, targetInfo } = useProbeStore();
  const { chipInfo, selectedFlashAlgorithm, selectFlashAlgorithm } = useChipStore();
  const {
    flashing,
    progress,
    message,
    firmwarePath,
    verifyAfterFlash,
    resetAfterFlash,
    useCustomAddress,
    customFlashAddress,
    customFlashSize
  } = useFlashStore();
  const setVerifyAfterFlash = useFlashStore((state) => state.setVerifyAfterFlash);
  const setResetAfterFlash = useFlashStore((state) => state.setResetAfterFlash);
  const setUseCustomAddress = useFlashStore((state) => state.setUseCustomAddress);
  const setCustomFlashAddress = useFlashStore((state) => state.setCustomFlashAddress);
  const setCustomFlashSize = useFlashStore((state) => state.setCustomFlashSize);

  return (
    <div className="h-full p-4 overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        {/* Chip info */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              芯片信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chipInfo ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">型号</span>
                  <span className="font-mono">{chipInfo.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">厂商</span>
                  <span>{chipInfo.vendor || "未知"}</span>
                </div>
                {chipInfo.cores.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">内核</span>
                    <span>{chipInfo.cores[0].core_type}</span>
                  </div>
                )}
                {connected && targetInfo && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">状态</span>
                    <span className="text-green-500">已连接</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                请选择目标芯片
              </div>
            )}
          </CardContent>
        </Card>

        {/* Flash mapping */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Flash 映射
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chipInfo && chipInfo.memory_regions.length > 0 ? (
              <div className="space-y-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left py-1">名称</th>
                      <th className="text-left py-1">类型</th>
                      <th className="text-right py-1">起始地址</th>
                      <th className="text-right py-1">大小</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chipInfo.memory_regions.map((region, index) => (
                      <tr key={index} className="border-t border-border">
                        <td className="py-1">{region.name || `区域${index + 1}`}</td>
                        <td className="py-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs ${
                              region.kind === "Flash"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-green-500/20 text-green-400"
                            }`}
                          >
                            {region.kind}
                          </span>
                        </td>
                        <td className="text-right font-mono py-1">
                          {formatHex(region.address)}
                        </td>
                        <td className="text-right font-mono py-1">
                          {formatBytes(region.size)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                无Flash映射信息
              </div>
            )}
          </CardContent>
        </Card>

        {/* Flash algorithm */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4" />
              烧录算法
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chipInfo && chipInfo.flash_algorithms.length > 0 ? (
              <div className="space-y-1">
                {chipInfo.flash_algorithms.map((algo, index) => (
                  <div
                    key={index}
                    onClick={() => selectFlashAlgorithm(algo.name)}
                    className={`flex items-center justify-between text-sm py-2 px-2 rounded cursor-pointer transition-colors ${
                      selectedFlashAlgorithm === algo.name
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-accent border border-transparent"
                    }`}
                  >
                    <span className="font-mono text-xs">{algo.name}</span>
                    <div className="flex items-center gap-2">
                      {algo.default && (
                        <span className="text-xs text-green-500">默认</span>
                      )}
                      {selectedFlashAlgorithm === algo.name && (
                        <span className="text-xs text-primary font-medium">✓</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                无烧录算法
              </div>
            )}
          </CardContent>
        </Card>

        {/* Flash settings */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" />
              烧录设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <div className="flex justify-between mb-2">
                <span className="text-muted-foreground">固件文件</span>
                <span className="font-mono text-xs max-w-[150px] truncate">
                  {firmwarePath ? firmwarePath.split(/[\\/]/).pop() : "未选择"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">烧录后校验</span>
                <input
                  type="checkbox"
                  checked={verifyAfterFlash}
                  onChange={(e) => setVerifyAfterFlash(e.target.checked)}
                  className="h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className="text-muted-foreground">烧录后复位</span>
                <input
                  type="checkbox"
                  checked={resetAfterFlash}
                  onChange={(e) => setResetAfterFlash(e.target.checked)}
                  className="h-4 w-4"
                />
              </div>

              <div className="border-t border-border mt-3 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground">自定义ROM地址</span>
                  <input
                    type="checkbox"
                    checked={useCustomAddress}
                    onChange={(e) => setUseCustomAddress(e.target.checked)}
                    className="h-4 w-4"
                  />
                </div>

                {useCustomAddress && (
                  <div className="space-y-2 mt-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-muted-foreground">
                          IROM1 起始地址
                        </label>
                        {chipInfo && chipInfo.memory_regions.length > 0 && (
                          <button
                            onClick={() => {
                              const flashRegion = chipInfo.memory_regions.find(r => r.kind === "Flash");
                              if (flashRegion) {
                                setCustomFlashAddress(flashRegion.address);
                                setCustomFlashSize(flashRegion.size);
                              }
                            }}
                            className="text-xs text-blue-500 hover:text-blue-400"
                          >
                            使用芯片默认值
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={`0x${customFlashAddress.toString(16).toUpperCase().padStart(8, '0')}`}
                        onChange={(e) => {
                          const value = e.target.value.replace(/^0x/i, '');
                          const parsed = parseInt(value, 16);
                          if (!isNaN(parsed)) {
                            setCustomFlashAddress(parsed);
                          }
                        }}
                        className="w-full px-2 py-1 text-xs font-mono bg-background border border-border rounded"
                        placeholder="0x08000000"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">
                        IROM1 大小
                      </label>
                      <input
                        type="text"
                        value={`0x${customFlashSize.toString(16).toUpperCase()}`}
                        onChange={(e) => {
                          const value = e.target.value.replace(/^0x/i, '');
                          const parsed = parseInt(value, 16);
                          if (!isNaN(parsed)) {
                            setCustomFlashSize(parsed);
                          }
                        }}
                        className="w-full px-2 py-1 text-xs font-mono bg-background border border-border rounded"
                        placeholder="0x100000"
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        {customFlashSize > 0 ? `${formatBytes(customFlashSize)} (${customFlashSize} 字节)` : '未设置'}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      <div className="font-medium mb-1">参考 (Keil风格):</div>
                      <div>• IROM1: 0x08000000, 0x100000 (1MB)</div>
                      <div>• IRAM1: 0x20000000, 0x1C000 (112KB)</div>
                      <div className="mt-1 text-[10px]">
                        注：烧录时仅需配置ROM区域
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress display */}
      {flashing && (
        <Card className="mt-4">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">烧录进度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={progress} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{message}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Firmware file extensions
const FIRMWARE_EXTENSIONS = [".hex", ".bin", ".elf", ".axf", ".out", ".ihex"];

// Check if file is a firmware file
function isFirmwareFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return FIRMWARE_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
}

// Main FlashMode Component
export function FlashMode() {
  const [isDragging, setIsDragging] = useState(false);
  const { setFirmwarePath } = useFlashStore();
  const addLog = useLogStore((state) => state.addLog);

  // Listen for file drag-drop events
  useEffect(() => {
    const webview = getCurrentWebviewWindow();

    const unlisten = webview.onDragDropEvent(async (event) => {
      if (event.payload.type === "enter") {
        const paths = event.payload.paths || [];
        const hasFirmwareFile = paths.some(isFirmwareFile);
        if (hasFirmwareFile) {
          setIsDragging(true);
        }
      } else if (event.payload.type === "drop") {
        setIsDragging(false);
        const paths = event.payload.paths || [];
        const firmwareFiles = paths.filter(isFirmwareFile);

        if (firmwareFiles.length > 0) {
          // Use the first firmware file
          const firmwarePath = firmwareFiles[0];
          setFirmwarePath(firmwarePath);
          addLog("info", `已选择固件文件: ${firmwarePath.split(/[\\/]/).pop()}`);

          if (firmwareFiles.length > 1) {
            addLog("warn", `检测到多个固件文件，仅使用第一个`);
          }
        }
      } else if (event.payload.type === "leave") {
        setIsDragging(false);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setFirmwarePath, addLog]);

  return (
    <div className={cn(
      "h-full flex flex-col overflow-hidden relative",
      isDragging && "ring-2 ring-primary ring-inset"
    )}>
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-dashed border-primary bg-primary/5">
            <FileCode className="h-12 w-12 text-primary animate-bounce" />
            <p className="text-lg font-medium text-primary">释放以选择固件文件</p>
            <p className="text-xs text-muted-foreground">支持 .hex, .bin, .elf, .axf 格式</p>
          </div>
        </div>
      )}

      {/* Flash Toolbar */}
      <FlashToolbar />

      {/* Flash Content */}
      <div className="flex-1 overflow-hidden">
        <FlashContent />
      </div>

      {/* Log Panel */}
      <LogPanel />
    </div>
  );
}
