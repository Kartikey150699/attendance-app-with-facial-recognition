import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUturnLeftIcon } from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/solid";

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
          `http://127.0.0.1:8000/attendance/my-attendance?employee_id=${employeeId}&month=${month}&year=${year}`
        ),
        fetch(`http://127.0.0.1:8000/shifts?year=${year}&month=${month}`)
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

  // Overtime (>8h)
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
    const shift = shifts.find((s) => s.employee_id === empId && s.date === dateStr);
    if (shift) {
      if (shift.start_time === "-" || shift.end_time === "-") return "-";
      return `${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}`;
    }
    const d = new Date(dateStr);
    if (d.getDay() === 0 || d.getDay() === 6) return "-"; 
    return "10:00 - 19:00"; 
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md relative">
        <div className="absolute left-10 text-blue-800 text-xl font-bold">
          <HeaderDateTime />
        </div>
        <h1
          onClick={() => navigate("/", { replace: true })}
          className="text-5xl font-bold text-blue-900 cursor-pointer hover:text-blue-700 transition-colors"
        >
          FaceTrack Attendance
        </h1>
        <div className="absolute right-10">
          <button
            onClick={() => navigate("/work-application", { replace: true })}
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 
                       active:scale-95 transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <ArrowUturnLeftIcon className="h-5 w-5 text-white" />
            Back
          </button>
        </div>
      </div>

      {/* Page Title */}
      <h2 className="text-3xl font-bold text-indigo-700 text-center mt-8 mb-6 flex items-center justify-center gap-2">
        <ClipboardDocumentCheckIcon className="h-8 w-8 text-indigo-700" /> 
        My Attendance Records
      </h2>

      {/* Attendance Box */}
      <div className="flex justify-center px-6 mb-12">
        <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-5xl border border-indigo-200">
          {/* User Info */}
          <div className="flex justify-between items-center mb-6">
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
          <div className="flex gap-4 mb-6">
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
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-200 text-center">
                  <th className="p-2 border">Date</th>
                  <th className="p-2 border">Decided Shift</th>
                  <th className="p-2 border">Check-in</th>
                  <th className="p-2 border">Check-out</th>
                  <th className="p-2 border">Total Work</th>
                  <th className="p-2 border">Overtime</th>
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

                  return (
                    <tr key={i} className="text-center">
                      <td className="p-2 border font-semibold">
                        {day.toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="p-2 border">{getDecidedShift(employeeId, dateStr)}</td>
                      {isWeekend ? (
                        <td colSpan="5" className="p-2 border text-red-600 font-bold">
                          {day.getDay() === 0 ? "Sunday" : "Saturday"}
                        </td>
                      ) : (
                        <>
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
                          <td className="p-2 border">
                            {calculateOvertime(log?.total_work)}
                          </td>
                          <td className="p-2 border">{log?.status || "-"}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
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