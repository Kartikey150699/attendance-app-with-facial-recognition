import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";

function RegisterUser() {
  const [name, setName] = useState("");
  const [dateTime, setDateTime] = useState(new Date());
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = () => {
    if (!name.trim()) {
      setPopupMessage("⚠️ Please enter name of the user");
      setShowPopup(true);
    } else {
      setPopupMessage("✅ User registered successfully!");
      setShowPopup(true);
    }
  };

  const handlePopupOk = () => {
    setShowPopup(false);
    if (popupMessage.includes("successfully")) {
      navigate("/admin-dashboard"); // only go back if success
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md">
        {/* Date & Time */}
        <div className="absolute left-10 text-blue-800 text-xl font-bold">
          {dateTime.toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })} —{" "}
          {dateTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })}
        </div>

        {/* Title */}
        <h1 className="text-5xl font-bold text-blue-900">
          FaceTrack Attendance
        </h1>

        {/* Back Button */}
        <div className="absolute right-10">
          <button
            onClick={() => navigate("/admin-dashboard")}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-sm font-bold rounded-lg shadow"
          >
            🔙 Back
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col items-center flex-grow py-6 overflow-hidden">
        <h2 className="text-3xl font-bold text-indigo-700 mb-6">
          Register User
        </h2>

        <div className="flex w-full max-w-6xl px-10">
          {/* Left: Camera */}
          <div className="flex justify-center items-center w-1/2">
            <Webcam
              audio={false}
              screenshotFormat="image/jpeg"
              className="rounded-lg shadow-lg border-4 border-indigo-500 transform scale-x-[-1]"
              videoConstraints={{
                width: 480,
                height: 360,
                facingMode: "user",
              }}
            />
          </div>

          {/* Right: Form */}
          <div className="flex flex-col items-center justify-center w-1/2">
            <input
              type="text"
              placeholder="Enter user's name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-80 px-4 py-2 mb-6 border rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

            <button
              onClick={handleSubmit}
              className="w-80 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg shadow hover:scale-105 active:scale-95 transition-transform"
            >
              Submit
            </button>
          </div>
        </div>
      </div>

      {/* Popup Modal */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white p-6 rounded-xl shadow-lg text-center">
            <p className="text-lg font-semibold text-gray-800 mb-4">
              {popupMessage}
            </p>
            <button
              onClick={handlePopupOk}
              className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-lg shadow"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full py-4 bg-blue-900 text-center text-xl text-white mt-auto">
  © 2025 FaceTrack. All rights reserved - Kartikey Koli - IFNET
</footer>

    </div>
  );
}

export default RegisterUser;
