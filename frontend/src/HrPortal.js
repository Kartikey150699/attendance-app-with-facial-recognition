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

function HrPortal() {
  const navigate = useNavigate();
  const [dateTime, setDateTime] = useState(new Date());
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch pending requests count
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const res = await fetch("http://localhost:8000/work-applications/");
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
      {/* Header */}
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md relative">
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

      {/* HR Portal Title */}
      <div className="flex justify-center py-8">
        <h2 className="text-4xl font-bold text-indigo-700 flex items-center gap-3 mt-8">
          <UserGroupIcon className="h-8 w-8 text-indigo-700" />
          HR Portal
        </h2>
      </div>

      {/* 2x2 Grid Buttons */}
      <div className="grid grid-cols-2 gap-8 max-w-4xl mx-auto mb-12 mt-6">
        {/* Work Applications */}
        <div className="relative">
          <button
            onClick={() => navigate("/hrportal/work-application-requests")}
            className="relative p-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg text-2xl font-bold flex flex-col items-center gap-4 transition-transform hover:scale-105"
          >
            <ClipboardDocumentListIcon className="h-12 w-12" />
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
  className="p-10 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg text-2xl font-bold flex flex-col items-center gap-4 transition-transform hover:scale-105"
>
  <SunIcon className="h-12 w-12" />
  Holiday Management
</button>

        {/* Logs & Reports */}
        <button
          onClick={() => navigate("/hrportal/logs-reports")}
          className="p-10 bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-lg text-2xl font-bold flex flex-col items-center gap-4 transition-transform hover:scale-105"
        >
          <ChartBarIcon className="h-12 w-12" />
          Logs & Reports
        </button>

        {/* Calendar View */}
        <button
  onClick={() => navigate("/calendar-view", { state: { from: "hr" } })}
  className="p-10 bg-yellow-500 hover:bg-yellow-600 text-white rounded-2xl shadow-lg text-2xl font-bold flex flex-col items-center gap-4 transition-transform hover:scale-105"
>
  <CalendarDaysIcon className="h-12 w-12" />
  Calendar View
</button>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default HrPortal;