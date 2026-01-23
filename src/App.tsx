import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { MainArea } from "./components/layout/MainArea";
import { LogPanel } from "./components/log/LogPanel";
import { useEffect } from "react";
import { useLogStore } from "./stores/logStore";
import { useProbeStore } from "./stores/probeStore";
import { useRttStore } from "./stores/rttStore";
import { useUserActivity } from "./hooks/useUserActivity";
import { disconnect } from "./lib/tauri";

function App() {
  const addLog = useLogStore((state) => state.addLog);
  const { connected, autoDisconnect, autoDisconnectTimeout, setConnected } = useProbeStore();
  const { isRunning: rttRunning } = useRttStore();
  const { isActive, timeRemainingSeconds } = useUserActivity(autoDisconnectTimeout);

  useEffect(() => {
    addLog("info", "ZUOLAN DAPLINK RTTVIEW工具已启动");
    addLog("info", "等待连接调试探针...");
  }, [addLog]);

  // 自动断开逻辑
  useEffect(() => {
    // 如果未启用自动断开，或未连接，或RTT正在运行，则不执行自动断开
    if (!autoDisconnect || !connected || rttRunning) {
      return;
    }

    // 如果用户不活跃，执行自动断开
    if (!isActive) {
      handleAutoDisconnect();
    }
  }, [isActive, autoDisconnect, connected, rttRunning]);

  const handleAutoDisconnect = async () => {
    try {
      await disconnect();
      setConnected(false);
      addLog("info", `检测到 ${autoDisconnectTimeout / 1000} 秒无操作，已自动断开连接`);
    } catch (error) {
      addLog("error", `自动断开失败: ${error}`);
    }
  };

  // 显示倒计时提示（最后5秒）
  useEffect(() => {
    if (
      autoDisconnect &&
      connected &&
      !rttRunning &&
      timeRemainingSeconds > 0 &&
      timeRemainingSeconds <= 5
    ) {
      // 可以在这里添加倒计时提示UI
      // 例如：显示一个toast或者在Header中显示倒计时
    }
  }, [autoDisconnect, connected, rttRunning, timeRemainingSeconds]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MainArea />
      </div>
      <LogPanel />
    </div>
  );
}

export default App;
