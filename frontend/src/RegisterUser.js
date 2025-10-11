import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import {
  ArrowUturnLeftIcon,
  UserPlusIcon,
  IdentificationIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { API_BASE } from "./config";

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
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [alignmentMessage, setAlignmentMessage] = useState("");

  const [captureStage, setCaptureStage] = useState("front");
  // eslint-disable-next-line
  const [angleReady, setAngleReady] = useState(false);

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

// 🔄 Live guided registration (front → right → left)
useEffect(() => {
  let interval;
  if (isCameraActive && !isSubmitting) {
    interval = setInterval(async () => {
      if (!webcamRef.current) return;
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;

      const blob = await (await fetch(imageSrc)).blob();
      const formData = new FormData();
      formData.append("file", blob, "angle_check.jpg");

      try {
        const res = await fetch(`${API_BASE}/users/preview-angle`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.message) {
          setAlignmentMessage(data.message);

          // Track capture progression
          if (data.status === "front_captured") {
            setCaptureStage("right");
            setAngleReady(true);
          } else if (data.status === "right_captured") {
            setCaptureStage("left");
            setAngleReady(true);
          } else if (data.status === "left_captured") {
            setCaptureStage("done");
            setAngleReady(true);
          } else if (data.status === "done") {
            setCaptureStage("done");
            setAngleReady(true);
          } else {
            setAngleReady(false);
          }
        }
      } catch (err) {
        console.error("Angle check failed:", err);
      }
    }, 1000);
  }
  return () => clearInterval(interval);
}, [isCameraActive, isSubmitting]);


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

  // Step 1️⃣ — Activate camera & check alignment
  setIsCameraActive(true);
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

    // Alignment check
    const blob = await (await fetch(imageSrc)).blob();
    const alignForm = new FormData();
    alignForm.append("file", blob, "align_check.jpg");

    const alignResponse = await fetch(`${API_BASE}/users/preview-align`, {
      method: "POST",
      body: alignForm,
    });
    const alignData = await alignResponse.json();

    if (!alignResponse.ok || alignData.alignment !== "perfect") {
      setPopupMessage(
        `⚠️ ${alignData.message || "Face not properly aligned. Please try again."}`
      );
      setShowPopup(true);
      setIsSubmitting(false);
      setIsCameraActive(false);
      setAlignmentMessage("");
      return;
    }

    // ✅ Alignment successful
    setAlignmentMessage("✅ Perfect alignment! Starting capture...");
    setFrameCount(0);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("department", department);

    // Helper to capture N frames
    const captureFrames = async (count, phaseLabel, messageBefore, messageAfter) => {
      setAlignmentMessage(messageBefore);
      for (let i = 0; i < count; i++) {
        const imgSrc = webcamRef.current.getScreenshot();
        if (imgSrc) {
          const blob = await (await fetch(imgSrc)).blob();
          formData.append("files", blob, `${phaseLabel}_${i + 1}.jpg`);
          setFrameCount((prev) => prev + 1);
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      setAlignmentMessage(messageAfter);
      await new Promise((r) => setTimeout(r, 2000));
    };

    // FRONT (5)
    await captureFrames(5, "front", "🟢 Facing front — capturing...", "📸 Front captured! Please turn LEFT.");

    // LEFT (5)
    await captureFrames(5, "left", "↩️ Turn LEFT — capturing...", "✅ Left captured! Please turn RIGHT.");

    // RIGHT (5)
    await captureFrames(5, "right", "↪️ Turn RIGHT — capturing...", "✅ All angles captured! Registering...");

    // Step 3️⃣ — Send registration data
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
      setIsCameraActive(false);
      setAlignmentMessage("");
    } else {
      setRegisteredData({
        employee_id: data.employee_id,
        name: data.name || name,
        department: data.department || department,
      });
      setPopupMessage("✅ Registration successful!");
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
    setIsCameraActive(false);
    setAlignmentMessage("");
  }
};

  // Popup OK handler
  const handlePopupOk = () => {
    setShowPopup(false);
    if (popupMessage.includes("successfully")) {
      navigate("/admin-dashboard");
    } else {
      setIsSubmitting(false);
      setButtonText("Register");
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
    <div
      className={`relative rounded-lg shadow-lg border-4 ${
        isSubmitting ? "border-green-400 animate-pulse" : "border-indigo-500"
      } w-full max-w-[520px]`}
    >
      {devices.length > 0 && selectedDeviceId ? (
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          className="rounded-lg transform scale-x-[-1] w-full h-auto"
          playsInline
          mirrored
          videoConstraints={{
            width: 520,
            height: 380,
            deviceId: { exact: selectedDeviceId },
          }}
          onUserMediaError={(err) => console.error("❌ Webcam error:", err)}
        />
  
      ) : (
        <div className="w-full h-[300px] flex items-center justify-center bg-gray-200 rounded-lg">
          <p className="text-gray-600 text-center">No camera detected</p>
        </div>
      )}

      <div className="absolute top-2 right-2 text-sm sm:text-base text-white bg-black/60 px-3 py-1 rounded-lg shadow-lg border border-white/20">
  {captureStage === "front" && "🟢 Capturing Front..."}
  {captureStage === "right" && "↪️ Turn Right"}
  {captureStage === "left" && "↩️ Turn Left"}
  {captureStage === "done" && "✅ All Angles Captured"}
</div>
{/* 🧠 Camera overlays — scanning, progress, and live guidance */}
{isSubmitting ? (
  <>
    {/* Scanning Line */}
    <div className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-lg">
      <div className="w-full h-1 animate-scan glow-line"></div>
    </div>

    {/* Frame count during capture */}
    <div className="absolute bottom-3 w-full text-center text-white font-bold text-lg bg-black/50 py-1 rounded-lg">
      {frameCount < 10
        ? `📸 Capturing frame ${frameCount}/10`
        : "🧠 Processing registration..."}
    </div>
  </>
) : (
  // Show alignment / distance feedback when not submitting
  alignmentMessage && (
<div
  className={`absolute bottom-3 w-full text-center text-lg font-semibold py-2 rounded-lg ${
    alignmentMessage.includes("Perfect")
      ? "bg-green-600/60 text-white"
      : alignmentMessage.includes("Move")
      ? "bg-yellow-600/60 text-white"
      : "bg-red-600/60 text-white"
  }`}
>
  {alignmentMessage}
</div>
  )
)}
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
      disabled={isSubmitting}
      className={`w-72 sm:w-80 py-3 font-bold rounded-lg shadow transition-transform ${
        isSubmitting
          ? "bg-gray-400 text-white cursor-not-allowed"
          : "bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95 text-white"
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        <IdentificationIcon className="h-5 w-5 text-white" />
        <span>{isSubmitting ? buttonText : "Register"}</span>
      </div>
    </button>
  </div>
</div>

     {/* Advisory Box */}
<div className="mt-10 flex flex-col sm:flex-row items-center gap-4 bg-yellow-100 border-2 border-yellow-500 text-yellow-800 rounded-xl px-6 sm:px-8 py-4 shadow-lg w-[90%] sm:w-full max-w-6xl mx-auto">
  <ExclamationTriangleIcon className="h-12 w-12 text-yellow-600 flex-shrink-0 self-center sm:self-start" />
  <div className="flex flex-col text-left w-full text-center sm:text-left">
    <p className="text-base sm:text-lg font-semibold leading-snug">
      Please remove Masks, Hats, Glasses, and keep forehead clear — show your full face for accurate registration.
    </p>
    <p className="text-base sm:text-xl font-semibold text-gray-700 mt-1">
      帽子や眼鏡、マスクを外し、おでこを隠さず、顔全体をカメラに映してください。
    </p>
  </div>
</div>
      </div>

      {/* Popup */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div
            className={`p-8 rounded-2xl shadow-2xl text-center transform transition-all duration-300 scale-100 ${
              popupMessage.startsWith("✅")
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
              className={`px-6 py-2 font-bold rounded-lg shadow ${
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
      `}</style>
    </div>
  );
}

export default RegisterUser;