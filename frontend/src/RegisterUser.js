import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import {
  ArrowUturnLeftIcon,
  UserPlusIcon,
  IdentificationIcon,
  InformationCircleIcon,
  UserIcon,
  SunIcon,
  FaceSmileIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { API_BASE } from "./config";
import { getGlobalDetector } from "./hooks/globalDetector";

// Move progress messages outside so it's stable
const PROGRESS_MESSAGES = [
  "Initializing Registration...",
  "Calibrating Sensors...",
  "Encoding Biometric Data...",
  "Securing Identity...",
  "Finalizing Registration...",
];

function RegisterUser() {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [buttonText, setButtonText] = useState("Register");
  const [registeredData, setRegisteredData] = useState(null);

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const [alignmentMessage, setAlignmentMessage] = useState("");


  // For distance estimation + overlay
  const [distance, setDistance] = useState(null);

  // For Blaze Short Range frontend-only distance
  const detectorRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);

  const [distanceFeedback, setDistanceFeedback] = useState(""); // "Good", "Too Close", "Too Far"

  // Multi face restriction
  const [multiFaceDetected, setMultiFaceDetected] = useState(false);

  const isMobile = /Android|iPhone|iPod/i.test(navigator.userAgent);

  const intervalRef = useRef(null);
  const animationRef = useRef(null);

  // cancel registration for Too close/Too far
  const cancelCaptureRef = useRef(false);
  

  // eslint-disable-next-line

  // Button progress text
  useEffect(() => {
    if (!isSubmitting) return;
    let i = 0;
    setButtonText(PROGRESS_MESSAGES[0]);
    const interval = setInterval(() => {
      i = (i + 1) % PROGRESS_MESSAGES.length;
      setButtonText(PROGRESS_MESSAGES[i]);
    }, 1500);
    return () => clearInterval(interval);
  }, [isSubmitting]);

// Camera detection
useEffect(() => {
  async function fetchDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setDevices(videoDevices);

      if (videoDevices.length > 0) {
        const saved = localStorage.getItem("selectedCamera");
        if (saved && videoDevices.some((d) => d.deviceId === saved)) {
          setSelectedDeviceId(saved);
        } else {
          setSelectedDeviceId(videoDevices[0].deviceId);
          localStorage.setItem("selectedCamera", videoDevices[0].deviceId);
        }
      }
    } catch (err) {
      console.error("❌ Error fetching devices:", err);
    }
  }
  fetchDevices();
}, []);

// -------------------------------
// Initialize Blaze Short Range Detector (frontend only)
// -------------------------------
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      console.log("🟢 Loading Blaze Short Range...");
      const detector = await getGlobalDetector();
      if (!cancelled) detectorRef.current = detector;
      console.log("✅ Blaze Short Range Ready");
    } catch (err) {
      console.error("❌ Failed to init Blaze Short Range:", err);
    }
  })();
  return () => { cancelled = true; };
}, []);

// -------------------------------
// Real-time distance estimation + Face Box + Scan Line
// -------------------------------
useEffect(() => {
  if (!videoReady || !detectorRef.current) return;

  const video = webcamRef.current.video;
  const canvas = canvasRef.current;
  let cancelled = false;

  const estimateDistance = (boxWidth, videoWidth, fov = 60) => {
    const FACE_REAL_WIDTH_CM = 15.0;
    const f = (videoWidth / 2) / Math.tan((fov / 2) * Math.PI / 180);
    return (FACE_REAL_WIDTH_CM * f) / boxWidth;
  };

  let pulseTime = 0;
  let scanY = 0;
  let scanDirection = 1; // 1 = down, -1 = up

  const loop = async () => {
    if (cancelled || !video || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(loop);
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      animationRef.current = requestAnimationFrame(loop);
      return;
    }

    // ✅ Sync canvas size dynamically
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    try {
      const results = await detectorRef.current.detectForVideo(video, performance.now());
      const detections = results?.detections || [];

      // 🔍 Multi-face check
      setMultiFaceDetected(detections.length > 1);

      if (detections.length > 0) {
        const b = detections[0].boundingBox;
        let { originX, originY, width, height } = b;

        // Fix rectangular box issue on mobile (1:1 camera feeds)
if (/Android|iPhone|iPod/i.test(navigator.userAgent)) {
  const aspect = video.videoWidth / video.videoHeight;
  if (aspect < 1.3) { 
    // typical square-ish video (mobile)
    const scale = canvas.height / video.videoHeight;
    originY *= scale;
    height *= scale * 0.9; // slightly shrink vertically for proportion
    originX *= scale;
    width *= scale;
  }
}

        // Mirror box horizontally because webcam feed is mirrored
        const mirroredX = canvas.width - originX - width;

        const dist = estimateDistance(width, video.videoWidth);
        setDistance(dist.toFixed(1));

        // --- Distance feedback ---
let feedbackText = "";
let boxColor = "rgba(56,189,248,0.95)"; // default blue

// 📱 Detect if device is mobile
const isMobile = /Android|iPhone|iPod/i.test(navigator.userAgent);

// 📏 Set distance thresholds dynamically
const minDist = isMobile ? 18 : 27;
const maxDist = isMobile ? 28 : 42;

if (dist < minDist) {
  feedbackText = "Too Close";
  boxColor = "rgba(239,68,68,0.95)";
  if (isSubmitting) {
    cancelCaptureRef.current = true;
    resetRegistrationState();
    setPopupMessage(
      "⚠️ Registration cancelled — too close. Move slightly back."
    );
    setShowPopup(true);
  }
} else if (dist > maxDist) {
  feedbackText = "Too Far";
  boxColor = "rgba(239,68,68,0.95)";
  if (isSubmitting) {
    cancelCaptureRef.current = true;
    resetRegistrationState();
    setPopupMessage(
      "⚠️ Registration cancelled — too far. Move closer to the camera."
    );
    setShowPopup(true);
  }
} else {
  feedbackText = "Good";
  boxColor = "rgba(56,189,248,0.95)";
}

setDistanceFeedback(feedbackText);
        // --- Draw 4-corner box ---
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = boxColor;
        ctx.shadowBlur = 10;
        ctx.shadowColor = boxColor;

        const corner = Math.min(width, height) * 0.2;
        const drawCorner = (x1, y1, x2, y2) => {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        };

        // draw corners (mirrored)
        drawCorner(mirroredX, originY + corner, mirroredX, originY);
        drawCorner(mirroredX, originY, mirroredX + corner, originY);
        drawCorner(mirroredX + width - corner, originY, mirroredX + width, originY);
        drawCorner(mirroredX + width, originY, mirroredX + width, originY + corner);
        drawCorner(mirroredX + width, originY + height - corner, mirroredX + width, originY + height);
        drawCorner(mirroredX + width, originY + height, mirroredX + width - corner, originY + height);
        drawCorner(mirroredX + corner, originY + height, mirroredX, originY + height);
        drawCorner(mirroredX, originY + height, mirroredX, originY + height - corner);

// --- Text (Readable + Color-coded + Responsive) ---
ctx.shadowBlur = 0;

// Dynamic font sizing (works well on Mac / iPad / Desktop)
const fontSize = Math.max(16, Math.min(canvas.width / 28, 30));
ctx.font = `bold ${fontSize}px sans-serif`;
ctx.textBaseline = "bottom";

// --- Distance (always white) ---
ctx.fillStyle = "#ffffff";
ctx.shadowColor = "rgba(0,0,0,0.85)";
ctx.shadowBlur = 8;
ctx.textAlign = "left";
ctx.fillText(`${Math.round(dist)} cm`, mirroredX + 10, originY - 10);

// --- Feedback (green if good, red if too close/far) ---
const feedbackColor =
  feedbackText === "Too Close" || feedbackText === "Too Far"
    ? "rgba(255, 80, 80, 0.95)" // Red for warning
    : "rgba(34, 197, 94, 0.95)"; // Green for good

ctx.fillStyle = feedbackColor;
ctx.textAlign = "right";
ctx.fillText(feedbackText, mirroredX + width - 10, originY - 10);

// Clear glow
ctx.shadowBlur = 0;

        ctx.restore();

        // --- Scanning line (only during submission) ---
        if (isSubmitting) {
          scanY += scanDirection * 3;
          if (scanY > height || scanY < 0) scanDirection *= -1;
          ctx.save();
          ctx.beginPath();
          const gradient = ctx.createLinearGradient(0, originY + scanY, 0, originY + scanY + 5);
          gradient.addColorStop(0, "rgba(0,255,150,0)");
          gradient.addColorStop(0.5, "rgba(0,255,150,1)");
          gradient.addColorStop(1, "rgba(0,255,150,0)");
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 3;
          ctx.moveTo(mirroredX, originY + scanY);
          ctx.lineTo(mirroredX + width, originY + scanY);
          ctx.stroke();
          ctx.restore();
        }
      }

      // --- Center pulsing dot ---
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      pulseTime += 0.05;
      const pulse = 4 + Math.sin(pulseTime * 2) * 2;
      const glow = 8 + Math.sin(pulseTime * 2) * 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulse, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(34,197,94,0.95)";
      ctx.shadowBlur = glow;
      ctx.shadowColor = "rgba(34,197,94,0.8)";
      ctx.fill();
      ctx.shadowBlur = 0;

    } catch (err) {
      console.warn("⚠️ Detection error:", err);
    }

    animationRef.current = requestAnimationFrame(loop);
  };

  loop();

  return () => {
    cancelled = true;
    cancelAnimationFrame(animationRef.current);
  };
}, [videoReady, isSubmitting]);


// Submit handler
const handleSubmit = async () => {
  if (isSubmitting) return;

  // Basic form validation
  if (!name.trim()) {
    setPopupMessage("⚠️ Please enter name of the user!");
    setShowPopup(true);
    return;
  }
  if (!department.trim()) {
    setPopupMessage("⚠️ Please enter department of the user!");
    setShowPopup(true);
    return;
  }
  if (!webcamRef.current) {
    setPopupMessage("⚠️ Camera not available!");
    setShowPopup(true);
    return;
  }
// Restrict registration if face distance is not ideal
if (distanceFeedback === "Too Close") {
  setPopupMessage("⚠️ Distance too close — please move a bit farther from the camera.");
  setShowPopup(true);
  return;
}

if (distanceFeedback === "Too Far") {
  setPopupMessage("⚠️ Distance too far — please move slightly closer to the camera.");
  setShowPopup(true);
  return;
}

  // Activate camera & check alignment
  setIsSubmitting(true);
  setAlignmentMessage("🔍 Checking face alignment... Please stay still.");

  try {
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setPopupMessage("⚠️ Could not capture image for alignment check.");
      setShowPopup(true);
      setIsSubmitting(false);
      return;
    }

   // Alignment handled on frontend now
setAlignmentMessage("✅ Alignment looks good! Starting capture...");
    setFrameCount(0);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("department", department);

// Helper to capture N frames silently (no left/right messages)
const captureFrames = async (count, phaseLabel) => {
  cancelCaptureRef.current = false; // reset before start

  for (let i = 0; i < count; i++) {
    if (cancelCaptureRef.current) {
      console.warn("🚫 Capture aborted mid-registration");
      return false; // stop immediately
    }

    const imgSrc = webcamRef.current.getScreenshot();
    if (imgSrc) {
      const blob = await (await fetch(imgSrc)).blob();
      formData.append("files", blob, `${phaseLabel}_${i + 1}.jpg`);
      setFrameCount((prev) => prev + 1);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  return true; // success
};

const completed = await captureFrames(15, "front");
if (!completed) {
  console.log("🚫 Registration cancelled — not sending data to backend");
  setIsSubmitting(false);
  setAlignmentMessage("");
  return; // stop here — backend never called
}

setAlignmentMessage("📸 Capturing complete — registering...");

    // Send registration data
    const response = await fetch(`${API_BASE}/users/register`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.detail) setPopupMessage(`❌ ${data.detail}`);
      else if (data.error) setPopupMessage(`❌ ${data.error}`);
      else setPopupMessage("❌ Registration failed.");
      setIsSubmitting(false);
      setAlignmentMessage("");
    } else {
      setRegisteredData({
        employee_id: data.employee_id,
        name: data.name || name,
        department: data.department || department,
      });
      setPopupMessage("✅ User registered successfully!");
    }

    setShowPopup(true);
    setName("");
    setDepartment("");
  } catch (error) {
    console.error("❌ Error registering user:", error);
    setPopupMessage("❌ Failed to register user.");
    setShowPopup(true);
  } finally {
    setIsSubmitting(false);
    setAlignmentMessage("");
  }
};

  // Popup OK handler
const handlePopupOk = () => {
  // Close popup immediately
  setShowPopup(false);

  // Fully reset registration states
  setIsSubmitting(false);
  setAlignmentMessage("");
  setButtonText("Register");

  // If success, navigate
  if (popupMessage.startsWith("✅")) {
    navigate("/admin-dashboard");
  }
};

// Helper: Reset all states safely when registration is cancelled or reset
const resetRegistrationState = () => {
  setIsSubmitting(false);
  setAlignmentMessage("");
  setFrameCount(0);
  setDistance(null);
  setDistanceFeedback("");
  setMultiFaceDetected(false);
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
  if (animationRef.current) {
    cancelAnimationFrame(animationRef.current);
  }
};

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
      {/* Midnight Glass Header */}
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

    {/* Right: Date & Time + Back Button */}
    <div className="flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-4 mt-3 sm:mt-0">
      {/* Date & Time */}
      <div className="text-center text-sm sm:text-base md:text-lg font-semibold text-white tracking-wide drop-shadow-md order-2 sm:order-1">
        <HeaderDateTime />
      </div>

      {/* Back Button */}
      <button
        onClick={() => navigate("/admin-dashboard")}
        className="order-1 sm:order-2 px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 
                   hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl 
                   transition-all duration-300 flex items-center gap-2"
      >
        <ArrowUturnLeftIcon className="h-5 w-5" />
        Back
      </button>
    </div>
  </div>
</header>

      {/* Body */}
      <div className="flex flex-col items-center flex-grow py-4 mt-8">
{/* Title Row with Centered Title + Responsive Camera Selection */}
<div className="relative flex flex-col lg:flex-row items-center justify-center w-full mb-6 px-4">
  {/* Centered Title */}
  <h2 className="text-3xl font-bold text-indigo-700 flex items-center justify-center gap-2 text-center mb-4 lg:mb-0">
    <UserPlusIcon className="h-8 w-8 text-indigo-700" />
    Register New User
  </h2>

  {/* Camera Selection */}
  <div
    className="
      flex flex-col items-center 
      lg:absolute lg:right-6 
      text-center lg:text-right 
      relative z-[50]
    "
  >
    <label className="text-lg lg:text-xl font-semibold text-indigo-700 mb-1 text-center lg:text-right">
      Select Camera
    </label>

    <div className="relative inline-block w-56 sm:w-64">
      <select
        value={selectedDeviceId}
        onChange={(e) => {
          setSelectedDeviceId(e.target.value);
          localStorage.setItem('selectedCamera', e.target.value);
        }}
        className="appearance-none px-4 py-2 border-2 border-indigo-400 rounded-lg shadow-md text-sm w-full text-center bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        style={{
          WebkitAppearance: 'menulist-button',
          position: 'relative',
          zIndex: 60,
        }}
      >
        {devices.map((device, idx) => (
          <option key={idx} value={device.deviceId}>
            {device.label || `Camera ${idx + 1}`}
          </option>
        ))}
      </select>

      {/* Custom dropdown arrow */}
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-600"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
</div>

{/* Camera + Form Section — Responsive */}
<div className="flex flex-col lg:flex-row w-full max-w-6xl px-6 sm:px-10 mt-10 gap-10">

  {/* Camera Section */}
  <div className="relative flex flex-col justify-center items-center w-full lg:w-1/2">
    <div className="relative flex flex-col justify-center items-center w-full">
      <div
        className={`relative mx-auto flex items-center justify-center 
                    border-4 rounded-2xl shadow-xl 
                    ${isSubmitting ? "border-green-400 animate-pulse" : "border-indigo-500"} 
                    bg-white/10 backdrop-blur-xl 
                    transition-all duration-300 hover:shadow-[0_0_35px_rgba(56,189,248,0.4)] 
                    overflow-hidden`}
        style={{
          width: /Android|iPhone|iPod/i.test(navigator.userAgent)
            ? "320px"   // mobile size
            : "580px",  // desktop/mac size (same as Home)
          height: /Android|iPhone|iPod/i.test(navigator.userAgent)
            ? "320px"   // square mobile frame
            : "355px",  // 4:3 desktop aspect
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {devices.length > 0 && selectedDeviceId ? (
          <>
            {/* Webcam + Canvas */}
            <div className="relative w-full h-full">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                className="absolute inset-0 w-full h-full object-cover rounded-xl transform scale-x-[-1] bg-black"
                playsInline
                mirrored
                onUserMedia={() => setVideoReady(true)}
                videoConstraints={{
                  width: 1280,
                  height: 720,
                  deviceId: { exact: selectedDeviceId },
                }}
                onUserMediaError={(err) =>
                  console.error("❌ Webcam error:", err)
                }
              />

              {/* Blaze Short Range overlay */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none w-full h-full"
              />

              {/* === Alignment + Grid Overlays === */}

{/* Center Target Ring (alignment guide) */}
<div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5]">
  <div
    className={`aspect-square rounded-full border-2 border-white/40 shadow-[0_0_25px_rgba(255,255,255,0.2)] animate-pulse ${
      /Android|iPhone|iPod/i.test(navigator.userAgent)
        ? "w-[80%]" // larger for phones
        : "w-[60%]" // normal for desktop/iPad
    }`}
  ></div>
</div>

              {/* Animated Grid Overlay (face-scan look) */}
              <div className="absolute inset-0 pointer-events-none 
                              bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),
                                  linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)]
                              bg-[size:40px_40px] animate-[gridPulse_3s_ease-in-out_infinite] 
                              rounded-xl z-[4]"></div>

              {/* Distance Display */}
              {distance && (
                <div className="absolute top-3 left-3 bg-black/60 text-white text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-md shadow-md border border-white/20">
                  Distance: {distance} cm
                </div>
              )}

              {/* Multi-face Warning */}
              {multiFaceDetected && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <div className="bg-white/90 text-red-600 text-sm sm:text-lg font-semibold px-4 sm:px-6 py-3 rounded-xl shadow-lg border border-red-400 backdrop-blur-md animate-pulse text-center leading-snug">
                    ⚠️ Multiple faces detected
                    <br />
                    Only one person should be visible
                  </div>
                </div>
              )}

              {/* Frame Counter or Alignment Message */}
              {isSubmitting ? (
                <div className="absolute bottom-3 w-full text-center text-white font-bold text-sm sm:text-lg bg-black/50 py-1 rounded-lg z-10">
                  {frameCount < 15
                    ? `📸 Capturing frame ${frameCount}/15`
                    : "🧠 Processing registration..."}
                </div>
              ) : (
                alignmentMessage && (
                  <div
                    className={`absolute bottom-3 w-full text-center text-sm sm:text-lg font-semibold py-2 rounded-lg z-10 ${
                      alignmentMessage.includes("Perfect")
                        ? "bg-green-600/70 text-white"
                        : alignmentMessage.includes("Move")
                        ? "bg-yellow-600/70 text-white"
                        : "bg-red-600/70 text-white"
                    }`}
                  >
                    {alignmentMessage}
                  </div>
                )
              )}
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 rounded-lg">
            <p className="text-gray-600 text-center">No camera detected</p>
          </div>
        )}
      </div>
    </div>
  </div>

  {/* Form Section */}
  <div className="flex flex-col items-center justify-center w-full lg:w-1/2 mt-8 lg:mt-0 space-y-4">
    <input
      type="text"
      placeholder="Enter user's name"
      value={name}
      onChange={(e) => setName(e.target.value)}
      disabled={isSubmitting}
      className="w-72 sm:w-80 px-4 py-2 border rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-200"
    />
    <input
      type="text"
      placeholder="Enter department"
      value={department}
      onChange={(e) => setDepartment(e.target.value)}
      disabled={isSubmitting}
      className="w-72 sm:w-80 px-4 py-2 border rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-200"
    />
<button
  onClick={handleSubmit}
  disabled={
    isSubmitting ||
    distanceFeedback === "Too Close" ||
    distanceFeedback === "Too Far" ||
    multiFaceDetected
  }
  className={`w-72 sm:w-80 py-3 font-bold rounded-lg shadow transition-transform ${
    isSubmitting
      ? "bg-gray-400 text-white cursor-not-allowed"
      : multiFaceDetected
      ? "bg-red-500 text-white cursor-not-allowed"
      : distanceFeedback === "Too Close" || distanceFeedback === "Too Far"
      ? "bg-orange-500 text-white cursor-not-allowed"
      : "bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95 text-white"
  }`}
>
  <div className="flex items-center justify-center gap-2">
    <IdentificationIcon className="h-5 w-5 text-white" />
    <span>
      {multiFaceDetected
        ? "🚫 Only 1 Face Allowed"
        : distanceFeedback === "Too Close"
        ? "Too Close"
        : distanceFeedback === "Too Far"
        ? "Too Far"
        : isSubmitting
        ? buttonText
        : "Register"}
    </span>
  </div>
</button>
  </div>
</div>

{/* Registration Guidance — Compact & Always Visible */}
<div className="mt-6 w-[90%] sm:w-full max-w-5xl mx-auto bg-yellow-50 border border-yellow-400 rounded-xl shadow-md px-5 sm:px-8 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-yellow-800">
  
  {/* Left: English guide */}
  <div className="flex-1 text-sm sm:text-base leading-snug">
    <h3 className="font-bold text-yellow-700 mb-2 flex items-center gap-2">
      <InformationCircleIcon className="h-5 w-5 text-yellow-600" />
      Registration Guidelines
    </h3>
    <ul className="space-y-1">
      <li className="flex items-center gap-2">
        <AdjustmentsHorizontalIcon className="h-4 w-4 text-green-600" />
        <span>Keep your <strong>nose on the green dot</strong> for proper alignment</span>
      </li>
      <li className="flex items-center gap-2">
        <FaceSmileIcon className="h-4 w-4 text-indigo-600" />
        <span>Keep your face between{" "}<strong>{isMobile ? "20–25 cm" : "30–40 cm"}</strong> from the camera</span>
      </li>
      <li className="flex items-center gap-2">
        <UserIcon className="h-4 w-4 text-pink-600" />
        <span>Only <strong>one face</strong> should be visible</span>
      </li>
      <li className="flex items-center gap-2">
        <SunIcon className="h-4 w-4 text-yellow-500" />
        <span>Ensure good lighting and clear visibility</span>
      </li>
      <li className="flex items-center gap-2">
        <FaceSmileIcon className="h-4 w-4 text-blue-600" />
        <span>Remove hats, glasses, and masks</span>
      </li>
    </ul>
  </div>

  {/* Divider */}
  <div className="hidden sm:block w-px h-20 bg-yellow-400 mx-6 opacity-50"></div>

  {/* Right: Japanese guide */}
  <div className="flex-1 text-sm sm:text-base leading-snug mt-3 sm:mt-0">
    <h3 className="font-bold text-yellow-700 mb-2 flex items-center gap-2">
      <InformationCircleIcon className="h-5 w-5 text-yellow-600" />
      登録ガイドライン
    </h3>
    <ul className="space-y-1">
      <li className="flex items-center gap-2">
        <AdjustmentsHorizontalIcon className="h-4 w-4 text-green-600" />
        <span>緑の点に<strong>鼻を合わせて</strong>位置を調整してください</span>
      </li>
      <li className="flex items-center gap-2">
        <FaceSmileIcon className="h-4 w-4 text-indigo-600" />
        <span>カメラから<strong>{isMobile ? "20〜30 cm" : "30〜40 cm"}</strong>の距離を保つ</span>
      </li>
      <li className="flex items-center gap-2">
        <UserIcon className="h-4 w-4 text-pink-600" />
        <span>登録時は<strong>1人だけ</strong>が映るようにする</span>
      </li>
      <li className="flex items-center gap-2">
        <SunIcon className="h-4 w-4 text-yellow-500" />
        <span>明るい環境で顔全体をはっきり映す</span>
      </li>
      <li className="flex items-center gap-2">
        <FaceSmileIcon className="h-4 w-4 text-blue-600" />
        <span>帽子・眼鏡・マスクを外す</span>
      </li>
    </ul>
  </div>
</div>
      </div>

      {/* Popup */}
{showPopup && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4 overflow-y-auto">
    <div
      className={`w-full max-w-md sm:max-w-lg md:max-w-xl 
        p-6 sm:p-8 rounded-2xl shadow-2xl text-center transform transition-all duration-300 scale-100
        ${popupMessage.startsWith("✅")
          ? "bg-green-50 border-2 border-green-400"
          : "bg-red-50 border-2 border-red-400"
        }`}
    >
            <h2
              className={`text-2xl font-extrabold mb-4 ${
                popupMessage.startsWith("✅") ? "text-green-700" : "text-red-700"
              }`}
            >
              {popupMessage.startsWith("✅")
                ? "Registration Successful!"
                : "Error"}
            </h2>

            {/* Successful registration Details */}
            {popupMessage.startsWith("✅") && registeredData ? (
              <div className="bg-white rounded-lg shadow-md p-4 mb-6 text-left">
                <p className="text-gray-800 text-lg">
                  <span className="font-bold">Employee ID:</span>{" "}
                  {registeredData.employee_id}
                </p>
                <p className="text-gray-800 text-lg">
                  <span className="font-bold">Name:</span> {registeredData.name}
                </p>
                <p className="text-gray-800 text-lg">
                  <span className="font-bold">Department:</span>{" "}
                  {registeredData.department}
                </p>
              </div>
            ) : (
              <p className="text-lg text-gray-800 mb-6 whitespace-pre-line">
                {popupMessage}
              </p>
            )}

<button
  onClick={handlePopupOk}
  className={`px-6 py-2 font-bold rounded-lg shadow transition-all duration-200 active:scale-95 ${
    popupMessage.startsWith("✅")
      ? "bg-green-600 text-white hover:bg-green-700"
      : "bg-red-600 text-white hover:bg-red-700"
  }`}
>
  OK
</button>
          </div>
        </div>
      )}

      <Footer />

      {/* Animations */}
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(350px); }
          100% { transform: translateY(0); }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
        .glow-line {
          background: linear-gradient(90deg, transparent, #00ff99, transparent);
          box-shadow: 0 0 10px #00ff99, 0 0 20px #00ff99;
          height: 3px;
        }
          /* Prevent any inherited animation or opacity flicker inside the webcam feed */
.webcam-feed {
  animation: none !important;
  opacity: 1 !important;
  filter: brightness(1) !important;
  transition: none !important;
  will-change: auto !important;
  background-color: black;
}
  @keyframes gridPulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.65; }
}
      `}</style>
    </div>
  );
}

export default RegisterUser;