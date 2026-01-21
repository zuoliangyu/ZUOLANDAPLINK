import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { MainArea } from "./components/layout/MainArea";
import { LogPanel } from "./components/log/LogPanel";
import { useEffect } from "react";
import { useLogStore } from "./stores/logStore";

function App() {
  const addLog = useLogStore((state) => state.addLog);

  useEffect(() => {
    addLog("info", "ZUOLAN DAPLINK 烧录工具已启动");
    addLog("info", "等待连接调试探针...");
  }, [addLog]);

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
