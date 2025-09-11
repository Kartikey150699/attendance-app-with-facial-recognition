import { useState, useEffect, useRef } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  PauseCircleIcon,
  PlayIcon,
  StopIcon,
} from "@heroicons/react/24/solid";
import Webcam from "react-webcam";
import { useNavigate } from "react-router-dom";

function Home() {
  const [dateTime, setDateTime] = useState(new Date());
  const [showCamera, setShowCamera] = useState(false);
  const [faces, setFaces] = useState([]);
  const [statusMessage, setStatusMessage] = useState(null);
  const [action, setAction] = useState("checkin");
  const webcamRef = useRef(null);
  const navigate = useNavigate();

  const videoWidth = 580;
  const videoHeight = 343;

  // Update date & time every second
  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-preview every 2 seconds
  useEffect(() => {
    let interval;
    if (showCamera) {
      interval = setInterval(() => captureAndSendFrame("preview"), 2000);
    }
    return () => clearInterval(interval);
  }, [showCamera, action]);

  // Generic function: mode = "preview" or "mark"
  const captureAndSendFrame = async (mode = "preview") => {
    if (!webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    const blob = await (await fetch(imageSrc)).blob();
    const formData = new FormData();
    formData.append("file", blob, "frame.jpg");
    formData.append("action", action);

    try {
      const response = await fetch(
        `http://localhost:8000/attendance/${mode}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();
      handleBackendResponse(data, mode);
    } catch (error) {
      console.error("Error sending frame:", error);
    }
  };

  const handleBackendResponse = (data, mode) => {
    if (data.error) {
      setFaces([
        { name: "Unknown", status: "unknown", box: [50, 50, 100, 100] },
      ]);
      setStatusMessage("❌ Unknown face detected");
      return;
    }

    if (data.results && Array.isArray(data.results)) {
      const mappedFaces = data.results.map((face) => ({
        name: face.name,
        status: face.status,
        box: face.box,
      }));
      setFaces(mappedFaces);

      // Only show status when action = mark
      if (mode === "mark" && mappedFaces.length > 0) {
        const face = mappedFaces[0];
        const currentDateTime = dateTime.toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });

        if (face.status === "checked_in") {
          setStatusMessage(
            `✅ ${face.name} marked Present — ${currentDateTime}`
          );
        } else if (face.status === "already_checked_in") {
          setStatusMessage(
            `⚠️ ${face.name} already Checked In — ${currentDateTime}`
          );
        } else if (face.status === "checked_out") {
          setStatusMessage(
            `✅ ${face.name} Checked Out — ${currentDateTime}`
          );
        } else if (face.status === "already_checked_out") {
          setStatusMessage(
            `⚠️ ${face.name} already Checked Out — ${currentDateTime}`
          );
        } else if (face.status === "checkin_missing") {
          setStatusMessage(
            `⚠️ Checkout failed → No Check-In found — ${currentDateTime}`
          );
        } else if (face.status === "unknown") {
          setStatusMessage("❌ Unknown face detected");
        } else {
          setStatusMessage(`ℹ️ Action processed — ${currentDateTime}`);
        }
      }
    }
  };

  const getBoxColor = (status) => {
    if (status === "checked_in") return "border-green-500";
    if (status === "already_checked_in") return "border-yellow-400";
    if (status === "checked_out") return "border-blue-500";
    if (status === "already_checked_out") return "border-yellow-400";
    if (status === "unknown") return "border-red-600";
    if (status === "preview") return "border-green-300";
    return "border-gray-300";
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md">
        <div className="absolute left-10 text-blue-800 text-xl font-bold">
          {dateTime.toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })}{" "}
          —{" "}
          {dateTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })}
        </div>

        <h1 className="text-5xl font-bold text-blue-900">
          FaceTrack Attendance
        </h1>

        <div className="absolute right-10">
          <button
            onClick={() => navigate("/admin-login")}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-sm font-bold rounded-lg shadow"
          >
            🔑 Admin Login
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center flex-grow">
        {!showCamera ? (
          <div className="flex justify-between w-full px-32 mt-20 gap-10">
            <button
              onClick={() => {
                setAction("checkin");
                setShowCamera(true);
              }}
              className="flex-1 h-48 bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-4xl text-white font-semibold rounded-xl shadow-md flex flex-col items-center justify-center"
            >
              <CheckCircleIcon className="h-16 w-16 mb-4" />
              <span>Check In</span>
            </button>

            <button
              onClick={() => {
                setAction("break");
                setShowCamera(true);
              }}
              className="flex-1 h-48 bg-yellow-400 hover:bg-yellow-500 hover:scale-105 active:scale-95 transition-transform duration-200 text-4xl text-white font-semibold rounded-xl shadow-md flex flex-col items-center justify-center"
            >
              <PauseCircleIcon className="h-16 w-16 mb-4" />
              <span>Break</span>
            </button>

            <button
              onClick={() => {
                setAction("checkout");
                setShowCamera(true);
              }}
              className="flex-1 h-48 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-4xl text-white font-semibold rounded-xl shadow-md flex flex-col items-center justify-center"
            >
              <ClockIcon className="h-16 w-16 mb-4" />
              <span>Check Out</span>
            </button>
          </div>
        ) : (
          <div className="flex w-full justify-center gap-6 mt-10">
            {/* Camera */}
            <div className="relative">
              <div className="relative border-[6px] border-blue-800 rounded-lg shadow-2xl inline-block">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="transform scale-x-[-1]"
                  videoConstraints={{
                    width: videoWidth,
                    height: videoHeight,
                    facingMode: "user",
                  }}
                />
              </div>

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

              {/* Buttons */}
              <div className="flex gap-4 mt-6 mb-4 justify-center">
                {action === "break" ? (
                  <>
                    <button
                      className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center gap-2"
                    >
                      <PlayIcon className="h-5 w-5" />
                      Start Break
                    </button>
                    <button
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center gap-2"
                    >
                      <StopIcon className="h-5 w-5" />
                      End Break
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => captureAndSendFrame("mark")}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white font-bold rounded-lg shadow"
                  >
                    📸 Capture
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowCamera(false);
                    setStatusMessage(null);
                    setFaces([]);
                  }}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white font-bold rounded-lg shadow"
                >
                  Close Camera
                </button>
              </div>
            </div>

            {/* Status Panel */}
            <div
              className="w-[37%] bg-white border-[6px] border-indigo-700 rounded-xl shadow-2xl p-6 flex flex-col items-center"
              style={{ height: `${videoHeight + 12}px` }}
            >
              <h2 className="text-2xl font-bold text-indigo-700 mb-6">
                {action === "checkin"
                  ? "Check In"
                  : action === "checkout"
                  ? "Check Out"
                  : "Break"}
              </h2>
              {statusMessage ? (
                <p className="text-lg font-semibold">{statusMessage}</p>
              ) : (
                <p className="text-gray-500">📌 Capture to see status</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="w-full py-4 bg-blue-900 text-center text-xl text-white text-sm mt-auto">
        © 2025 FaceTrack. All rights reserved - Kartikey Koli - IFNET
      </footer>
    </div>
  );
}

export default Home;
