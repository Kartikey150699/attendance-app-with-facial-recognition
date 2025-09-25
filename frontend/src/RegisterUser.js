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

function RegisterUser() {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState(""); // <-- new state
  const [dateTime, setDateTime] = useState(new Date());
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [buttonText, setButtonText] = useState("Register");

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  const navigate = useNavigate();
  const webcamRef = useRef(null);

  const progressMessages = [
    "Initializing Registration...",
    "Calibrating Sensors...",
    "Encoding Biometric Data...",
    "Securing Identity...",
    "Finalizing Registration...",
  ];

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Button progress text
  useEffect(() => {
    if (!isSubmitting) return;
    let i = 0;
    setButtonText(progressMessages[0]);
    const interval = setInterval(() => {
      i = (i + 1) % progressMessages.length;
      setButtonText(progressMessages[i]);
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

  // Submit handler
  const handleSubmit = async () => {
    if (isSubmitting) return;
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

    setIsSubmitting(true);
    setFrameCount(0);

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("department", department); // <-- include department

      for (let i = 0; i < 10; i++) {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
          const blob = await (await fetch(imageSrc)).blob();
          formData.append("files", blob, `frame_${i}.jpg`);
          setFrameCount(i + 1);
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const response = await fetch("http://localhost:8000/users/register", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.detail) {
          setPopupMessage(`❌ ${data.detail}`);
        } else if (data.error) {
          setPopupMessage(`❌ ${data.error}`);
        } else {
          setPopupMessage("❌ Registration failed.");
        }
        setIsSubmitting(false);
      } else {
        setPopupMessage(
          `✅ ${data.message}\nYour Employee ID is ${data.employee_id}`
        );
      }

      setShowPopup(true);
      setName("");
      setDepartment("");
    } catch (error) {
      console.error("❌ Error registering user:", error);
      setPopupMessage("❌ Failed to register user.");
      setShowPopup(true);
      setIsSubmitting(false);
      setName("");
      setDepartment("");
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
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md relative">
        <div className="absolute left-10 text-blue-800 text-xl font-bold">
          <HeaderDateTime />
        </div>
        <h1
          onClick={() => {
            localStorage.removeItem("currentAdmin");
            navigate("/", { replace: true });
          }}
          className="text-5xl font-bold text-blue-900 cursor-pointer hover:text-blue-700 transition-colors"
        >
          FaceTrack Attendance
        </h1>
        <div className="absolute right-10 top-4 flex flex-col items-end">
          <button
            onClick={() => navigate("/admin-dashboard")}
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <ArrowUturnLeftIcon className="h-5 w-5 text-white" />
            <span>Back</span>
          </button>
          {/* Camera selection */}
          <div className="flex flex-col items-center mt-8">
            <label className="text-xl font-semibold text-indigo-700 mb-2">
              Select Camera
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value);
                localStorage.setItem("selectedCamera", e.target.value);
              }}
              className="px-4 py-2 border-2 border-indigo-400 rounded-lg shadow-md text-base w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {devices.map((device, idx) => (
                <option key={idx} value={device.deviceId}>
                  {device.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col items-center flex-grow py-4 mt-8">
        <h2 className="text-3xl font-bold text-indigo-700 mb-4 flex items-center justify-center gap-2">
          <UserPlusIcon className="h-8 w-8 text-indigo-700" />
          Register New User
        </h2>

        <div className="flex w-full max-w-6xl px-10 mt-10">
          {/* Camera */}
          <div className="relative flex flex-col justify-center items-center w-1/2">
            <div
              className={`relative rounded-lg shadow-lg border-4 ${
                isSubmitting
                  ? "border-green-400 animate-pulse"
                  : "border-indigo-500"
              }`}
            >
              {devices.length > 0 && selectedDeviceId ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  className="rounded-lg transform scale-x-[-1]"
                  playsInline
                  mirrored
                  videoConstraints={{
                    width: 520,
                    height: 380,
                    deviceId: { exact: selectedDeviceId },
                  }}
                  onUserMediaError={(err) =>
                    console.error("❌ Webcam error:", err)
                  }
                />
              ) : (
                <div className="w-[520px] h-[380px] flex items-center justify-center bg-gray-200 rounded-lg">
                  <p className="text-gray-600">No camera detected</p>
                </div>
              )}
              {isSubmitting && (
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-lg">
                  <div className="w-full h-1 animate-scan glow-line"></div>
                </div>
              )}
              {isSubmitting && (
                <div className="absolute bottom-2 w-full text-center text-white font-bold text-lg bg-black bg-opacity-40 py-1 rounded">
                  {frameCount < 10
                    ? `Capturing frame ${frameCount}/10`
                    : "Processing..."}
                </div>
              )}
            </div>
          </div>

          {/* Form */}
          <div className="flex flex-col items-center justify-center w-1/2">
            <input
              type="text"
              placeholder="Enter user's name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              className="w-80 px-4 py-2 mb-4 border rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-200"
            />
            <input
              type="text"
              placeholder="Enter department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={isSubmitting}
              className="w-80 px-4 py-2 mb-4 border rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-200"
            />
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`w-80 py-3 font-bold rounded-lg shadow transition-transform ${
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
        <div className="mt-6 flex items-center gap-4 bg-yellow-100 border-2 border-yellow-500 text-yellow-800 rounded-xl px-8 py-4 shadow-lg w-full max-w-6xl mx-auto">
          <ExclamationTriangleIcon className="h-12 w-12 text-yellow-600 flex-shrink-0" />
          <div className="flex flex-col text-left w-full">
            <p className="text-lg font-semibold">
              Please remove Masks, hats, glasses, and keep forehead clear — show your full face for accurate registration.
            </p>
            <p className="text-xl font-semibold text-gray-700">
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
            <p className="text-lg text-gray-800 mb-6 whitespace-pre-line">
              {popupMessage}
            </p>
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