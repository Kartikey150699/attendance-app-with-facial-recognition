import { useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  SunIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { useState, useEffect } from "react";
import { API_BASE } from "./config";

function HrPortal() {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  // Fetch pending requests count
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const res = await fetch(`${API_BASE}/work-applications/`);
        if (!res.ok) throw new Error("Failed to fetch applications");
        const data = await res.json();

        // Count how many are still pending
        const count = data.filter((app) => app.status === "Pending").length;
        setPendingCount(count);
      } catch (error) {
        console.error("Error fetching pending requests:", error);
      }
    };

    fetchPendingCount();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Midnight Glass Header */}
      <header className="relative w-full bg-gradient-to-r from-slate-800 via-gray-800 to-slate-900 text-white shadow-xl overflow-hidden border-b border-gray-700/30">
        {/* Frosted glass overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 backdrop-blur-md"></div>

        {/* Header Content */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between px-6 sm:px-10 lg:px-16 py-4 sm:py-5">

          {/* Left: Logo + Title */}
          <div
            onClick={() => {
              localStorage.removeItem("currentAdmin");
              navigate("/admin-login", { replace: true });
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

          {/* Right: Date & Time + Back button */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-4 mt-3 sm:mt-0">
            {/* Date & Time */}
            <div className="text-center text-sm sm:text-base md:text-lg font-semibold text-white tracking-wide drop-shadow-md order-2 sm:order-1">
              <HeaderDateTime />
            </div>

            {/* Back Button */}
            <button
              onClick={() => navigate("/admin-dashboard")}
              className="px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 via-pink-500 to-rose-500 
                         hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl 
                         transition-all duration-300 flex items-center gap-2 order-1 sm:order-2"
            >
              <ArrowUturnLeftIcon className="h-5 w-5" />
              Back
            </button>
          </div>
        </div>
      </header>

      {/* HR Portal Title */}
      <div className="flex justify-center py-8">
        <h2 className="text-4xl font-bold text-indigo-700 flex items-center gap-3 mt-8">
          <UserGroupIcon className="h-8 w-8 text-indigo-700" />
          HR Portal
        </h2>
      </div>

      {/* 2x2 Grid Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto mb-12 mt-6 px-4">
        {/* Work Applications */}
        <div className="relative">
          <button
            onClick={() => navigate("/hrportal/work-application-requests")}
            className="relative p-8 sm:p-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg text-xl sm:text-2xl font-bold flex flex-col items-center gap-4 transition-transform hover:scale-105"
          >
            <ClipboardDocumentListIcon className="h-10 w-10 sm:h-12 sm:w-12" />
            Work Application Requests
          </button>

          {/* Notification Badge */}
          {pendingCount > 0 && (
            <span className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </div>

        {/* Holiday Management */}
        <button
          onClick={() => navigate("/hrportal/holiday-management")}
          className="p-8 sm:p-10 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg text-xl sm:text-2xl font-bold flex flex-col items-center gap-4 transition-transform hover:scale-105"
        >
          <SunIcon className="h-10 w-10 sm:h-12 sm:w-12" />
          Holiday Management
        </button>

        {/* Logs & Reports */}
        <button
          onClick={() => navigate("/hrportal/logs-reports")}
          className="p-8 sm:p-10 bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-lg text-xl sm:text-2xl font-bold flex flex-col items-center gap-4 transition-transform hover:scale-105"
        >
          <ChartBarIcon className="h-10 w-10 sm:h-12 sm:w-12" />
          Logs & Reports
        </button>

        {/* Calendar View */}
        <button
          onClick={() => navigate("/calendar-view", { state: { from: "hr" } })}
          className="p-8 sm:p-10 bg-yellow-500 hover:bg-yellow-600 text-white rounded-2xl shadow-lg text-xl sm:text-2xl font-bold flex flex-col items-center gap-4 transition-transform hover:scale-105"
        >
          <CalendarDaysIcon className="h-10 w-10 sm:h-12 sm:w-12" />
          Calendar View
        </button>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default HrPortal;