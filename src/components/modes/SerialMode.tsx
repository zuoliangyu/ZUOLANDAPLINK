import { useSerialEvents } from "@/hooks/useSerialEvents";
import { SerialPanel } from "@/components/serial";
import { LogPanel } from "@/components/log/LogPanel";

export function SerialMode() {
  // Listen to serial events at the mode level
  useSerialEvents();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Serial Panel */}
      <div className="flex-1 overflow-hidden">
        <SerialPanel className="h-full" />
      </div>

      {/* System Log Panel */}
      <LogPanel />
    </div>
  );
}
