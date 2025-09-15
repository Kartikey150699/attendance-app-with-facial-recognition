import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { EyeIcon, 
  EyeSlashIcon, 
  ArrowUturnLeftIcon, 
  LockClosedIcon, 
  FingerPrintIcon, 
  CheckCircleIcon,
  XCircleIcon
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime"; 

function ChangePassword() {
  const [dateTime, setDateTime] = useState(new Date());
  const [username, setUsername] = useState(""); // ✅ Username state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

      const response = await fetch("http://localhost:8000/admin/change-password", {
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
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md">
        {/* Date & Time */}
        <div className="absolute left-10 text-blue-800 text-xl font-bold">
          <HeaderDateTime />
        </div>

        {/* Title */}
        <h1
  onClick={() => navigate("/")}
  className="text-5xl font-bold text-blue-900 cursor-pointer hover:text-blue-700 transition-colors"
>
  FaceTrack Attendance
</h1>

        {/* Back Button */}
        <div className="absolute right-10">
          <button
  onClick={() => navigate("/admin-dashboard")}
  className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
>
  <ArrowUturnLeftIcon className="h-5 w-5 text-white" />
  <span>Back</span>
</button>
        </div>
      </div>

      {/* Change Password Box */}
      <div className="bg-white p-8 rounded-xl shadow-md w-96 mx-auto mt-20">
        <h2 className="text-2xl font-bold text-center mb-6 text-indigo-700 flex items-center justify-center gap-2">
  <LockClosedIcon className="h-6 w-6 text-indigo-700" />
  Change Password
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
  className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
>
  <FingerPrintIcon className="h-5 w-5 text-white" />
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
