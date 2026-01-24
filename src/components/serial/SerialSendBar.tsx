import { useState, useCallback, useRef } from "react";
import { Send, Binary, Trash2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSerialStore } from "@/stores/serialStore";
import { useLogStore } from "@/stores/logStore";
import { writeSerialString, writeSerial } from "@/lib/tauri";

// History persistence key
const SEND_HISTORY_KEY = "serial_send_history";
const MAX_HISTORY = 20;

function loadHistory(): string[] {
  try {
    const saved = localStorage.getItem(SEND_HISTORY_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Use default
  }
  return [];
}

function saveHistory(history: string[]) {
  try {
    localStorage.setItem(SEND_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {
    // Silent fail
  }
}

export function SerialSendBar() {
  const { connected, sendSettings, setSendSettings, addLine } = useSerialStore();
  const addLog = useLogStore((state) => state.addLog);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Send text
  const handleSend = useCallback(async () => {
    if (!inputText.trim() && !sendSettings.hexMode) {
      return;
    }

    if (!connected) {
      addLog("error", "串口未连接");
      return;
    }

    try {
      setSending(true);

      if (sendSettings.hexMode) {
        // Parse hex string to bytes
        const hexStr = inputText.replace(/\s+/g, "");
        if (!/^[0-9a-fA-F]*$/.test(hexStr) || hexStr.length % 2 !== 0) {
          addLog("error", "无效的十六进制格式");
          return;
        }

        const bytes: number[] = [];
        for (let i = 0; i < hexStr.length; i += 2) {
          bytes.push(parseInt(hexStr.substr(i, 2), 16));
        }

        await writeSerial(bytes);

        // Add to terminal as TX
        addLine({
          timestamp: new Date(),
          text: `HEX: ${inputText}`,
          level: "info",
          rawData: bytes,
          direction: "tx",
        });
      } else {
        await writeSerialString(inputText, sendSettings.encoding, sendSettings.lineEnding);

        // Add to terminal as TX
        addLine({
          timestamp: new Date(),
          text: inputText,
          level: "info",
          rawData: Array.from(new TextEncoder().encode(inputText)),
          direction: "tx",
        });
      }

      // Save to history
      const newHistory = [inputText, ...history.filter(h => h !== inputText)].slice(0, MAX_HISTORY);
      setHistory(newHistory);
      saveHistory(newHistory);

      setInputText("");
    } catch (error) {
      addLog("error", `发送失败: ${error}`);
    } finally {
      setSending(false);
    }
  }, [inputText, connected, sendSettings, addLog, addLine, history]);

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Select history item
  const selectHistory = (text: string) => {
    setInputText(text);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  // Clear history
  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  return (
    <div className="relative">
      {/* History dropdown */}
      {showHistory && history.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 mx-3 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto z-10">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/50">
            <span className="text-xs text-muted-foreground">历史记录</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5"
              onClick={clearHistory}
              title="清空历史"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          {history.map((item, index) => (
            <div
              key={index}
              className="px-3 py-1.5 text-xs font-mono cursor-pointer hover:bg-accent truncate"
              onClick={() => selectHistory(item)}
              title={item}
            >
              {item}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-muted/30">
        {/* History toggle */}
        <Button
          size="sm"
          variant={showHistory ? "secondary" : "outline"}
          onClick={() => setShowHistory(!showHistory)}
          className="gap-1"
          title="发送历史"
        >
          <History className="h-3.5 w-3.5" />
        </Button>

        {/* Hex mode toggle */}
        <Button
          size="sm"
          variant={sendSettings.hexMode ? "secondary" : "outline"}
          onClick={() => setSendSettings({ hexMode: !sendSettings.hexMode })}
          className="gap-1"
          title="十六进制发送模式"
        >
          <Binary className="h-3.5 w-3.5" />
          HEX
        </Button>

        {/* Input */}
        <div className="flex-1">
          <Input
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sendSettings.hexMode ? "输入十六进制 (如: 48 65 6C 6C 6F)" : "输入发送内容... Enter 发送"}
            disabled={!connected}
            className="h-8 text-sm font-mono"
          />
        </div>

        {/* Send button */}
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!connected || sending || (!inputText.trim() && !sendSettings.hexMode)}
          className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Send className="h-3.5 w-3.5" />
          发送
        </Button>
      </div>
    </div>
  );
}
