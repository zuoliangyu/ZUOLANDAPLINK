import { useRef, useEffect } from "react";
import { useLogStore } from "@/stores/logStore";
import { formatTime } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogPanel() {
  const { logs, clearLogs } = useLogStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "text-red-500";
      case "warn":
        return "text-yellow-500";
      case "success":
        return "text-green-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return "[错误]";
      case "warn":
        return "[警告]";
      case "success":
        return "[成功]";
      default:
        return "[信息]";
    }
  };

  return (
    <div className="h-32 border-t border-border bg-muted/30">
      <div className="flex items-center justify-between px-3 py-1 border-b border-border">
        <span className="text-xs font-medium">输出日志</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={clearLogs}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="h-[calc(100%-28px)] overflow-y-auto p-2 font-mono text-xs"
      >
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 py-0.5">
            <span className="text-muted-foreground shrink-0">
              [{formatTime(log.timestamp)}]
            </span>
            <span className={`shrink-0 ${getLevelColor(log.level)}`}>
              {getLevelIcon(log.level)}
            </span>
            <span className={getLevelColor(log.level)}>{log.message}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-muted-foreground text-center py-4">
            暂无日志
          </div>
        )}
      </div>
    </div>
  );
}
