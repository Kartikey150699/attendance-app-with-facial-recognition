import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";

function WorkApplication() {
  const location = useLocation();
  const navigate = useNavigate();

  // Get user from location OR localStorage
  const storedUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const user = location.state?.user || storedUser.name || "Guest";
  const employeeId =
    location.state?.employeeId || storedUser.employee_id || "EMP000";

  const [dateTime, setDateTime] = useState(new Date());

  // Form states
  const [applicationType, setApplicationType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!applicationType || !startDate || !endDate || !reason.trim()) return;

    const newApp = {
      id: Date.now(),
      employeeId,
      user,
      applicationType,
      startDate,
      endDate,
      startTime,
      endTime,
      reason,
      status: "Pending",
      hrNotes: "",
    };

    console.log("Submitted Application:", newApp);

    // Reset form
    setApplicationType("");
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setReason("");
  };

  const todayStr = new Date().toISOString().split("T")[0]; // ✅ today for min date

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200 overflow-x-hidden">
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
            onClick={() => navigate(-1)}
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <ArrowUturnLeftIcon className="h-5 w-5" />
            Back
          </button>
        </div>
      </div>

      {/* Action Buttons below header */}
      <div className="flex justify-end gap-3 px-10 mt-4">
        <button
          onClick={() => alert("Your Applications page coming soon!")}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow flex items-center gap-2 
                     transition-transform hover:scale-105 active:scale-95"
        >
          <ClipboardDocumentListIcon className="h-5 w-5" />
          Your Applications
        </button>
        <button
          onClick={() => alert("Holiday Calendar page coming soon!")}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow flex items-center gap-2 
                     transition-transform hover:scale-105 active:scale-95"
        >
          <BuildingOffice2Icon className="h-5 w-5" />
          Holiday Calendar
        </button>
      </div>

      {/* Request Form */}
      <div className="flex justify-center px-4 mb-12 mt-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-8 border border-indigo-200 space-y-6 text-base"
        >
          <h3 className="text-xl font-bold text-indigo-700 mb-4 flex items-center gap-2 justify-center">
            <PencilSquareIcon className="h-6 w-6 text-indigo-700" />
            Submit New Request
          </h3>

          {/* Name & Employee ID in one row */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <label className="text-gray-700 font-semibold">Name:</label>
              <span className="text-red-600 font-bold">{user}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-700 font-semibold">Employee ID:</label>
              <span className="text-red-600 font-bold">{employeeId}</span>
            </div>
          </div>

          {/* Application Type */}
          <div className="flex flex-col">
            <label className="text-gray-700 font-semibold mb-1">
              Application Type
            </label>
            <select
              value={applicationType}
              onChange={(e) => setApplicationType(e.target.value)}
              className="px-3 py-2 text-sm border-2 border-indigo-300 rounded-lg shadow-sm 
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            >
              <option value="">Select type</option>
              <option value="Half Day">Half Day</option>
              <option value="Leave">Leave</option>
              <option value="Absent">Absent</option>
              <option value="Others">Others</option>
            </select>
          </div>

          {/* Dates + Times in single row */}
          <div className="grid grid-cols-4 gap-4">
            <div className="flex flex-col">
              <label className="text-gray-700 font-semibold mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={todayStr}
                className="px-2 py-2 text-sm border-2 border-indigo-300 rounded-lg shadow-sm 
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
              />
            </div>

            <div className="flex flex-col">
              <label className="text-gray-700 font-semibold mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || todayStr}
                className="px-2 py-2 text-sm border-2 border-indigo-300 rounded-lg shadow-sm 
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
              />
            </div>

            <div className="flex flex-col">
              <label className="text-gray-700 font-semibold mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="px-2 py-2 text-sm border-2 border-indigo-300 rounded-lg shadow-sm 
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-gray-700 font-semibold mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="px-2 py-2 text-sm border-2 border-indigo-300 rounded-lg shadow-sm 
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Reason */}
          <div className="flex flex-col">
            <label className="text-gray-700 font-semibold mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows="4"
              placeholder="Enter your reason"
              className="px-3 py-2 text-sm border-2 border-indigo-300 rounded-lg shadow-sm 
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y min-h-[100px]"
              required
            ></textarea>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center mt-6">
            <button
              type="submit"
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow 
                         transition-transform hover:scale-105 active:scale-95 text-sm"
            >
              Submit Request
            </button>
          </div>
        </form>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default WorkApplication;