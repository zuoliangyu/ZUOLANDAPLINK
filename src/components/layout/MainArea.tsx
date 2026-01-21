import { useProbeStore } from "@/stores/probeStore";
import { useChipStore } from "@/stores/chipStore";
import { useFlashStore } from "@/stores/flashStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatBytes, formatHex } from "@/lib/utils";
import { Cpu, HardDrive, Layers, Settings } from "lucide-react";

export function MainArea() {
  const { connected, targetInfo } = useProbeStore();
  const { chipInfo } = useChipStore();
  const { flashing, progress, message, firmwarePath, verifyAfterFlash, resetAfterFlash } = useFlashStore();
  const setVerifyAfterFlash = useFlashStore((state) => state.setVerifyAfterFlash);
  const setResetAfterFlash = useFlashStore((state) => state.setResetAfterFlash);

  return (
    <main className="flex-1 p-4 overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        {/* 芯片信息 */}
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

        {/* Flash映射 */}
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

        {/* 烧录算法 */}
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
                    className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0"
                  >
                    <span className="font-mono text-xs">{algo.name}</span>
                    {algo.default && (
                      <span className="text-xs text-green-500">默认</span>
                    )}
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

        {/* 烧录设置 */}
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
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 进度显示 */}
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
    </main>
  );
}
