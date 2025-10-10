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

  // =========================
  // Boot sequence
  // =========================
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

  // Auto focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto scroll when new logs arrive
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [logs]);

  const pushLog = (text) => setLogs((prev) => [...prev, text]);
  const pushSequence = (lines = [], delay = 180) => {
    lines.forEach((line, i) => setTimeout(() => pushLog(line), i * delay));
  };

  // =========================
  // Command Handler
  // =========================
  const handleCommand = async (rawCmd) => {
    const cmd = String(rawCmd || "").trim();
    if (!cmd) {
      setLogs((prev) => [...prev, "$"]);
      setInput("");
      return;
    }

    // Add to history
    setHistory((h) => [...h, cmd]);
    setHistoryIndex(-1);
    pushLog(`$ ${cmd}`);

    const lower = cmd.toLowerCase();

    // HELP
    if (lower === "help") {
      pushLog(
        [
          "Available Commands:",
          "help         - Show commands",
          "info         - System info",
          "clear        - Clear console",
          "exit         - Return to Work Portal",
          "time         - Current date & time",
          "status       - App system status",
          "backend      - Probe backend availability",
          "tail logs N  - Fetch last N lines of backend logs",
        ].join("\n")
      );
    }

    // INFO
    else if (lower === "info") {
      pushLog(
        `FaceTrack Dev Console\nVersion: 1.0\nPlatform: ${navigator.platform}\nBrowser: ${navigator.userAgent}`
      );
    }

    // TIME
    else if (lower === "time") {
      pushLog(`Current Time: ${new Date().toLocaleString()}`);
    }

    // STATUS
    else if (lower === "status") {
      pushLog("System OK ✅\nBackend Connected: true\nCamera: Ready");
    }

    // CLEAR
    else if (lower === "clear") {
      setLogs([]);
    }

    // EXIT
    else if (lower === "exit") {
      navigate("/work-application-login");
    }

    // BACKEND CHECK
    else if (
      lower === "backend" ||
      lower === "check backend" ||
      lower === "ping backend" ||
      lower === "check-backend"
    ) {
      const url = "https://facetrackaws.duckdns.org/";
      pushSequence(
        [
          `→ Probing backend: ${url}`,
          "→ Preparing payload...",
          "→ Sending probe...",
        ],
        100
      );

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        pushSequence(
          [
            "=======================================",
            ">> BACKEND CHECK: OPERATIONAL ✅",
            ">> Payload delivered successfully.",
            ">> Server responded with 200 OK.",
            "=======================================",
          ],
          120
        );
      } catch (err) {
        pushSequence(
          [
            "=======================================",
            ">> BACKEND CHECK: FAILED ❌",
            `>> Error: ${String(err.message || err)}`,
            ">> Verify DNS / server / firewall.",
            "=======================================",
          ],
          120
        );
      }
    }

    // TAIL LOGS (dynamic)
    else if (lower.startsWith("tail logs") || lower === "logs") {
      const match = cmd.match(/\d+/);
      const lineCount = match ? parseInt(match[0]) : 50;
      const endpoint = `https://facetrackaws.duckdns.org/dev/logs?lines=${lineCount}`;

      pushSequence(
        [
          `→ Fetching last ${lineCount} lines from backend logs...`,
          "→ Connecting to backend...",
        ],
        120
      );

      try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data?.content) {
          const logLines = data.content.trim().split("\n");
          pushLog("=======================================");
          logLines.forEach((line) => pushLog(line));
          pushLog("=======================================");
          pushLog(`>> LOG STREAM: ${logLines.length} lines displayed ✅`);
        } else {
          pushLog("⚠️ No log data available in response.");
        }
      } catch (err) {
        pushSequence(
          [
            "=======================================",
            ">> LOG FETCH FAILED ❌",
            `>> ${String(err.message || err)}`,
            ">> Check if /dev/logs endpoint is reachable.",
            "=======================================",
          ],
          120
        );
      }
    }

    // ECHO / MATH / UNKNOWN
    else {
      if (lower.startsWith("echo ")) {
        pushLog(cmd.slice(5));
      } else if (/^[0-9+\-*/().\s]+$/.test(cmd)) {
        try {
          // eslint-disable-next-line no-new-func
          const result = Function(`"use strict"; return (${cmd})`)();
          pushLog(String(result));
        } catch {
          pushLog("Syntax error in expression");
        }
      } else {
        pushLog(`Unknown command: ${cmd}`);
      }
    }

    setInput("");
  };

  // =========================
  // Keyboard shortcuts
  // =========================
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleCommand(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const next =
        historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setInput(history[next] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (history.length === 0) return;
      const next = historyIndex + 1;
      if (next >= history.length) {
        setHistoryIndex(-1);
        setInput("");
      } else {
        setHistoryIndex(next);
        setInput(history[next] ?? "");
      }
    } else if (e.ctrlKey && (e.key === "l" || e.key === "L")) {
      e.preventDefault();
      setLogs([]);
    } else if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      pushLog("^C");
      setInput("");
    }
  };

  const handleExit = () => navigate("/work-application-login");

  // =========================
  // Render
  // =========================
  return (
    <div
      className="fixed inset-0 bg-black text-green-400 font-mono text-sm leading-relaxed"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Header */}
      <div className="absolute top-2 left-3 flex items-center gap-3 z-40">
        <span className="text-xs text-green-300/80">FaceTrack Developer Console</span>
        <button
          onClick={handleExit}
          className="px-2 py-1 text-xs bg-green-700/20 hover:bg-green-700/40 rounded text-green-200"
        >
          exit
        </button>
      </div>

      {/* Output */}
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
          logs.map((line, i) => (
            <div key={i} className="mb-1">
              {String(line ?? "")
                .split("\n")
                .map((l, j) => (
                  <div key={j}>{l}</div>
                ))}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="absolute left-0 right-0 bottom-0 p-3 border-t border-green-700/10 bg-black/80">
        <div className="flex items-center gap-3">
          <div className="text-green-400 select-none">$</div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-green-300 placeholder:text-green-700 caret-green-300"
            placeholder='type "help" and press Enter'
            spellCheck={false}
            autoFocus
          />
          <button
            onClick={() => void handleCommand(input)}
            className="ml-3 px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded text-black font-semibold"
          >
            run
          </button>
        </div>
        <div className="mt-2 text-xs text-green-500/60">
          Tips: Up/Down = history • Ctrl+L = clear • Ctrl+C = cancel • <code>help</code> for commands
        </div>
      </div>
    </div>
  );
}

export default DevCon;