import { useRttStore } from "@/stores/rttStore";
import { RttToolbar } from "./RttToolbar";
import { RttViewer } from "./RttViewer";
import { RttStatusBar } from "./RttStatusBar";
import { RttChartViewer } from "./RttChartViewer";
import { Panel, Group, Separator } from "react-resizable-panels";
import { cn } from "@/lib/utils";

interface RttPanelProps {
  className?: string;
}

export function RttPanel({ className }: RttPanelProps) {
  const { error, viewMode, splitRatio, setSplitRatio } = useRttStore();

  // RTT is now independent from main connection
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 工具栏 */}
      <RttToolbar />

      {/* 错误提示 */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/30 text-red-500 text-xs">
          {error}
        </div>
      )}

      {/* 数据显示区 */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "text" ? (
          <RttViewer />
        ) : viewMode === "chart" ? (
          <RttChartViewer />
        ) : (
          // 分屏模式
          <Group orientation="vertical">
            <Panel
              defaultSize={splitRatio * 100}
              minSize={20}
              onResize={(panelSize) => setSplitRatio(panelSize.asPercentage / 100)}
            >
              <RttViewer />
            </Panel>
            <Separator className="h-1 bg-border hover:bg-primary/50 transition-colors" />
            <Panel defaultSize={(1 - splitRatio) * 100} minSize={20}>
              <RttChartViewer />
            </Panel>
          </Group>
        )}
      </div>

      {/* 状态栏 */}
      <RttStatusBar />
    </div>
  );
}
