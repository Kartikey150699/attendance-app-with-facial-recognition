import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  UserPlusIcon,
  DocumentTextIcon,
  LockClosedIcon,
  UsersIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  ClockIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { API_BASE } from "./config";

function AdminDashboard() {
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();
  const [showAutoTrainInfo, setShowAutoTrainInfo] = useState(false);
  const [autoTrainEnabled, setAutoTrainEnabled] = useState(false);

  const toggleAutoTrain = async () => {
    try {
const res = await fetch(`${API_BASE}/attendance/toggle-auto-train`, {
  method: "POST",
});
      const data = await res.json();
      setAutoTrainEnabled(data.auto_train_enabled);
    } catch (err) {
      console.error("Failed to toggle auto-train", err);
    }
  };

  useEffect(() => {
    const admin = localStorage.getItem("currentAdmin");
    if (admin) {
      setCurrentAdmin(admin);
    } else {
      navigate("/admin-login");
    }
  }, [navigate]);

  // Fetch pending requests count
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const res = await fetch(`${API_BASE}/work-applications/`, {
  method: "GET",
});
        if (!res.ok) throw new Error("Failed to fetch applications");
        const data = await res.json();
        const count = data.filter((app) => app.status === "Pending").length;
        setPendingCount(count);
      } catch (error) {
        console.error("Error fetching pending requests:", error);
      }
    };

    fetchPendingCount();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("currentAdmin");
    setCurrentAdmin(null);
    navigate("/admin-login");
    window.location.reload();
  };

  // Get AutoTrain status from backend when page loads
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(`${API_BASE}/attendance/auto-train-status`);
        const data = await res.json();
        setAutoTrainEnabled(data.auto_train_enabled);
      } catch (err) {
        console.error("Error fetching auto-train status:", err);
      }
    }
    fetchStatus();
  }, []);

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
      onClick={() => navigate("/")}
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

    {/* Right: Date & Time + Logout Button */}
    <div className="flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-4 mt-3 sm:mt-0">
      {/* Date & Time */}
      <div className="text-center text-sm sm:text-base md:text-lg font-semibold text-white tracking-wide drop-shadow-md order-2 sm:order-1">
        <HeaderDateTime />
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="order-1 sm:order-2 px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 
                   hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl 
                   transition-all duration-300 flex items-center gap-2"
      >
        <ArrowRightOnRectangleIcon className="h-5 w-5" />
        Logout
      </button>
    </div>
  </div>
</header>

      {/* Dashboard Content */}
      <div className="flex flex-col items-center flex-grow py-10">
        <h2 className="text-4xl font-bold text-indigo-700 mb-2 flex items-center justify-center gap-4">
          <Cog6ToothIcon className="h-8 w-8 text-indigo-700" />
          Admin Dashboard
        </h2>

        {currentAdmin && (
          <p className="text-xl sm:text-2xl font-semibold text-gray-700 mb-8 sm:mb-12 text-center px-4">
            Welcome <span className="text-indigo-700 font-bold">{currentAdmin}</span>
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 px-6 sm:px-12 lg:px-24 -mt-2 w-full max-w-6xl">
          {/* Row 1 */}
          <button
            onClick={() => navigate("/register-user")}
            className="px-14 py-8 px-8 sm:px-12 md:px-14 py-6 sm:py-8 w-full sm:w-auto bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-2xl font-bold rounded-lg shadow"
          >
            <UserPlusIcon className="h-6 w-6 inline-block mr-2" />
            Register User
          </button>

          <button
            onClick={() => navigate("/attendance-logs")}
            className="px-14 py-8 px-8 sm:px-12 md:px-14 py-6 sm:py-8 w-full sm:w-auto bg-blue-500 hover:bg-blue-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-2xl font-bold rounded-lg shadow"
          >
            <DocumentTextIcon className="h-6 w-6 inline-block mr-2" />
            View Attendance Logs
          </button>

          {/* Row 2 */}
          <button
            onClick={() => navigate("/change-password")}
            className="px-14 py-8 px-8 sm:px-12 md:px-14 py-6 sm:py-8 w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-2xl font-bold rounded-lg shadow"
          >
            <LockClosedIcon className="h-6 w-6 inline-block mr-2" />
            Change Admin Password
          </button>

          <button
            onClick={() => navigate("/hr-portal", { replace: true })}
            className="relative px-14 py-8 px-8 sm:px-12 md:px-14 py-6 sm:py-8 w-full sm:w-auto bg-purple-500 hover:bg-purple-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-2xl font-bold rounded-lg shadow flex items-center justify-center"
          >
            <UserGroupIcon className="h-6 w-6 inline-block mr-2" />
            HR Portal
            {pendingCount > 0 && (
              <span className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 
                               flex items-center justify-center shadow">
                {pendingCount}
              </span>
            )}
          </button>

          {/* Row 3 */}
          <button
            onClick={() => navigate("/manage-users")}
            className="px-8 sm:px-12 md:px-14 py-8 sm:py-10 lg:py-8 w-full sm:w-auto 
           bg-indigo-500 hover:bg-indigo-600 hover:scale-105 active:scale-95 
           transition-transform duration-200 text-white text-2xl font-bold rounded-lg shadow"
          >
            <UsersIcon className="h-6 w-6 inline-block mr-2" />
            Manage Users
          </button>

          <button
            onClick={() => navigate("/manage-admin")}
            className="px-8 sm:px-12 md:px-14 py-8 md:py-8 sm:py-10 w-full sm:w-auto bg-pink-500 hover:bg-pink-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-2xl font-bold rounded-lg shadow"
          >
            <ShieldCheckIcon className="h-6 w-6 inline-block mr-2" />
            Manage Admins
          </button>

          {/* Row 4 - New Buttons */}
          <button
            onClick={() => navigate("/paid-holidays")}
            className="px-14 py-8 px-8 sm:px-12 md:px-14 py-6 sm:py-8 w-full sm:w-auto bg-orange-500 hover:bg-orange-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-2xl font-bold rounded-lg shadow"
          >
            <CalendarDaysIcon className="h-6 w-6 inline-block mr-2" />
            Paid Holidays Management
          </button>

          <button
            onClick={() => navigate("/shifts-management")}
            className="px-14 py-8 px-8 sm:px-12 md:px-14 py-6 sm:py-8 w-full sm:w-auto bg-teal-500 hover:bg-teal-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-2xl font-bold rounded-lg shadow"
          >
            <ClockIcon className="h-6 w-6 inline-block mr-2" />
            Shifts Management
          </button>
        </div>

        {/* Auto-Train Controls (Single Row) */}
        <div
  className="fixed sm:bottom-20 bottom-10 right-3 sm:right-6 z-50
             flex flex-row items-center gap-3 sm:gap-4 bg-white/95 
             p-2 sm:p-3 rounded-lg shadow-lg border border-gray-300
             sm:static sm:mt-8 sm:self-end sm:mr-6 sm:z-0
             transition-all duration-500 ease-in-out transform
             animate-[slideUp_0.5s_ease-in-out]"
>
          {/* Label */}
          <span className="text-base font-semibold text-gray-800">
            {autoTrainEnabled ? "AutoTrain Model (ON)" : "AutoTrain Model (OFF)"}
          </span>

          {/* Switch */}
          <button
            onClick={toggleAutoTrain}
            className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
              autoTrainEnabled ? "bg-green-500" : "bg-gray-400"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                autoTrainEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>

          {/* Info Button */}
          <button
            onClick={() => setShowAutoTrainInfo(true)}
            className="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-md shadow"
          >
            What is Auto-Train?
          </button>
        </div>

        {/* Info Modal (Japanese) */}
{showAutoTrainInfo && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4 sm:px-6">
    <div
      className="bg-white rounded-lg shadow-lg p-6 sm:p-8 w-full max-w-[500px] 
                 transform transition-all duration-300 scale-100"
    >
      <h2 className="text-xl sm:text-2xl font-bold text-indigo-700 mb-4 text-center">
        Auto-Trainモデル（顔の経年変化対応）
      </h2>

      <p className="mb-3 text-sm sm:text-base leading-relaxed text-gray-700">
        Auto-Train機能は、ユーザーの顔が加齢、髪型、眼鏡などで変化しても、
        システムが自動的に適応し、手動での更新を行わずに精度を維持する仕組みです。
      </p>

      <ul className="list-disc list-inside space-y-1 mb-4 text-gray-700 text-sm sm:text-base">
        <li>最新の埋め込みデータ20件のみを保持。</li>
        <li>類似度が0.90以上の場合のみ保存。</li>
        <li>「曖昧な一致」は保存しない。</li>
        <li>管理者がAuto-TrainをON/OFFで制御可能。</li>
      </ul>

      <p className="font-semibold text-green-700 mb-4 text-sm sm:text-base">
        利点：長期的な精度維持、管理者の作業負担軽減、手動ミス防止。
      </p>

      <div className="flex justify-center">
        <button
          onClick={() => setShowAutoTrainInfo(false)}
          className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg shadow 
                     text-sm sm:text-base"
        >
          閉じる
        </button>
      </div>
    </div>
  </div>
)}
      </div>

      <Footer />
    </div>
  );
}

export default AdminDashboard;