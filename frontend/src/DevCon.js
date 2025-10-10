import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

function DevCon() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef(null);
  const inputRef = useRef(null);

  // initial intro messages
  useEffect(() => {
    const intro = [
      "Initializing FaceTrack Developer Console...",
      "Loading modules...",
      "Connection established ✅",
      'Type "help" for available commands.',
    ];
    let i = 0;
    const interval = setInterval(() => {
      setLogs((prev) => [...prev, intro[i]]);
      i++;
      if (i >= intro.length) clearInterval(interval);
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // always focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // auto-scroll
  useEffect(() => {
    if (!outputRef.current) return;
    outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [logs]);

  const pushLog = (text) => setLogs((prev) => [...prev, text]);

  const handleCommand = (rawCmd) => {
    const cmd = String(rawCmd || "").trim();
    if (!cmd) {
      setLogs((prev) => [...prev, `$ ${cmd}`]); // show empty enter
      setInput("");
      setHistory((h) => [...h, cmd]);
      setHistoryIndex(-1);
      return;
    }

    // Save to history
    setHistory((h) => [...h, cmd]);
    setHistoryIndex(-1);

    // Echo command
    pushLog(`$ ${cmd}`);

    const lower = cmd.toLowerCase();

    // built-in commands
    if (lower === "help") {
      pushLog([
        "Available Commands:",
        "help   - Show commands",
        "info   - System info",
        "clear  - Clear console",
        "exit   - Return to Work Portal",
        "time   - Current date & time",
        "status - App system status",
      ].join("\n"));
    } else if (lower === "info") {
      pushLog(`FaceTrack Dev Console\nVersion: 1.0\nPlatform: ${navigator.platform}\nBrowser: ${navigator.userAgent}`);
    } else if (lower === "time") {
      pushLog(`Current Time: ${new Date().toLocaleString()}`);
    } else if (lower === "status") {
      pushLog("System OK ✅\nBackend Connected: true\nCamera: Ready");
    } else if (lower === "clear") {
      setLogs([]);
    } else if (lower === "exit") {
      navigate("/work-application-login");
    } else {
      // Unknown commands: allow some "pseudo commands"
      if (lower.startsWith("echo ")) {
        pushLog(cmd.slice(5));
      } else {
        pushLog(`Unknown command: ${cmd}`);
      }
    }

    setInput("");
  };

  // handle keyboard (history, ctrl+l, ctrl+c)
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommand(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (history.length === 0) return;
      if (historyIndex === -1) {
        setInput("");
        return;
      }
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(-1);
        setInput("");
      } else {
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex] ?? "");
      }
    } else if (e.ctrlKey && (e.key === "l" || e.key === "L")) {
      // Ctrl+L to clear
      e.preventDefault();
      setLogs([]);
      setInput("");
    } else if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
      // Ctrl+C - cancel current input
      e.preventDefault();
      setLogs((prev) => [...prev, `^C`]);
      setInput("");
    }
  };

  // small clickable "Exit" on top-left for convenience (still terminal-first)
  const handleExit = () => navigate("/work-application-login");

  return (
    <div
      className="fixed inset-0 bg-black text-green-400 font-mono text-sm leading-relaxed"
      onClick={() => inputRef.current?.focus()}
      role="application"
      aria-label="Developer console"
    >
      {/* top-left mini header / exit */}
      <div className="absolute top-2 left-3 flex items-center gap-3 z-40">
        <span className="text-xs text-green-300/80">FaceTrack DevCon</span>
        <button
          onClick={handleExit}
          className="px-2 py-1 text-xs bg-green-700/20 hover:bg-green-700/40 rounded text-green-200"
        >
          exit
        </button>
      </div>

{/* output area */}
<div
  ref={outputRef}
  className="absolute inset-x-0 top-10 bottom-12 p-4 overflow-y-auto whitespace-pre-wrap"
  style={{ WebkitOverflowScrolling: "touch" }}
>
  {logs.length === 0 ? (
    <div className="text-green-500/60">
      Console ready. Type "help" and press Enter.
    </div>
  ) : (
    logs.map((line, idx) => {
      const safeLine = typeof line === "string" ? line : String(line ?? "");
      return (
        <div key={idx} className="mb-1">
          {safeLine.split("\n").map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      );
    })
  )}
</div>

      {/* prompt + input - fixed at bottom */}
      <div className="absolute left-0 right-0 bottom-0 p-3 border-t border-green-700/10 bg-black/80">
        <div className="flex items-center gap-3">
          <div className="text-green-400 mr-2 select-none">$</div>

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            placeholder='type "help" and press Enter'
            className="flex-1 bg-transparent outline-none text-green-300 placeholder:text-green-700 caret-green-300"
            aria-label="Dev console input"
            spellCheck={false}
          />

          <button
            onClick={() => handleCommand(input)}
            className="ml-3 px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded text-black font-semibold"
            aria-label="Run command"
          >
            run
          </button>
        </div>

        <div className="mt-2 text-xs text-green-500/60">
          Tips: Up/Down = history • Ctrl+L = clear • Ctrl+C = cancel • type <code>help</code>
        </div>
      </div>
    </div>
  );
}

export default DevCon;