import { useState, useEffect, useRef } from "react";
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
import Webcam from "react-webcam";
import { useNavigate } from "react-router-dom";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime"; 

function Home() {
  const [dateTime, setDateTime] = useState(new Date());
  const [showCamera, setShowCamera] = useState(false);
  const [faces, setFaces] = useState([]);
  const [statusMessages, setStatusMessages] = useState([]);
  const [action, setAction] = useState("checkin");
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);

  const webcamRef = useRef(null);
  const navigate = useNavigate();

  const videoWidth = 580;
  const videoHeight = 343;

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
    let interval;
    if (showCamera) {
      interval = setInterval(() => captureAndSendFrame("preview"), 2000);
    }
    return () => clearInterval(interval);
  }, [showCamera, action]);

  const captureAndSendFrame = async (mode = "preview", subAction = null) => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    const blob = await (await fetch(imageSrc)).blob();
    const formData = new FormData();
    formData.append("file", blob, "frame.jpg");

    // Use proper action mapping
    if (action === "work-application") {
      formData.append("action", "login"); // send as login
    } else {
      formData.append("action", subAction || action);
    }

    try {
      const response = await fetch(`http://localhost:8000/attendance/${mode}`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      handleBackendResponse(data, mode);
    } catch (error) {
      console.error("Error sending frame:", error);
    }
  };

  const handleBackendResponse = (data, mode) => {
    if (data.error) {
      setFaces([{ name: "Unknown", status: "unknown", box: [50, 50, 100, 100] }]);
      setStatusMessages(["❌ Unknown face detected"]);
      return;
    }

    if (data.results && Array.isArray(data.results)) {
      const mappedFaces = data.results.map((face) => ({
        name: face.name,
        status: face.status,
        box: face.box,
      }));
      setFaces(mappedFaces);

      if (mode === "mark" && mappedFaces.length > 0) {
        const currentDateTime = dateTime.toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });

        const msgs = mappedFaces.map((face) => {
          if (action === "work-application" && face.status === "logged_in") {
            navigate("/work-application", { state: { user: face.name } });
            return `✅ ${face.name} logged in to Work Application — ${currentDateTime}`;
          }

          if (face.status === "checked_in")
            return `✅ ${face.name} marked Present — ${currentDateTime}`;
          if (face.status === "already_checked_in")
            return `⚠️ ${face.name} already Checked In — ${currentDateTime}`;
          if (face.status === "checked_out")
            return `✅ ${face.name} Checked Out — ${currentDateTime}`;
          if (face.status === "already_checked_out")
            return `⚠️ ${face.name} already Checked Out — ${currentDateTime}`;
          if (face.status === "break_started")
            return `⏸️ ${face.name} started Break — ${currentDateTime}`;
          if (face.status === "already_on_break")
            return `⚠️ ${face.name} is already on Break — ${currentDateTime}`;
          if (face.status === "break_ended")
            return `▶️ ${face.name} ended Break — ${currentDateTime}`;
          if (face.status === "already_break_ended")
            return `⚠️ ${face.name} already ended Break — ${currentDateTime}`;
          if (face.status === "break_not_started")
            return `⚠️ ${face.name} cannot end Break (not started) — ${currentDateTime}`;
          if (face.status === "checkin_missing")
            return `⚠️ ${face.name} cannot proceed → No Check-In found — ${currentDateTime}`;
          if (face.status === "cannot_checkout_on_break")
            return `⚠️ ${face.name} cannot Check Out while on Break — ${currentDateTime}`;
          if (face.status === "spoof")
            return `❌ Spoof attempt detected (photo) — ${currentDateTime}`;
          if (face.status === "unknown") return `❌ Unknown face detected`;
          return `ℹ️ ${face.name} action processed — ${currentDateTime}`;
        });

        setStatusMessages(msgs);
        if (action !== "work-application") {
          setTimeout(() => setStatusMessages([]), 2000);
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
    if (status === "logged_in") return "border-green-500"; 
    if (status === "preview") return "border-green-300";
    if (status === "spoof") return "border-orange-700"; // Spoof detection color
    return "border-gray-300";
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

        <div className="absolute right-10">
          <button
            onClick={() => navigate("/admin-login")}
            className="w-350 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <KeyIcon className="h-5 w-5" />
            Admin Login
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center flex-grow">
        {!showCamera ? (
          <div className="grid grid-cols-2 gap-x-0 gap-y-10 w-full px-32 -mt-10 justify-items-center">
            {/* Check In */}
            <button
              onClick={() => {
                setAction("checkin");
                setShowCamera(true);
              }}
              className="w-[70%] h-48 bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-4xl font-semibold 
                       rounded-xl shadow-lg flex flex-col items-center justify-center"
            >
              <CheckCircleIcon className="h-16 w-16 mb-4" />
              <span>Check In</span>
            </button>

            {/* Check Out */}
            <button
              onClick={() => {
                setAction("checkout");
                setShowCamera(true);
              }}
              className="w-[70%] h-48 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-4xl font-semibold 
                       rounded-xl shadow-lg flex flex-col items-center justify-center"
            >
              <ClockIcon className="h-16 w-16 mb-4" />
              <span>Check Out</span>
            </button>

            {/* Break */}
            <button
              onClick={() => {
                setAction("break");
                setShowCamera(true);
              }}
              className="w-[70%] h-48 bg-yellow-400 hover:bg-yellow-500 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-4xl font-semibold 
                       rounded-xl shadow-lg flex flex-col items-center justify-center"
            >
              <PauseCircleIcon className="h-16 w-16 mb-4" />
              <span>Break</span>
            </button>

            {/* Work Application */}
            <button
              onClick={() => {
                navigate("/work-application-login");
              }}
              className="w-[70%] h-48 bg-purple-500 hover:bg-purple-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-4xl font-semibold 
                       rounded-xl shadow-lg flex flex-col items-center justify-center"
            >
              <ClipboardDocumentListIcon className="h-16 w-16 mb-4" />
              <span>Work Application</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full gap-12 -mt-8">
            {/* Camera Selection Dropdown */}
            <div className="flex flex-col items-center mt-0 mb-0">
              <label className="text-xl font-semibold text-indigo-700 mb-2">
                Select Camera
              </label>
              <select
                value={selectedCamera || ""}
                onChange={(e) => setSelectedCamera(e.target.value)}
                className="px-4 py-2 border-2 border-indigo-400 rounded-lg shadow-md text-base w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {cameras.map((cam, idx) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex w-full justify-center gap-6">
              {/* Camera */}
              <div className="relative">
                <div className="relative border-[6px] border-blue-800 rounded-lg shadow-2xl inline-block">
                  <Webcam
                    key={selectedCamera}
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="transform scale-x-[-1]"
                    videoConstraints={{
                      width: videoWidth,
                      height: videoHeight,
                      deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
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
                      {face.status === "spoof"
                        ? "Photo Detected – Not Allowed"
                        : face.name}
                    </span>
                  </div>
                ))}

                {/* Buttons under Camera */}
                <div className="flex gap-4 mt-6 mb-4 justify-center">
                  {action === "break" ? (
                    <>
                      <button
                        onClick={() => captureAndSendFrame("mark", "break_start")}
                        className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 hover:scale-105 active:scale-95 
                                 transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center gap-2"
                      >
                        <PlayIcon className="h-5 w-5" />
                        Start Break
                      </button>
                      <button
                        onClick={() => captureAndSendFrame("mark", "break_end")}
                        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 hover:scale-105 active:scale-95 
                                 transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center gap-2"
                      >
                        <StopIcon className="h-5 w-5" />
                        End Break
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => captureAndSendFrame("mark")}
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
                      setStatusMessages([]);
                      setFaces([]);
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
                className="w-[37%] bg-white border-[6px] border-indigo-700 rounded-xl shadow-2xl p-6 flex flex-col items-center"
                style={{ height: `${videoHeight + 12}px` }}
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