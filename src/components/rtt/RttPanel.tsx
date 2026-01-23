import { useRttStore } from "@/stores/rttStore";
import { useRttEvents } from "@/hooks/useRttEvents";
import { RttToolbar } from "./RttToolbar";
import { RttViewer } from "./RttViewer";
import { RttStatusBar } from "./RttStatusBar";

export function RttPanel() {
  const { error } = useRttStore();

  // 监听 RTT 事件
  useRttEvents();

  // 移除主连接检查，RTT 现在是独立的
  return (
    <div className="flex flex-col h-full">
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
        <RttViewer />
      </div>

      {/* 状态栏 */}
      <RttStatusBar />
    </div>
  );
}
