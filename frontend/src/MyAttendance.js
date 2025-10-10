import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUturnLeftIcon } from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/solid";
import { API_BASE } from "./config";

function MyAttendance() {
  const navigate = useNavigate();

  const user = localStorage.getItem("user");
  const employeeId = localStorage.getItem("employeeId");

  const [attendanceData, setAttendanceData] = useState([]);
  const [shifts, setShifts] = useState([]); 
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState({ show: false, message: "", type: "" });

  // Protect route
  useEffect(() => {
    if (!user || !employeeId) {
      navigate("/work-application-login", { replace: true });
    }
  }, [user, employeeId, navigate]);

  // Months dropdown
  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(0, i).toLocaleString("default", { month: "long" })
  );

  // Fetch attendance + shifts
const fetchAttendance = useCallback(
  async (month, year) => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const [attRes, shiftRes] = await Promise.all([
        fetch(
          `${API_BASE}/attendance/my-attendance?employee_id=${employeeId}&month=${month}&year=${year}`
        ),
        fetch(`${API_BASE}/shifts?year=${year}&month=${month}`)
      ]);

      const attData = await attRes.json();
      const shiftData = await shiftRes.json();

      if (!attRes.ok) throw new Error(attData.error || "Failed to fetch attendance");

      setAttendanceData(attData);
      setShifts(shiftData);
    } catch (err) {
      console.error("❌ Error fetching attendance:", err);
      setPopup({
        show: true,
        message: "❌ Failed to fetch attendance.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  },
  [employeeId] // depend only on employeeId
);

// Call fetchAttendance whenever month/year changes
useEffect(() => {
  fetchAttendance(selectedMonth, selectedYear);
}, [fetchAttendance, selectedMonth, selectedYear]); // now valid

  // Overtime per day (>8h)
  const calculateOvertime = (totalWork) => {
    if (!totalWork || totalWork === "-") return "-";
    const [h, m] = totalWork.split("h");
    const hours = parseInt(h.trim(), 10) || 0;
    const minutes = parseInt(m?.replace("m", "").trim(), 10) || 0;
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes <= 480) return "-"; 
    const otMinutes = totalMinutes - 480;
    const otHrs = Math.floor(otMinutes / 60);
    const otMins = otMinutes % 60;
    return `${otHrs}h ${otMins}m`;
  };

  // Helper: format local date as YYYY-MM-DD
  const formatDateLocal = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Get all days in selected month
  const getAllDaysInMonth = (month, year) => {
    const date = new Date(year, month - 1, 1);
    const days = [];
    while (date.getMonth() === month - 1) {
      days.push(new Date(date)); // keep as Date object
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

// Helper: get decided shift
const getDecidedShift = (empId, dateStr) => {
  const shift = shifts.find(
    (s) => s.employee_id === empId && s.date === dateStr
  );

  if (shift) {
    if (shift.start_time === "-" || shift.end_time === "-") return "-";
    return `${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}`;
  }

  //If no shift exists in DB → return "-"
  return "-";
};

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
{/* Midnight Glass Header */}
<header className="relative w-full bg-gradient-to-r from-slate-800 via-gray-800 to-slate-900 text-white shadow-xl overflow-hidden border-b border-gray-700/30">
  {/* Frosted glass overlay */}
  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 backdrop-blur-md"></div>

  {/* Header Content */}
  <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between px-6 sm:px-10 lg:px-16 py-4 sm:py-5">
    
    {/* Left: Logo + Title */}
    <div
      onClick={() => navigate("/", { replace: true })}
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

    {/* Right: DateTime + Back Button */}
    <div className="flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-4 mt-3 sm:mt-0">
      {/* DateTime */}
      <div className="text-center text-sm sm:text-base md:text-lg font-semibold text-white tracking-wide drop-shadow-md order-2 sm:order-1">
        <HeaderDateTime />
      </div>

      {/* Back Button */}
      <button
        onClick={() => navigate("/work-application", { replace: true })}
        className="order-1 sm:order-2 px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 via-rose-500 to-pink-400 
                   hover:from-red-600 hover:to-pink-500 text-white font-semibold shadow-lg hover:shadow-xl 
                   transition-all duration-300 flex items-center gap-2"
      >
        <ArrowUturnLeftIcon className="h-5 w-5 text-white" />
        Back
      </button>
    </div>
  </div>
</header>

      {/* Page Title */}
      <h2 className="text-2xl sm:text-3xl font-bold text-indigo-700 text-center mt-6 sm:mt-8 mb-4 sm:mb-6 flex items-center justify-center gap-2">
        <ClipboardDocumentCheckIcon className="h-8 w-8 text-indigo-700" /> 
        My Attendance Records
      </h2>

      {/* Attendance Box */}
      <div className="flex justify-center px-6 mb-12">
        <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-5xl border border-indigo-200">
          {/* User Info */}
          <div className="flex flex-col sm:flex-row justify-between items-center text-center sm:text-left gap-2 sm:gap-0 mb-6">
            <p className="text-lg text-gray-800">
              <b>Name:</b>{" "}
              <span className="text-indigo-700 font-semibold">{user}</span>
            </p>
            <p className="text-lg text-gray-800">
              <b>Employee ID:</b>{" "}
              <span className="text-indigo-700 font-semibold">{employeeId}</span>
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 items-center justify-center sm:justify-start">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-4 py-2 border rounded-lg shadow focus:ring-2 focus:ring-indigo-500"
            >
              {months.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border rounded-lg shadow focus:ring-2 focus:ring-indigo-500"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(
                (y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Attendance Table */}
          {loading ? (
            <p className="text-center text-gray-600">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
  <table className="min-w-[700px] sm:min-w-full border-collapse text-xs sm:text-sm">
              <thead className="sticky top-0 bg-gray-100 sm:bg-gray-200 z-30 shadow-md border-b border-gray-300">
                <tr className="bg-gray-200 text-center text-xs sm:text-sm md:text-base">
                  <th className="p-2 border">Date</th>
                  <th className="p-2 border">Decided Shift</th>
                  <th className="p-2 border">Check-in</th>
                  <th className="p-2 border">Check-out</th>
                  <th className="p-2 border">Total Work (Hr)</th>
                  <th className="p-2 border">Overtime (Hr)</th>
                  <th className="p-2 border">Status</th>
                </tr>
              </thead>
              <tbody>
  {getAllDaysInMonth(selectedMonth, selectedYear).map((day, i) => {
    const log = attendanceData.find(
      (l) => formatDateLocal(new Date(l.date)) === formatDateLocal(day)
    );
    const dateStr = formatDateLocal(day);
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const dayName = day.toLocaleDateString("en-US", { weekday: "long" });

    // Weekend highlight classes
    const weekendClass =
      day.getDay() === 0 ? "bg-red-100" : day.getDay() === 6 ? "bg-pink-100" : "";

    return (
      <tr key={i} className={`text-center ${weekendClass}`}>
        {/* Date + Day */}
        <td className="p-2 border font-semibold">
          {day.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}{" "}
          ({dayName})
        </td>

        {/* Decided shift */}
        <td className="p-2 border">{getDecidedShift(employeeId, dateStr)}</td>

        {/* Check-in/out */}
        <td className="p-2 border">
          {log?.check_in
            ? new Date(log.check_in).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
              : "-"}
        </td>
        <td className="p-2 border">
          {log?.check_out
            ? new Date(log.check_out).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-"}
        </td>
        <td className="p-2 border">{log?.total_work || "-"}</td>
        <td className="p-2 border">{calculateOvertime(log?.total_work)}</td>

        {/* Status */}
        <td
          className={`p-2 border font-bold ${
            log?.status === "Present"
              ? "text-green-600"
              : log?.status === "Absent"
              ? "text-red-600"
              : log?.status === "On Leave"
              ? "text-yellow-600"
              : log?.status === "Worked on Holiday"
              ? "text-blue-600"
              : log?.status === "Present on Sunday"
              ? "text-purple-600"
              : log?.status === "Present on Saturday"
              ? "text-pink-600"
              : log?.status === "Holiday"
              ? "text-gray-500"
              : isWeekend
              ? "text-red-600"
              : "text-gray-700"
          }`}
        >
          {log?.status || (isWeekend ? dayName : "-")}
        </td>
      </tr>
    );
  })}
</tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {/* Popup */}
      {popup.show && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full text-center">
            <p
              className={`font-bold text-lg ${
                popup.type === "success"
                  ? "text-green-600"
                  : popup.type === "error"
                  ? "text-red-600"
                  : "text-blue-600"
              }`}
            >
              {popup.message}
            </p>
            <button
              onClick={() => setPopup({ show: false, message: "", type: "" })}
              className="mt-4 px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg shadow"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default MyAttendance;