import { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  PauseCircleIcon,
  PlayIcon,
  StopIcon,
  KeyIcon,
  ClipboardDocumentListIcon,
  CameraIcon,
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
} from "@heroicons/react/24/solid";
import { useNavigate } from "react-router-dom";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { API_BASE } from "./config";
import FaceTracker from "./FaceTracker";
import { useEmbeddingsCache } from "./hooks/useEmbeddingsCache";
import { strictMatch } from "./hooks/cosineMatcher";

function Home() {
  // eslint-disable-next-line
  const [dateTime, setDateTime] = useState(new Date());
  const [showCamera, setShowCamera] = useState(false);
  const [statusMessages, setStatusMessages] = useState([]);
  const [backendConfirmed, setBackendConfirmed] = useState(false);
  const [action, setAction] = useState("checkin");
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  // Load all embeddings once (frontend cache)
  const { embeddings: frontendCache, loading: cacheLoading } = useEmbeddingsCache();
  //const [previewFaces, setPreviewFaces] = useState([]);
  const previewFacesRef = useRef([]);
  // eslint-disable-next-line


  

  const webcamRef = useRef(null);
  const navigate = useNavigate(); 

  // Live date/time
  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get camera list
  useEffect(() => {
    async function getCameras() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        setCameras(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error("Error fetching cameras:", err);
      }
    }
    getCameras();
  }, []);

  useEffect(() => {
  if (!cacheLoading) {
    console.log("✅ Frontend cache loaded:", frontendCache.length, "users");
    console.log(frontendCache); // See all cached users + embeddings
  }
}, [cacheLoading, frontendCache]);


// Handle backend response (wrapped in useCallback)
const handleBackendResponse = useCallback(
  (data, mode) => {
    // --- FRONTEND COSINE MATCHING (console only) ---
    if (!backendConfirmed && data.embedding && frontendCache.length > 0) {
      const match = strictMatch(data.embedding, frontendCache, 0.40);
      if (match.name !== "Unknown") {
        console.log(`⚡ Local match: ${match.name} (${(match.confidence * 100).toFixed(2)}%)`);
      } else {
        console.log("❌ Unknown face (frontend) — verifying with backend...");
      }
    }

    // --- Handle backend errors ---
    if (data.error) {
      console.warn("❌ Backend error:", data.error);
      setStatusMessages(["❌ Unknown face detected"]);
      return;
    }

    // --- Handle backend verified results ---
    if (data.results && Array.isArray(data.results)) {
      const mappedFaces = data.results.map((face) => ({
        name: face.name,
        status: face.status,
        confidence: face.confidence,
      }));

      // Update live preview faces (for cosine loop)
      if (mode === "preview") {
        previewFacesRef.current = data.results || [];
        return;
      }

      // --- Final backend confirmation phase ---
      if (mode === "mark" && mappedFaces.length > 0) {
        console.log("✅ Backend confirmed — switching off local cosine matching");
        setBackendConfirmed(true);

        const currentDateTime = new Date().toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });

        // Build new messages
        const newMsgs = mappedFaces.map((face) => {
          const name = face.name || "Unknown";
          const s = face.status;

          if (action === "work-application" && s === "logged_in") {
            navigate("/work-application", { state: { user: face.name } });
            return `✅ ${name} logged in to Work Application — ${currentDateTime}`;
          }
          if (s === "checked_in") return `✅ ${name} marked Present — ${currentDateTime}`;
          if (s === "already_checked_in") return `⚠️ ${name} already Checked In — ${currentDateTime}`;
          if (s === "checked_out") return `✅ ${name} Checked Out — ${currentDateTime}`;
          if (s === "already_checked_out") return `⚠️ ${name} already Checked Out — ${currentDateTime}`;
          if (s === "break_started") return `✅ ${name} started Break — ${currentDateTime}`;
          if (s === "already_on_break") return `⚠️ ${name} is already on Break — ${currentDateTime}`;
          if (s === "break_ended") return `✅ ${name} ended Break — ${currentDateTime}`;
          if (s === "already_break_ended") return `⚠️ ${name} already ended Break — ${currentDateTime}`;
          if (s === "break_not_started") return `⚠️ ${name} cannot end Break (not started) — ${currentDateTime}`;
          if (s === "checkin_missing") return `⚠️ ${name} cannot proceed → No Check-In found — ${currentDateTime}`;
          if (s === "cannot_checkout_on_break") return `⚠️ ${name} cannot Check Out while on Break — ${currentDateTime}`;
          if (s === "spoof") return `❌ Spoof attempt detected — ${currentDateTime}`;
          if (s === "unknown") return `❌ Unknown face detected — ${currentDateTime}`;
          return `ℹ️ ${name} action processed — ${currentDateTime}`;
        });

        // ✅ Merge messages (multi-person support) without duplicates
        setStatusMessages((prev) => {
          const combined = [...prev];
          newMsgs.forEach((msg) => {
            // Extract the name from the message (after emoji and before next space)
            const nameMatch = msg.match(/[✅⚠️❌ℹ️]\s(.+?)\s(marked|already|logged|started|ended|cannot|Check|action)/);
            const name = nameMatch ? nameMatch[1].trim() : null;

            // Replace old message for the same name, or add if new
            const existingIndex = combined.findIndex((m) => name && m.includes(name));
            if (existingIndex !== -1) {
              combined[existingIndex] = msg; // update
            } else {
              combined.push(msg); // add new person
            }
          });
          return combined;
        });

        // ✅ Clear messages after 3 seconds for attendance actions only
        if (["checkin", "checkout", "break"].includes(action)) {
          setTimeout(() => setStatusMessages([]), 3000);
        }
      }
    }
  },
  [action, navigate, backendConfirmed, frontendCache]
);


// Capture frame function wrapped in useCallback
const captureAndSendFrame = useCallback(
  async (mode = "preview", subAction = null) => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    const blob = await (await fetch(imageSrc)).blob();
    const formData = new FormData();
    formData.append("file", blob, "frame.jpg");

    // Use proper action mapping
    if (action === "work-application") {
      formData.append("action", "login");
    } else {
      formData.append("action", subAction || action);
    }

    try {
      const response = await fetch(`${API_BASE}/attendance/${mode}`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      // Backend rest mode — stop previewing temporarily
      if (mode === "preview" && data.stop_preview) {
        console.log(
          "Backend resting — all faces confirmed 3×, skipping further preview frames"
        );
        return; // Don't send more frames while backend is resting
      }

      // Normal response handling
      handleBackendResponse(data, mode);
    } catch (error) {
      console.error("Error sending frame:", error);
    }
  },
  [action, handleBackendResponse]
);

// Auto-preview when camera opens (throttled for performance)
useEffect(() => {
  let interval;
  let isProcessing = false;

  if (showCamera) {
    const sendFrame = async () => {
      if (!isProcessing) {
        isProcessing = true;
        await captureAndSendFrame("preview");
        isProcessing = false;
      }
    };

    // Send first frame immediately
    sendFrame();

    // Then repeat every 1200 ms
    interval = setInterval(sendFrame, 1200);
  }

  return () => clearInterval(interval);
}, [showCamera, action, captureAndSendFrame]);

// --- Frontend cosine similarity loop (instant recognition) ---
useEffect(() => {
  if (!showCamera || cacheLoading || frontendCache.length === 0) return;

  console.log("🧠 Starting frontend cosine loop...");
  let active = true;
  const intervalMs = 400; // adjust if you want smoother/faster (e.g., 250ms)

const runLocalCosine = () => {
  if (!active || backendConfirmed) return;

  const lastFace = previewFacesRef.current?.[0];
  if (lastFace?.embedding) {
    // Use strict default (0.46)
    const match = strictMatch(lastFace.embedding, frontendCache);
    if (match.name !== "Unknown") {
      console.log(`⚡ Frontend instant match: ${match.name} (${(match.confidence * 100).toFixed(2)}%)`);
    }
  }
};

  const cosineLoop = setInterval(runLocalCosine, intervalMs);

  return () => {
    active = false;
    clearInterval(cosineLoop);
    console.log("🧹 Stopped frontend cosine loop");
  };
}, [showCamera, backendConfirmed, cacheLoading, frontendCache]);

// =====================================================
// ⚡ Super-fast capture — supports multiple people simultaneously (fixed)
// =====================================================
const handleInstantCapture = async (subAction = null) => {
  if (!webcamRef.current) return;

  // ✅ Get all recognized faces — must return array of all current faces
  const allFaces =
    (webcamRef.current.getAllFaces && webcamRef.current.getAllFaces()) || [];
  
  // Fallback to single-face if necessary
  const faces =
    allFaces.length > 0
      ? allFaces
      : [webcamRef.current?.getCurrentFace()].filter(Boolean);

  console.log("📸 Sending faces to backend:", faces); // <— DEBUG LINE

  if (!faces || faces.length === 0) {
    setStatusMessages(["🔍 No face detected — please align properly."]);
    setTimeout(() => setStatusMessages([]), 1000);
    return;
  }

  // ✅ Build the payload with all faces in one go
  const payload = {
    faces: faces.map((f) => ({
      employee_id: f.name,
      action: subAction || action,
      confidence: f.confidence,
    })),
  };

  try {
    const res = await fetch(`${API_BASE}/attendance/mark-instant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("🧠 Backend response:", data);

    if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
      setStatusMessages(["⚠️ Unexpected response from server."]);
      setTimeout(() => setStatusMessages([]), 1000);
      return;
    }

    const currentDateTime = new Date().toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    // ✅ Build separate lines for every recognized person
    const msgs = data.results.map((face) => {
      const name = face.name || "Unknown";
      const s = face.status;
      if (s === "checked_in") return `✅ ${name} marked Present — ${currentDateTime}`;
      if (s === "already_checked_in") return `⚠️ ${name} already Checked In — ${currentDateTime}`;
      if (s === "checked_out") return `✅ ${name} Checked Out — ${currentDateTime}`;
      if (s === "already_checked_out") return `⚠️ ${name} already Checked Out — ${currentDateTime}`;
      if (s === "break_started") return `✅ ${name} started Break — ${currentDateTime}`;
      if (s === "already_on_break") return `⚠️ ${name} is already on Break — ${currentDateTime}`;
      if (s === "break_ended") return `✅ ${name} ended Break — ${currentDateTime}`;
      if (s === "already_break_ended") return `⚠️ ${name} already ended Break — ${currentDateTime}`;
      if (s === "checkin_missing") return `⚠️ ${name} cannot proceed → No Check-In found — ${currentDateTime}`;
      if (s === "cannot_checkout_on_break") return `⚠️ ${name} cannot Check Out while on Break — ${currentDateTime}`;
      if (s === "cannot_end_break_no_checkin") return `⚠️ ${name} cannot end Break (no Check-In found) — ${currentDateTime}`;
      if (s === "break_not_started") return `⚠️ ${name} cannot end Break (not started) — ${currentDateTime}`;
      if (s === "spoof") return `❌ Spoof attempt detected — ${currentDateTime}`;
      if (s === "unknown") return `❌ Unknown face detected — ${currentDateTime}`;
      return `ℹ️ ${name} action processed — ${currentDateTime}`;
    });

    // ✅ Show all lines together
    setStatusMessages(msgs);

    // ✅ Auto-clear
    if (["checkin", "checkout", "break"].includes(action)) {
      setTimeout(() => setStatusMessages([]), 3000);
    }

  } catch (err) {
    console.error("❌ Network error:", err);
    setStatusMessages(["❌ Network error — please retry."]);
    setTimeout(() => setStatusMessages([]), 1000);
  }
};

  return (
<div className="relative flex flex-col min-h-screen overflow-x-hidden bg-gradient-to-br from-cyan-100 via-sky-200 to-blue-300 text-gray-900">
  {/* Soft glow blobs for ambient light */}
  <div className="absolute -top-20 left-20 w-[600px] h-[600px] bg-cyan-300/20 blur-[200px] rounded-full"></div>
  <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-400/20 blur-[200px] rounded-full"></div>


  <header className="relative w-full bg-gradient-to-r from-slate-800 via-gray-800 to-slate-900 text-white shadow-xl overflow-hidden border-b border-gray-700/30">
  {/* Frosted overlay for glass effect */}
  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 backdrop-blur-md"></div>

  {/* Header Content */}
  <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between px-6 sm:px-10 lg:px-16 py-4 sm:py-5">
    
    {/* Left: Logo + Title */}
    <div
      onClick={() => navigate("/")}
      className="flex items-center gap-3 cursor-pointer transition-transform duration-300 hover:scale-105"
    >
      <img
        src={`${process.env.PUBLIC_URL}/favicon.png`}
        alt="FaceTrack Logo"
        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-md border border-white/20 bg-white/10 p-1 object-contain"
      />
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
        FaceTrack <span className="font-light text-gray-300 ml-1">Attendance</span>
      </h1>
    </div>

{/* Right: Date & Time + Admin Login */}
<div className="flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-4 mt-3 sm:mt-0">
  {/* Date & Time */}
  <div className="text-center text-sm sm:text-base md:text-lg font-semibold text-white tracking-wide drop-shadow-md order-2 sm:order-1">
    <HeaderDateTime />
  </div>

  {/* Admin Login Button */}
  <button
    onClick={() => navigate("/admin-login")}
    className="order-1 sm:order-2 px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 
               hover:from-indigo-600 hover:to-teal-500 text-white font-semibold shadow-lg hover:shadow-xl 
               transition-all duration-300 flex items-center gap-2"
  >
    <KeyIcon className="h-5 w-5" />
    Admin Login
  </button>
</div>
  </div>
</header>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center flex-grow">
        {!showCamera ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 sm:gap-y-10 w-full px-4 sm:px-12 md:px-24 lg:px-32 mt-6 sm:mt-0 mb-10 sm:mb-0 justify-items-center">
            {/* Check In */}
            <button
  onClick={() => {
    setAction("checkin");
    setShowCamera(true);
  }}
  className="relative w-[85%] md:w-[90%] lg:w-[70%] h-40 sm:h-48 bg-gradient-to-r from-green-700 via-emerald-600 to-teal-500 hover:from-green-400 hover:to-emerald-500 shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_35px_rgba(34,197,94,0.6)] hover:scale-105 active:scale-95 
             transition-transform duration-200 text-white text-4xl font-semibold 
             rounded-xl shadow-lg flex flex-col items-center justify-center overflow-hidden"
>
  {/* subtle diagonal stripes */}
  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-400 via-sky-400 to-teal-400"></div>
  <span className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0,rgba(255,255,255,0.08)_2px,transparent_2px,transparent_6px)]"></span>

  {/* actual content stays on top */}
  <span className="relative flex flex-col items-center justify-center">
    <CheckCircleIcon className="h-16 w-16 mb-4" />
    <span>Check In</span>
  </span>
</button>

{/* Break */}
<button
  onClick={() => {
    setAction("break");
    setShowCamera(true);
  }}
  className="relative w-[85%] md:w-[90%] lg:w-[70%] h-40 sm:h-48 bg-gradient-to-r from-yellow-700 via-amber-400 to-orange-300 hover:from-yellow-300 hover:to-amber-400 shadow-[0_0_20px_rgba(250,204,21,0.4)] hover:shadow-[0_0_35px_rgba(250,204,21,0.6)] hover:scale-105 active:scale-95 
             transition-transform duration-300 text-white text-4xl font-semibold rounded-xl flex flex-col items-center justify-center overflow-hidden">
  <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.1)_0,rgba(255,255,255,0.1)_2px,transparent_2px,transparent_6px)]"></div>
  <span className="relative flex flex-col items-center justify-center">
    <PauseCircleIcon className="h-16 w-16 mb-4" />
    <span>Break</span>
  </span>
</button>

{/* Check Out */}
<button
  onClick={() => {
    setAction("checkout");
    setShowCamera(true);
  }}
  className="relative w-[85%] md:w-[90%] lg:w-[70%] h-40 sm:h-48 bg-gradient-to-r from-red-700 via-rose-400 to-pink-300 hover:from-red-400 hover:to-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)] hover:shadow-[0_0_35px_rgba(244,63,94,0.6)] hover:scale-105 active:scale-95 
             transition-transform duration-300 text-white text-4xl font-semibold rounded-xl flex flex-col items-center justify-center overflow-hidden">
  <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0,rgba(255,255,255,0.08)_2px,transparent_2px,transparent_6px)]"></div>
  <span className="relative flex flex-col items-center justify-center">
    <ClockIcon className="h-16 w-16 mb-4" />
    <span>Check Out</span>
  </span>
</button>

{/* Work Application */}
<button
  onClick={() => navigate("/work-application-login")}
  className="relative w-[85%] md:w-[90%] lg:w-[70%] h-40 sm:h-48 bg-gradient-to-r from-indigo-500 via-purple-400 to-pink-400 hover:from-indigo-400 hover:to-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_35px_rgba(168,85,247,0.6)] hover:scale-105 active:scale-95 
             transition-transform duration-300 text-white text-4xl font-semibold rounded-xl flex flex-col items-center justify-center overflow-hidden">
  <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0,rgba(255,255,255,0.08)_2px,transparent_2px,transparent_6px)]"></div>
  <span className="relative flex flex-col items-center justify-center">
    <ClipboardDocumentListIcon className="h-16 w-16 mb-4" />
    <span>Work Application</span>
  </span>
</button>

          </div>
        ) : (
          <div className="flex flex-col items-center w-full gap-12 mt-4 sm:mt-6 md:mt-8 lg:mt-0">
            {/* Camera Selection Dropdown */}
            <div className="flex flex-col items-center mt-0 mb-0">
              <label className="text-xl font-semibold text-indigo-700 mb-2">
                Select Camera
              </label>
              <select
  value={selectedCamera || ""}
  onChange={(e) => setSelectedCamera(e.target.value)}
  className="px-3 py-2 border-2 border-indigo-400 rounded-lg shadow-md text-sm sm:text-base w-56 sm:w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500"
>
                {cameras.map((cam, idx) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col lg:flex-row w-full justify-center items-center lg:items-start gap-8 px-4 sm:px-8 mb-20 sm:mb-10 lg:mb-0">
              {/* Camera */}
              <div className="relative">
<div
  className="relative mx-auto flex items-center justify-center
             border border-white/10 rounded-2xl 
             shadow-[0_0_25px_rgba(56,189,248,0.3)] bg-white/10 backdrop-blur-xl 
             transition-all duration-300 hover:shadow-[0_0_35px_rgba(56,189,248,0.5)] 
             overflow-hidden"
  style={{
    width: /Android|iPhone|iPod/i.test(navigator.userAgent)
      ? "320px" // Square view for mobile
      : "580px", // Default desktop width
    height: /Android|iPhone|iPod/i.test(navigator.userAgent)
      ? "320px" // same height for perfect square
      : "355px", // landscape height
    margin: "0 auto", // centers the camera nicely
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }}
>
  <FaceTracker
    ref={webcamRef}
    selectedCamera={selectedCamera}
    facesRef={previewFacesRef}
    onDetectionsChange={(detections) =>
      console.log("Detected faces:", detections.length)
    }
  />
</div>
                {/* Buttons under Camera */}
                <div className="flex flex-wrap gap-3 sm:gap-4 mt-4 mb-4 justify-center px-2">
                  {action === "break" ? (
                    <>
                      <button
                        onClick={() => handleInstantCapture("break_start")}
                        className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 hover:scale-105 active:scale-95 
                                 transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center gap-2"
                      >
                        <PlayIcon className="h-5 w-5" />
                        Start Break
                      </button>
                      <button
                        onClick={() => handleInstantCapture("break_end")}
                        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 hover:scale-105 active:scale-95 
                                 transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center gap-2"
                      >
                        <StopIcon className="h-5 w-5" />
                        End Break
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleInstantCapture()}
                      className="px-6 py-3 bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95 
                               transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center gap-2"
                    >
                      <CameraIcon className="h-5 w-5" />
                      Capture
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowCamera(false);
                      setBackendConfirmed(false);
                    }}
                    className="px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 
                             transition-transform duration-200 text-white font-bold rounded-lg shadow"
                  >
                    Close Camera
                  </button>
                </div>
              </div>

              {/* Status Panel */}
              <div
className="w-full lg:w-[37%] bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_25px_rgba(99,102,241,0.3)] p-6 flex flex-col items-center transition-all duration-300 hover:shadow-[0_0_40px_rgba(99,102,241,0.5)]"  
style={{ minHeight: "355px" }}
>
                <h2 className="text-2xl font-bold text-indigo-700 mb-6 flex items-center gap-2">
                  {action === "checkin" ? (
                    <>
                      <ArrowDownCircleIcon className="h-6 w-6 text-indigo-700" />
                      Check In
                    </>
                  ) : action === "checkout" ? (
                    <>
                      <ArrowUpCircleIcon className="h-6 w-6 text-indigo-700" />
                      Check Out
                    </>
                  ) : action === "break" ? (
                    <>
                      <PauseCircleIcon className="h-6 w-6 text-indigo-700" />
                      Break
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentListIcon className="h-6 w-6 text-indigo-700" />
                      Work Application Login
                    </>
                  )}
                </h2>

{statusMessages.length > 0 ? (
  <div
    className="status-message-panel flex flex-col items-start space-y-2 text-left p-2 overflow-y-auto max-h-64 transition-all duration-500"
    style={{ whiteSpace: "pre-line", lineHeight: "1.6" }}
  >
    {statusMessages.map((msg, idx) => {
      // background color logic
      let bgColor = "bg-gray-200/90"; // default
      if (
        msg.includes("marked Present") ||
        msg.includes("started Break") ||
        msg.includes("ended Break")
      ) {
        bgColor = "bg-green-300/90";
      } else if (
        msg.includes("already Checked Out") ||
        msg.includes("already") ||
        msg.includes("cannot")
      ) {
        bgColor = "bg-yellow-300/90";
      } else if (
        msg.includes("Checked Out") ||
        msg.includes("spoof") ||
        msg.includes("Unknown") ||
        msg.includes("error")
      ) {
        bgColor = "bg-red-300/90";
      }

      return (
        <p
          key={idx}
          className={`text-base sm:text-lg font-semibold text-black rounded-md px-4 py-2 w-full shadow-md border border-black/10 ${bgColor}`}
        >
          {msg}
        </p>
      );
    })}
  </div>
) : (
  <p className="text-gray-600 flex items-center justify-center gap-2 italic">
    <ClipboardDocumentListIcon className="h-5 w-5 text-gray-600" />
    Capture to see status
  </p>
)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default Home;