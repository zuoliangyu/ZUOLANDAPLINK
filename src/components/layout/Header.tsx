import {
  FolderOpen,
  Save,
  Unlock,
  Download,
  Trash2,
  FileDown,
  CheckCircle,
  Upload,
  Zap,
  RotateCcw,
  Square,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProbeStore } from "@/stores/probeStore";
import { useFlashStore } from "@/stores/flashStore";
import { useLogStore } from "@/stores/logStore";
import { open, save } from "@tauri-apps/plugin-dialog";
import { flashFirmware, eraseChip, verifyFirmware, readFlash } from "@/lib/tauri";
import { listen } from "@tauri-apps/api/event";
import type { FlashProgressEvent, EraseMode } from "@/lib/types";
import { useEffect } from "react";

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

export function Header() {
  const { connected } = useProbeStore();
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
        { name: "固件文件", extensions: ["bin", "hex", "elf"] },
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

    try {
      setFlashing(true);
      const modeLabel = eraseMode === "ChipErase" ? "全片擦除" : "扇区擦除";
      addLog("info", `开始${modeLabel}`);
      await eraseChip(eraseMode);
      addLog("success", `${modeLabel}完成`);
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
        // 读取默认的Flash区域
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
    <header className="flex items-center h-12 px-2 border-b border-border bg-background no-select">
      <div className="flex items-center gap-1">
        <span className="text-lg font-bold text-primary px-2">ZUOLAN DAPLINK</span>
        <ToolbarSeparator />

        {/* 文件操作 */}
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

        {/* 设备操作 */}
        <ToolbarButton
          icon={<Unlock className="h-4 w-4" />}
          label="解锁芯片"
          disabled={!connected || flashing}
        />
        <ToolbarSeparator />

        {/* 擦除模式选择 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
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
              <p>擦除模式：扇区擦除只擦除需要写入的区域，整片擦除会清空整个Flash</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <ToolbarSeparator />

        {/* Flash操作 */}
        <ToolbarButton
          icon={<Download className="h-4 w-4" />}
          label="写入Flash"
          disabled={!connected || flashing || !firmwarePath}
          onClick={handleFlash}
        />
        <ToolbarButton
          icon={<Trash2 className="h-4 w-4" />}
          label="擦除Flash"
          disabled={!connected || flashing}
          onClick={handleErase}
        />
        <ToolbarButton
          icon={<FileDown className="h-4 w-4" />}
          label="编程"
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

        {/* 控制操作 */}
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

      {/* 状态显示 */}
      <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
        {firmwarePath && (
          <span className="max-w-[200px] truncate" title={firmwarePath}>
            {firmwarePath.split(/[\\/]/).pop()}
          </span>
        )}
        <div
          className={`w-2 h-2 rounded-full ${
            connected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span>{connected ? "已连接" : "未连接"}</span>
      </div>
    </header>
  );
}
