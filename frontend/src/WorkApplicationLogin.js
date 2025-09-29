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

function WorkApplicationLogin() {
  const [faces, setFaces] = useState([]);
  const [statusMessages, setStatusMessages] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [employeeId, setEmployeeId] = useState("");

  const webcamRef = useRef(null);
  const navigate = useNavigate();

  const videoWidth = 580;
  const videoHeight = 323;

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
      interval = setInterval(() => capturePreviewFrame(), 2000);
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
      const response = await fetch("http://localhost:8000/attendance/preview", {
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
      const response = await fetch("http://localhost:8000/attendance/mark", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const face = data.results[0];

        if (face.status === "logged_in") {
          setStatusMessages([`✅ Welcome ${face.name}`]);

          // ✅ Persist user in localStorage
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
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md relative">
        <div className="absolute left-10 text-blue-800 text-xl font-bold">
          <HeaderDateTime />
        </div>

        <h1
          onClick={() => navigate("/")}
          className="text-5xl font-bold text-blue-900 cursor-pointer hover:text-blue-700 transition-colors"
        >
          FaceTrack Attendance
        </h1>

        <div className="absolute right-10 flex flex-col items-end gap-3">
          {/* Back button */}
          <button
            onClick={() => navigate("/")}
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <ArrowUturnLeftIcon className="h-5 w-5" />
            Back
          </button>

          {/* Camera Selection */}
          <div className="absolute right-15 top-20 flex flex-col items-center">
            <label className="text-xl font-semibold text-indigo-700 mb-2 mt-4">
              Select Camera
            </label>
            <select
              value={selectedCamera || ""}
              onChange={(e) => {
                setSelectedCamera(e.target.value);
                localStorage.setItem("selectedCamera", e.target.value);
              }}
              className="px-6 py-2 border-2 border-indigo-400 rounded-lg shadow-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

      {/* Camera + Input Section (wrapped in a form for Enter support) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          captureAndSendFrame();
        }}
        className="flex flex-col items-center w-full gap-6 mt-10"
      >
        {/* Employee ID Input */}
        <div className="flex flex-col items-center mb-4">
          <label className="text-xl font-semibold text-indigo-700 mb-2">
            Enter Employee ID
          </label>
          <input
            type="text"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="e.g., IFNT001"
            className="px-4 py-2 border-2 border-indigo-400 rounded-lg shadow-md text-base w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
          />
        </div>

        <div className="flex w-full justify-center gap-6">
          {/* Camera */}
          <div className="relative" style={{ width: videoWidth, height: videoHeight }}>
            <div className="relative border-[6px] border-blue-800 rounded-lg shadow-2xl inline-block">
              <Webcam
                key={selectedCamera}
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="transform scale-x-[-1]"
                videoConstraints={{
                  width: { ideal: 1920 },  // request HD feed
                  height: { ideal: 1080 }, // request HD feed
                  deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
                }}
              />

              {/* Face Boxes */}
              {faces.map((face, index) => (
                <div
                  key={index}
                  className={`absolute border-4 ${getBoxColor(
                    face.status
                  )} rounded-lg flex items-end justify-center`}
                  style={{
                    top: `${face.box[1]}px`,
                    left: `${videoWidth - face.box[0] - face.box[2]}px`,
                    width: `${face.box[2]}px`,
                    height: `${face.box[3]}px`,
                  }}
                >
                  <span className="bg-black text-white px-2 py-1 rounded-b-lg font-bold">
                    {face.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-4 mt-6 mb-4 justify-center">
              <button
                type="submit" 
                className="px-6 py-3 bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95 
                  transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center gap-2"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                Login
              </button>
            </div>
          </div>

          {/* Status Panel */}
          <div
            className="w-[37%] bg-white border-[6px] border-indigo-700 rounded-xl shadow-2xl p-6 flex flex-col items-center"
            style={{ height: `${videoHeight + 12}px` }}
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