import { useState, useEffect, useRef } from "react";
import {
  ClipboardDocumentListIcon,
  ArrowRightOnRectangleIcon,
  ArrowUturnLeftIcon,
} from "@heroicons/react/24/solid";
import Webcam from "react-webcam";
import { useNavigate } from "react-router-dom";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { API_BASE } from "./config";

function WorkApplicationLogin() {
  const videoWidth = 580;
  const videoHeight = 323;
  const [faces, setFaces] = useState([]);
  const [statusMessages, setStatusMessages] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [employeeId, setEmployeeId] = useState("");

  const webcamRef = useRef(null);
  const navigate = useNavigate();

  const [displayWidth, setDisplayWidth] = useState(videoWidth);

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

  // live preview loop
  useEffect(() => {
    let interval;
    if (selectedCamera) {
      interval = setInterval(() => capturePreviewFrame(), 1500);
    }
    return () => clearInterval(interval);
  }, [selectedCamera]);

  // capture frame for preview (face boxes only)
  const capturePreviewFrame = async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    const blob = await (await fetch(imageSrc)).blob();
    const formData = new FormData();
    formData.append("file", blob, "frame.jpg");

    try {
      const response = await fetch(`${API_BASE}/attendance/preview`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.results) {
        setFaces(
          data.results.map((f) => ({
            name: f.name,
            status: f.status,
            box: f.box,
            gender: f.gender || "Unknown",
            age: f.age || "N/A"
          }))
        );
      }
    } catch (err) {
      console.error("Preview error:", err);
    }
  };

  // capture frame for login (face + employee ID)
  const captureAndSendFrame = async () => {
    if (!webcamRef.current || !employeeId) {
      setStatusMessages(["⚠️ Please enter Employee ID and try again"]);
      return;
    }

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    const blob = await (await fetch(imageSrc)).blob();
    const formData = new FormData();
    formData.append("file", blob, "frame.jpg");
    formData.append("action", "work-application-login");
    formData.append("employee_id", employeeId);

    try {
      const response = await fetch(`${API_BASE}/attendance/mark`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const face = data.results[0];

        if (face.status === "logged_in") {
          setStatusMessages([`✅ Welcome ${face.name}`]);

          // Persist user in localStorage
          localStorage.setItem("user", face.name);
          localStorage.setItem("employeeId", employeeId);

          setTimeout(() => {
            navigate("/work-application");
          }, 500);
        } else if (face.status === "invalid_employee_id") {
          setStatusMessages([`❌ Invalid Employee ID`]);
        } else if (face.status === "face_mismatch") {
          setStatusMessages([`❌ Face does not match to Employee ID ${employeeId}`]);
        } else {
          setStatusMessages([`⚠️ ${face.name}: ${face.status}`]);
        }
      }
    } catch (error) {
      console.error("Error sending frame:", error);
    }
  };

  // decide box color
  const getBoxColor = (status) => {
    if (status === "logged_in") return "border-green-500";
    if (status === "preview") return "border-green-500";
    if (status === "login_failed") return "border-red-600";
    if (status === "face_mismatch") return "border-red-600";
    if (status === "invalid_employee_id") return "border-red-600";
    if (status === "unknown") return "border-red-600";
    return "border-yellow-400";
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
        onClick={() => navigate("/")}
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
        onSubmit={(e) => {
          e.preventDefault();
          captureAndSendFrame();
        }}
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
      onChange={(e) => setEmployeeId(e.target.value)}
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
{/* Camera Section */}
<div className="relative w-full sm:w-[580px] max-w-[580px] flex flex-col items-center">
  <div
    ref={(el) => {
      if (el) setDisplayWidth(el.offsetWidth);
    }}
    className="relative border-[4px] sm:border-[6px] border-blue-800 rounded-lg shadow-2xl inline-block max-w-full"
    style={{
      width: "100%",
      maxWidth: "580px",
      height: window.innerWidth >= 1024 ? "355px" : "auto",
    }}
  >
    <Webcam
      key={selectedCamera}
      audio={false}
      ref={webcamRef}
      screenshotFormat="image/jpeg"
      className="w-full h-full object-cover transform scale-x-[-1] rounded-lg"
      videoConstraints={{
        width: videoWidth,
        height: videoHeight,
        deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
      }}
    />

    {/* Face Boxes inside the same container */}
    {faces.map((face, index) => {
      return (
        <div
          key={index}
          className={`absolute border-4 ${getBoxColor(
            face.status
          )} rounded-lg transition-all duration-200 ease-linear`}
          style={{
            top: `${face.box[1]}px`,
            left: `${displayWidth - face.box[0] - face.box[2]}px`,
            width: `${face.box[2]}px`,
            height: `${face.box[3]}px`,
          }}
        >
          {/* Label below box */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-center">
            <span className="bg-black text-white px-2 py-1 rounded-b-lg font-bold whitespace-nowrap shadow">
              {face.status === "spoof"
                ? "Photo Detected – Not Allowed"
                : face.name}
            </span>
          </div>
        </div>
      );
    })}
  </div>

  {/* Buttons under Camera */}
  <div className="flex justify-center mt-6 sm:mt-8 mb-4">
    <button
      type="submit"
      className="px-6 sm:px-8 py-3 sm:py-3.5 bg-green-500 hover:bg-green-600 
                 hover:scale-105 active:scale-95 transition-transform duration-200 
                 text-white font-bold rounded-lg shadow-md flex items-center gap-2 text-base sm:text-lg"
    >
      <ArrowRightOnRectangleIcon className="h-5 w-5 sm:h-6 sm:w-6" />
      Login
    </button>
  </div>
</div>

          {/* Status Panel */}
<div
  className="w-full lg:w-[37%] bg-white border-[4px] sm:border-[6px] border-indigo-700 rounded-xl shadow-2xl 
              p-4 sm:p-6 flex flex-col items-center mt-6 lg:mt-0 mb-16 sm:mb-0"
  style={{
    height: `${videoHeight + 12}px`,
  }}
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