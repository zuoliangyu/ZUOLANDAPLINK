import { useRttEvents } from "@/hooks/useRttEvents";
import { RttPanel } from "@/components/rtt";
import { LogPanel } from "@/components/log/LogPanel";

export function RttMode() {
  // Listen to RTT events at the mode level
  useRttEvents();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* RTT Panel */}
      <div className="flex-1 overflow-hidden">
        <RttPanel className="h-full" />
      </div>

      {/* System Log Panel - shows connection errors, etc. */}
      <LogPanel />
    </div>
  );
}
