import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { importPack, listImportedPacks, deletePack } from "@/lib/tauri";
import type { PackInfo } from "@/lib/types";
import { useLogStore } from "@/stores/logStore";
import { Package, Upload, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PackManager() {
  const [packs, setPacks] = useState<PackInfo[]>([]);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const addLog = useLogStore((state) => state.addLog);

  // Load imported Pack list
  useEffect(() => {
    loadPacks();
  }, []);

  // Listen for file drag-drop events
  useEffect(() => {
    const webview = getCurrentWebviewWindow();

    const unlisten = webview.onDragDropEvent(async (event) => {
      if (event.payload.type === "enter") {
        // Check if any dragged file is a .pack file
        const paths = event.payload.paths || [];
        const hasPackFile = paths.some((p: string) => p.toLowerCase().endsWith(".pack"));
        if (hasPackFile) {
          setIsDragging(true);
          // Auto-expand when dragging pack files
          setIsOpen(true);
        }
      } else if (event.payload.type === "drop") {
        setIsDragging(false);
        const paths = event.payload.paths || [];
        const packFiles = paths.filter((p: string) => p.toLowerCase().endsWith(".pack"));

        if (packFiles.length > 0) {
          await importMultiplePacks(packFiles);
        }
      } else if (event.payload.type === "leave") {
        setIsDragging(false);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const loadPacks = async () => {
    try {
      setLoading(true);
      const packList = await listImportedPacks();
      setPacks(packList);
    } catch (error) {
      addLog("error", `加载Pack列表失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Import multiple Pack files
  const importMultiplePacks = useCallback(async (filePaths: string[]) => {
    if (filePaths.length === 0) return;

    setImporting(true);
    addLog("info", `开始导入 ${filePaths.length} 个Pack文件...`);

    let successCount = 0;
    let failCount = 0;

    for (const filePath of filePaths) {
      try {
        const packInfo = await importPack(filePath);
        addLog("success", `成功导入: ${packInfo.name} v${packInfo.version}`);
        successCount++;
      } catch (error) {
        addLog("error", `导入失败 ${filePath.split(/[\\/]/).pop()}: ${error}`);
        failCount++;
      }
    }

    if (successCount > 0) {
      addLog("info", `导入完成: ${successCount} 成功, ${failCount} 失败`);
      await loadPacks();
    }

    setImporting(false);
  }, [addLog]);

  // Import Pack file via dialog (supports multiple files)
  const handleImport = async () => {
    try {
      const selected = await open({
        filters: [{ name: "CMSIS Pack", extensions: ["pack"] }],
        multiple: true,
      });

      if (selected) {
        const files = Array.isArray(selected) ? selected : [selected];
        await importMultiplePacks(files);
      }
    } catch (error) {
      addLog("error", `导入Pack失败: ${error}`);
    }
  };

  // Delete Pack
  const handleDelete = async (packName: string) => {
    if (!confirm(`确定要删除Pack "${packName}" 吗？\n\n删除后需要重新导入才能使用。`)) {
      return;
    }

    try {
      addLog("info", `正在删除Pack: ${packName}`);
      await deletePack(packName);
      addLog("success", `成功删除Pack: ${packName}`);
      await loadPacks();
    } catch (error) {
      addLog("error", `删除Pack失败: ${error}`);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(
        "transition-all duration-200",
        isDragging && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <CardTitle className="text-sm">CMSIS-Pack 管理</CardTitle>
                {packs.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({packs.length})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleImport();
                  }}
                  disabled={importing || loading}
                  className="gap-1 h-7"
                >
                  <Upload className="h-3 w-3" />
                  {importing ? "导入中..." : "导入"}
                </Button>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-2">
            {/* Drag-drop hint */}
            {isDragging && (
              <div className="border-2 border-dashed border-primary rounded-lg p-4 text-center bg-primary/5">
                <Upload className="h-6 w-6 mx-auto mb-2 text-primary animate-bounce" />
                <p className="text-sm text-primary font-medium">释放以导入 Pack 文件</p>
              </div>
            )}

            {loading ? (
              <div className="text-center text-sm text-muted-foreground py-4">
                加载中...
              </div>
            ) : packs.length === 0 && !isDragging ? (
              <div className="text-center text-sm text-muted-foreground py-4">
                <p>暂无已导入的Pack包</p>
                <p className="text-xs mt-1">点击导入按钮或拖放 .pack 文件到此处</p>
              </div>
            ) : (
              packs.map((pack) => (
                <div
                  key={pack.name}
                  className="border rounded-lg p-3 space-y-1 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{pack.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {pack.vendor} • v{pack.version}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(pack.name)}
                      title="删除Pack"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {pack.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {pack.description}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    包含 {pack.device_count} 个设备
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
