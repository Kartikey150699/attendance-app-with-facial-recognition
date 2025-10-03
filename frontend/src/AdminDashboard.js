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

function AdminDashboard() {
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();
  const [showAutoTrainInfo, setShowAutoTrainInfo] = useState(false);
  const [autoTrainEnabled, setAutoTrainEnabled] = useState(false);

  const toggleAutoTrain = async () => {
    try {
      const res = await fetch("http://localhost:8000/attendance/toggle-auto-train", {
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
        const res = await fetch("http://localhost:8000/work-applications/");
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
        const res = await fetch("http://localhost:8000/attendance/auto-train-status");
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
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md relative">
        <div className="absolute left-10 text-blue-800 text-xl font-bold">
          <HeaderDateTime />
        </div>

        <h1
          onClick={() => {
            localStorage.removeItem("currentAdmin");
            navigate("/", { replace: true });
          }}
          className="text-5xl font-bold text-blue-900 cursor-pointer hover:text-blue-700 transition-colors"
        >
          FaceTrack Attendance
        </h1>

        <div className="absolute right-10">
          <button
            onClick={handleLogout}
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white font-bold rounded-lg shadow flex 
                       items-center justify-center gap-2"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 text-white" />
            Logout
          </button>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex flex-col items-center flex-grow py-10">
        <h2 className="text-4xl font-bold text-indigo-700 mb-2 flex items-center justify-center gap-4">
          <Cog6ToothIcon className="h-8 w-8 text-indigo-700" />
          Admin Dashboard
        </h2>

        {currentAdmin && (
          <p className="text-2xl font-semibold text-gray-700 mb-12">
            Welcome <span className="text-indigo-700 font-bold">{currentAdmin}</span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-6 -mt-4">
          {/* Row 1 */}
          <button
            onClick={() => navigate("/register-user")}
            className="px-14 py-8 bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-2xl font-bold rounded-lg shadow"
          >
            <UserPlusIcon className="h-6 w-6 inline-block mr-2" />
            Register User
          </button>

          <button
            onClick={() => navigate("/attendance-logs")}
            className="px-14 py-8 bg-blue-500 hover:bg-blue-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-2xl font-bold rounded-lg shadow"
          >
            <DocumentTextIcon className="h-6 w-6 inline-block mr-2" />
            View Attendance Logs
          </button>

          {/* Row 2 */}
          <button
            onClick={() => navigate("/change-password")}
            className="px-14 py-8 bg-yellow-500 hover:bg-yellow-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-2xl font-bold rounded-lg shadow"
          >
            <LockClosedIcon className="h-6 w-6 inline-block mr-2" />
            Change Admin Password
          </button>

          <button
            onClick={() => navigate("/hr-portal", { replace: true })}
            className="relative px-14 py-8 bg-purple-500 hover:bg-purple-600 hover:scale-105 active:scale-95 
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
            className="px-14 py-8 bg-indigo-500 hover:bg-indigo-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-2xl font-bold rounded-lg shadow"
          >
            <UsersIcon className="h-6 w-6 inline-block mr-2" />
            Manage Users
          </button>

          <button
            onClick={() => navigate("/manage-admin")}
            className="px-14 py-8 bg-pink-500 hover:bg-pink-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-2xl font-bold rounded-lg shadow"
          >
            <ShieldCheckIcon className="h-6 w-6 inline-block mr-2" />
            Manage Admins
          </button>

          {/* Row 4 - New Buttons */}
          <button
            onClick={() => navigate("/paid-holidays")}
            className="px-14 py-8 bg-orange-500 hover:bg-orange-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-2xl font-bold rounded-lg shadow"
          >
            <CalendarDaysIcon className="h-6 w-6 inline-block mr-2" />
            Paid Holidays Management
          </button>

          <button
            onClick={() => navigate("/shifts-management")}
            className="px-14 py-8 bg-teal-500 hover:bg-teal-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-2xl font-bold rounded-lg shadow"
          >
            <ClockIcon className="h-6 w-6 inline-block mr-2" />
            Shifts Management
          </button>
        </div>

        {/* Auto-Train Controls (Single Row) */}
        <div className="fixed bottom-20 right-6 flex flex-row items-center gap-4 bg-white p-3 rounded-lg shadow-lg">
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-[500px]">
              <h2 className="text-2xl font-bold text-indigo-700 mb-4">
                Auto-Trainモデル（顔の経年変化対応）
              </h2>
              <p className="mb-3">
                Auto-Train機能は、ユーザーの顔が加齢、髪型、眼鏡などで変化しても、
                システムが自動的に適応し、手動での更新を行わずに精度を維持する仕組みです。
              </p>
              <ul className="list-disc list-inside space-y-1 mb-4 text-gray-700">
                <li>最新の埋め込みデータ20件のみを保持。</li>
                <li>類似度が0.90以上の場合のみ保存。</li>
                <li>「曖昧な一致」は保存しない。</li>
                <li>管理者がAuto-TrainをON/OFFで制御可能。</li>
              </ul>
              <p className="font-semibold text-green-700 mb-4">
                利点：長期的な精度維持、管理者の作業負担軽減、手動ミス防止。
              </p>
              <button
                onClick={() => setShowAutoTrainInfo(false)}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg shadow"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

export default AdminDashboard;