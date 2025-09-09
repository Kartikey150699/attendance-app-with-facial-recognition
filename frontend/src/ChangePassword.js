import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid";

function ChangePassword() {
  const [dateTime, setDateTime] = useState(new Date());
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert("⚠️ Please fill in all fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("⚠️ New passwords do not match");
      return;
    }

    // Later: connect to backend API
    alert("✅ Password changed successfully!");
    navigate("/admin-dashboard");
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
        <h1 className="text-4xl font-bold text-blue-900">FaceTrack Attendance</h1>

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

      {/* Change Password Box */}
      <div className="bg-white p-8 rounded-xl shadow-md w-96 mx-auto mt-20">
        <h2 className="text-2xl font-bold text-center mb-6 text-indigo-700">
          Change Password 🔒
        </h2>

        {/* Old Password */}
        <div className="relative w-full mb-4">
          <input
            type={showOld ? "text" : "password"}
            placeholder="Old Password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="button"
            onClick={() => setShowOld(!showOld)}
            className="absolute inset-y-0 right-3 flex items-center text-gray-600 hover:text-indigo-500"
          >
            {showOld ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
          </button>
        </div>

        {/* New Password */}
        <div className="relative w-full mb-4">
          <input
            type={showNew ? "text" : "password"}
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute inset-y-0 right-3 flex items-center text-gray-600 hover:text-indigo-500"
          >
            {showNew ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
          </button>
        </div>

        {/* Confirm Password */}
        <div className="relative w-full mb-6">
          <input
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute inset-y-0 right-3 flex items-center text-gray-600 hover:text-indigo-500"
          >
            {showConfirm ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
          </button>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-lg shadow"
        >
          Change Password
        </button>
      </div>

      {/* Footer */}
      <footer className="w-full py-4 bg-blue-900 text-center text-xl text-white mt-auto">
        © 2025 FaceTrack. All rights reserved - Kartikey Koli
      </footer>
    </div>
  );
}

export default ChangePassword;
