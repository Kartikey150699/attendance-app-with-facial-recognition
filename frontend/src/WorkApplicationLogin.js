import { useState, useEffect, useRef } from "react";
import {
  ClipboardDocumentListIcon,
  ArrowRightOnRectangleIcon,
  ArrowUturnLeftIcon,
} from "@heroicons/react/24/solid";
import { useNavigate } from "react-router-dom";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { API_BASE } from "./config";
import FaceTracker from "./FaceTracker";

function WorkApplicationLogin() {
  const [statusMessages, setStatusMessages] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [employeeId, setEmployeeId] = useState("");
  const webcamRef = useRef(null);
  const previewFacesRef = useRef([]);
  const navigate = useNavigate();

  // detect cameras
  useEffect(() => {
    async function getCameras() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setCameras(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    }
    getCameras();
  }, []);

// capture frame for recognition (Work Application auto-confirm)
// eslint-disable-next-line
const captureAndSendFrame = async () => {
  try {
    if (!webcamRef.current) {
      setStatusMessages(["⚠️ Camera not available"]);
      setTimeout(() => setStatusMessages([]), 1000);
      return;
    }

// Validation — check Employee ID before sending anything
const trimmedId = employeeId.trim();

// Check empty
if (!trimmedId) {
  setStatusMessages(["⚠️ Please enter Employee ID and try again"]);
  setTimeout(() => setStatusMessages([]), 1000);
  return;
}

// Check uppercase format
if (trimmedId !== trimmedId.toUpperCase()) {
  setStatusMessages(["❌ Employee ID must be in CAPITAL letters (e.g., IFNT032)"]);
  setTimeout(() => setStatusMessages([]), 2000);
  return;
}

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      console.log("⚠️ No frame captured yet");
      return;
    }

    const blob = await (await fetch(imageSrc)).blob();
    const formData = new FormData();
    formData.append("file", blob, "frame.jpg");
    formData.append("action", "work-application");
    formData.append("employee_id", employeeId.trim().toUpperCase());

    const response = await fetch(`${API_BASE}/attendance/mark`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const face = data.results[0];

      // Backend confirmed recognition
      if (face.embedding || (face.name && face.name !== "Unknown")) {
        console.log("✅ Backend confirmed recognition (WorkApp)");
      }

      // Handle result cases cleanly
      if (face.status === "invalid_employee_id") {
        setStatusMessages(["❌ Invalid Employee ID"]);
      } else if (face.status === "face_mismatch") {
        setStatusMessages([
          `❌ Face does not match Employee ID ${employeeId.trim()}`,
        ]);
      } else if (face.name && face.name !== "Unknown") {
        setStatusMessages([`✅ Welcome ${face.name}`]);
        localStorage.setItem("user", face.name);
        localStorage.setItem("employeeId", employeeId.trim());

        // Redirect after short delay
        setTimeout(() => navigate("/work-application"), 800);
      } else {
        setStatusMessages(["❌ Unknown face detected"]);
      }

      // Auto-clear message after 2 seconds
      setTimeout(() => setStatusMessages([]), 2000);
    } else if (data.error) {
      setStatusMessages(["❌ Recognition failed — backend error"]);
      setTimeout(() => setStatusMessages([]), 2000);
    }
  } catch (error) {
    console.error("Error sending frame:", error);
    setStatusMessages(["⚠️ Network or server error"]);
    setTimeout(() => setStatusMessages([]), 2000);
  }
};

// Live Preview Loop — shows names as soon as camera opens
useEffect(() => {
  let interval;
  let isProcessing = false;

  const sendPreviewFrame = async () => {
    if (!webcamRef.current) return;
    if (isProcessing) return;

    isProcessing = true;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      isProcessing = false;
      return;
    }

    try {
      const blob = await (await fetch(imageSrc)).blob();
      const formData = new FormData();
      formData.append("file", blob, "frame.jpg");
      formData.append("action", "work-application");

// ✅ Always send employee_id (even if blank)
const trimmedId = (employeeId || "").trim().toUpperCase();
formData.append("employee_id", trimmedId);
console.log("🧾 Sending employee_id to backend:", trimmedId || "(empty)");

      // ✅ Send preview frame to backend
      const res = await fetch(`${API_BASE}/attendance/preview`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      // ✅ Log full backend recognition result (for debugging)
      if (data && data.results && data.results.length > 0) {
        const face = data.results[0];
        console.log("🧠 Backend recognized:", face);
      } else {
        console.log("👀 No face recognized in this frame");
      }

      // Update FaceTracker with backend recognition results
      previewFacesRef.current = data.results || [];
    } catch (err) {
      console.error("Preview error:", err);
    }

    isProcessing = false;
  };

  // Send first frame immediately
  sendPreviewFrame();

  // Then send one every second
  interval = setInterval(sendPreviewFrame, 1000);

  // Cleanup
  return () => clearInterval(interval);
}, [selectedCamera, employeeId]);

// Instant Login
const handleInstantLogin = async () => {
  const trimmedId = employeeId.trim().toUpperCase();

    // Special shortcut for developers
  if (trimmedId === "DEVCON") {
    navigate("/devcon");
    return;
  }

  // Validate Employee ID
  if (!trimmedId) {
    setStatusMessages(["⚠️ Please enter your Employee ID"]);
    setTimeout(() => setStatusMessages([]), 1500);
    return;
  }

  // Validate Employee ID
  if (!trimmedId) {
    setStatusMessages(["⚠️ Please enter your Employee ID"]);
    setTimeout(() => setStatusMessages([]), 1500);
    return;
  }

  // Use recognized face from preview
  const instantFaces = previewFacesRef.current || [];
  if (instantFaces.length === 0) {
    setStatusMessages(["👀 No face detected. Please look at the camera."]);
    setTimeout(() => setStatusMessages([]), 1500);
    return;
  }

  const face = instantFaces[0];
  console.log("🔗 Using recognized face:", face);

  // Clear any previous messages instantly (prevents flicker)
  setStatusMessages([]);

  // Prepare request
  const payload = {
    action: "work-application",
    employee_id: trimmedId,
    face_name: face.name,
    confidence: face.confidence,
  };

  try {
    const res = await fetch(`${API_BASE}/attendance/mark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("🧠 Backend response:", data);

    const result = data.results?.[0];
    if (!result) {
      setStatusMessages(["❌ No response from backend"]);
      return;
    }

    // Smooth UI: clear any old text before updating
    setStatusMessages([]);

    if (result.status === "logged_in") {
      setStatusMessages([`✅ Welcome ${result.name} (${result.employee_id})`]);
      localStorage.setItem("employeeId", result.employee_id);
      localStorage.setItem("user", result.name);

      // Small delay for smooth UI transition
      setTimeout(() => navigate("/work-application"), 600);
    } else if (result.status === "face_mismatch") {
      setStatusMessages([`❌ Face does not match ID ${trimmedId}`]);
    } else if (result.status === "invalid_employee_id") {
      setStatusMessages(["❌ Invalid Employee ID"]);
    } else {
      setStatusMessages([`⚠️ ${result.status || "Login failed"}`]);
    }

    // Auto-clear message after 2s (except during redirect)
    if (result.status !== "logged_in") {
      setTimeout(() => setStatusMessages([]), 2000);
    }
  } catch (err) {
    console.error("🚨 Error verifying face:", err);
    setStatusMessages(["⚠️ Server error during verification"]);
    setTimeout(() => setStatusMessages([]), 2000);
  }
};

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
      {/* Midnight Glass Header */}
<header className="relative w-full bg-gradient-to-r from-slate-800 via-gray-800 to-slate-900 text-white shadow-xl overflow-hidden border-b border-gray-700/30 mb-10">
  {/* Frosted glass overlay */}
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
        FaceTrack <span className="font-light text-gray-300 ml-1">Work Portal</span>
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
  onClick={() => {
    navigate("/");  // go back to home
  }}
  className="order-1 sm:order-2 px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 via-pink-500 to-rose-500 
             hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl 
             transition-all duration-300 flex items-center gap-2"
>
  <ArrowUturnLeftIcon className="h-5 w-5" />
  Back
</button>
    </div>
  </div>
</header>

      {/* Camera + Input Section (wrapped in a form for Enter support) */}
<form
  onSubmit={(e) => e.preventDefault()} // disables Enter key
  className="flex flex-col items-center w-full gap-6 mt-10"
>
{/* Employee ID + Camera Selection Row */}
<div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between w-full max-w-6xl mx-auto mb-10 px-6 gap-8">

  {/* Center: Employee ID */}
  <div className="flex flex-col items-center sm:items-center text-center w-full sm:w-auto">
    <label className="text-lg sm:text-xl font-semibold text-indigo-700 mb-2">
      Enter Employee ID
    </label>
<input
  type="text"
  value={employeeId}
  onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
  placeholder="e.g., IFNT001"
  className="px-4 py-2 border-2 border-indigo-400 rounded-lg shadow-md text-base w-64 sm:w-72 
             text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
/>
  </div>

{/* Right: Camera Selection */}
<div className="flex flex-col items-center sm:items-end justify-center w-full sm:w-auto text-center sm:text-right">
  <label className="text-lg sm:text-xl font-semibold text-indigo-700 mb-2 text-center w-full">
    Select Camera
  </label>
  <div className="flex justify-center sm:justify-end w-full">
    <select
      value={selectedCamera || ""}
      onChange={(e) => {
        setSelectedCamera(e.target.value);
        localStorage.setItem("selectedCamera", e.target.value);
      }}
      className="px-4 py-2 border-2 border-indigo-400 rounded-lg shadow-md text-base w-64 sm:w-72 
                 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
    >
      {cameras.map((cam, idx) => (
        <option key={cam.deviceId} value={cam.deviceId}>
          {cam.label || `Camera ${idx + 1}`}
        </option>
      ))}
    </select>
  </div>
</div>
</div>

        <div className="flex flex-col lg:flex-row w-full justify-center items-center lg:items-start gap-8 px-4 sm:px-8">
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
  onDetectionsChange={(detections) => {
    console.log("Detected faces:", detections.length);
  }}
/>
</div>

  {/* Buttons under Camera */}
<div className="flex justify-center w-full mt-6 sm:mt-8 mb-4">
<button
  type="button"
  onClick={handleInstantLogin}
  className="px-8 py-3 sm:px-10 sm:py-3.5 bg-green-500 hover:bg-green-600 
             hover:scale-105 active:scale-95 transition-transform duration-200 
             text-white font-bold rounded-xl shadow-md flex items-center gap-2 
             text-lg sm:text-xl"
>
  <ArrowRightOnRectangleIcon className="h-6 w-6" />
  Login
</button>
</div>
</div>

          {/* Status Panel */}
<div
  className="w-full lg:w-[37%] bg-white border-[4px] sm:border-[6px] border-indigo-700 rounded-xl shadow-2xl 
              p-4 sm:p-6 flex flex-col items-center mt-6 lg:mt-0 mb-16 sm:mb-0"
style={{ minHeight: "355px" }}
>
            <h2 className="text-2xl font-bold text-indigo-700 mb-6 flex items-center gap-2">
              <ClipboardDocumentListIcon className="h-6 w-6 text-indigo-700" />
              Work Application Login
            </h2>

            {statusMessages.length > 0 ? (
              <div className="space-y-2 text-center">
                {statusMessages.map((msg, idx) => (
                  <p key={idx} className="text-lg font-semibold">
                    {msg}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 flex items-center justify-center gap-2">
                <ClipboardDocumentListIcon className="h-5 w-5 text-gray-500" />
                Enter ID & Press Login
              </p>
            )}
          </div>
        </div>
      </form>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default WorkApplicationLogin;