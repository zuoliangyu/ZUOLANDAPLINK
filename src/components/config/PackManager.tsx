import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { open } from "@tauri-apps/plugin-dialog";
import { importPack, listImportedPacks } from "@/lib/tauri";
import type { PackInfo } from "@/lib/types";
import { useLogStore } from "@/stores/logStore";
import { Package, Upload, Trash2 } from "lucide-react";

export function PackManager() {
  const [packs, setPacks] = useState<PackInfo[]>([]);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const addLog = useLogStore((state) => state.addLog);

  // 加载已导入的Pack列表
  useEffect(() => {
    loadPacks();
  }, []);

  const loadPacks = async () => {
    try {
      setLoading(true);
      const packList = await listImportedPacks();
      setPacks(packList);
      addLog("info", `已加载 ${packList.length} 个Pack包`);
    } catch (error) {
      addLog("error", `加载Pack列表失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 导入Pack文件
  const handleImport = async () => {
    try {
      const selected = await open({
        filters: [{ name: "CMSIS Pack", extensions: ["pack"] }],
        multiple: false,
      });

      if (selected) {
        setImporting(true);
        addLog("info", `正在导入Pack: ${selected}`);

        const packInfo = await importPack(selected);

        addLog("success", `成功导入Pack: ${packInfo.name} v${packInfo.version}`);
        addLog("info", `厂商: ${packInfo.vendor}, 设备数: ${packInfo.device_count}`);

        await loadPacks();
      }
    } catch (error) {
      addLog("error", `导入Pack失败: ${error}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <CardTitle className="text-sm">CMSIS-Pack 管理</CardTitle>
          </div>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={importing || loading}
            className="gap-1"
          >
            <Upload className="h-3 w-3" />
            {importing ? "导入中..." : "导入 Pack"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            加载中...
          </div>
        ) : packs.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            暂无已导入的Pack包
            <br />
            <span className="text-xs">点击上方按钮导入.pack文件</span>
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
                  disabled
                  title="删除功能开发中"
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
    </Card>
  );
}
