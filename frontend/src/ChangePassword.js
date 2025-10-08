import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EyeIcon, 
  EyeSlashIcon, 
  ArrowUturnLeftIcon, 
  LockClosedIcon, 
  FingerPrintIcon, 
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime"; 
import { API_BASE } from "./config";

function ChangePassword() {
  const [username, setUsername] = useState(""); 
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const navigate = useNavigate();


  const handleSubmit = async () => {
    if (!username || !oldPassword || !newPassword || !confirmPassword) {
      setPopupMessage("⚠️ Please fill in all fields");
      setShowPopup(true);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPopupMessage("⚠️ New passwords do not match");
      setShowPopup(true);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("old_password", oldPassword);
      formData.append("new_password", newPassword);

const response = await fetch(`${API_BASE}/admin/change-password`, {
  method: "POST",
  body: formData,
});

      const data = await response.json();

      if (data.error) {
        setPopupMessage(`Error: ${data.error}`);
        setShowPopup(true);
      } else {
        setPopupMessage("Password updated successfully!");
        setShowPopup(true);
      }
    } catch (err) {
      console.error("Error changing password:", err);
      setPopupMessage("Failed to change password.");
      setShowPopup(true);
    }
  };

  const handlePopupOk = () => {
    setShowPopup(false);
    if (popupMessage.includes("successfully")) {
      navigate("/admin-dashboard");
    } else {
      // clear fields on error
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
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
      onClick={() => {
        // clear admin session
        localStorage.removeItem("currentAdmin");
        navigate("/", { replace: true });
      }}
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

      {/* Change Password Box */}
      {/* Change Password Box */}
<div className="bg-white p-6 sm:p-8 rounded-xl shadow-md w-[90%] sm:w-96 md:w-[420px] lg:w-[460px] mx-auto mt-12 sm:mt-20 mb-10 sm:mb-16 transition-all duration-300">
        <h2 className="text-2xl font-bold text-center mb-6 text-indigo-700 flex items-center justify-center gap-2">
  <LockClosedIcon className="h-6 w-6 text-indigo-700" />
  Change Admin Password
</h2>

        {/* Username Field */}
        <div className="relative w-full mb-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Old Password */}
        <div className="relative w-full mb-4">
          <input
            type={showOld ? "text" : "password"}
            placeholder="Old Password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full px-4 py-2.5 sm:py-3 pr-10 text-base sm:text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
            className="w-full px-4 py-2.5 sm:py-3 pr-10 text-base sm:text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
            className="w-full px-4 py-2.5 sm:py-3 pr-10 text-base sm:text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
  className="w-full py-3 sm:py-3.5 bg-indigo-500 hover:bg-indigo-600 hover:scale-105 active:scale-95 
             transition-transform duration-200 text-white font-bold text-base sm:text-lg 
             rounded-lg shadow flex items-center justify-center gap-2 mt-2"
>
  <FingerPrintIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
  Change Password
</button>

      </div>

      {/* Popup */}
      {showPopup && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
    <div
      className={`p-8 rounded-2xl shadow-2xl text-center transform transition-all duration-300 scale-100 ${
        popupMessage.includes("successfully")
          ? "bg-green-50 border-2 border-green-400"
          : "bg-red-50 border-2 border-red-400"
      }`}
    >
      {/* Title */}
      <h2
        className={`text-2xl font-extrabold mb-4 flex items-center justify-center gap-2 ${
          popupMessage.includes("successfully")
            ? "text-green-700"
            : "text-red-700"
        }`}
      >
        {popupMessage.includes("successfully") ? "✅ Success" : "❌ Error"}
      </h2>

      {/* Message */}
      <p className="text-lg text-gray-800 mb-6">{popupMessage}</p>

      {/* Action button */}
      <button
        onClick={handlePopupOk}
        className="px-6 py-2 font-bold rounded-lg shadow bg-indigo-600 text-white hover:bg-indigo-700"
      >
        OK
      </button>
    </div>
  </div>
)}
      {/* Footer */}
      <Footer />
    </div>
  );
}

export default ChangePassword;