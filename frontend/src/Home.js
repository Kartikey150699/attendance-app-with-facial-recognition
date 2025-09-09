import { useState, useEffect, useRef } from "react";
import { CheckCircleIcon, ClockIcon } from "@heroicons/react/24/solid";
import Webcam from "react-webcam";
import { useNavigate } from "react-router-dom";

function Home() {
  const [dateTime, setDateTime] = useState(new Date());
  const [showCamera, setShowCamera] = useState(false);
  const [faces, setFaces] = useState([]);
  const [action, setAction] = useState("checkin");
  const webcamRef = useRef(null);
  const navigate = useNavigate();

  const videoWidth = 600;
  const videoHeight = 370;

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
      handleBackendResponse(data);
    } catch (error) {
      console.error("Error sending frame:", error);
    }
  };

  const handleBackendResponse = (data) => {
    if (data.error) {
      setFaces([{ name: "Unknown", status: "unknown", box: [50, 50, 100, 100] }]);
      return;
    }

    if (data.results && Array.isArray(data.results)) {
      const mappedFaces = data.results.map((face) => ({
        name: face.name,
        status: face.status,
        box: face.box,
      }));
      setFaces(mappedFaces);
    }
  };

  const getBoxColor = (status) => {
    if (status === "marked") return "border-green-500";        // success
    if (status === "already_marked") return "border-yellow-400"; // duplicate
    if (status === "unknown") return "border-red-600";         // not recognized
    if (status === "preview") return "border-green-300";       // live preview
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
          <div className="flex justify-between w-full px-32 mt-20">
            <button
              onClick={() => {
                setAction("checkin");
                setShowCamera(true);
              }}
              className="w-96 h-48 bg-green-400 hover:bg-green-500 hover:scale-105 active:scale-95 transition-transform duration-200 text-5xl text-white font-semibold rounded-xl shadow-md flex flex-col items-center justify-center"
            >
              <CheckCircleIcon className="h-16 w-16 mb-4" />
              <span>Check In</span>
            </button>

            <button
              onClick={() => {
                setAction("checkout");
                setShowCamera(true);
              }}
              className="w-96 h-48 bg-blue-400 hover:bg-blue-500 hover:scale-105 active:scale-95 transition-transform duration-200 text-5xl text-white font-semibold rounded-xl shadow-md flex flex-col items-center justify-center"
            >
              <ClockIcon className="h-16 w-16 mb-4" />
              <span>Check Out</span>
            </button>
          </div>
        ) : (
          <div className="relative flex flex-col items-center flex-grow justify-center">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="rounded-lg shadow-lg transform scale-x-[-1]" // mirror feed
              videoConstraints={{
                width: videoWidth,
                height: videoHeight,
                facingMode: "user",
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

            {/* Buttons side by side */}
            <div className="flex gap-4 mt-6 mb-10">
  <button
    onClick={() => captureAndSendFrame("mark")}
    className="px-6 py-3 bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white font-bold rounded-lg shadow"
  >
    📸 Capture & Mark
  </button>
  <button
    onClick={() => setShowCamera(false)}
    className="px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white font-bold rounded-lg shadow"
  >
    Close Camera
  </button>
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
