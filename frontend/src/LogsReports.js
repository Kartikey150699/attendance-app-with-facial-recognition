import { useState, useEffect, useMemo, useCallback } from "react";
import React, { Fragment } from "react"; 
import { useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";

function LogsReports() {
  const navigate = useNavigate();

  const [animating, setAnimating] = useState("");

  const [expandedAttendance, setExpandedAttendance] = useState([]);
  // Logs & Shifts
  const [logs, setLogs] = useState([]);
  const [shifts, setShifts] = useState([]);

  // Individual user view
  const [selectedUser, setSelectedUser] = useState(null);
  const [userAttendance, setUserAttendance] = useState([]);

  // Filters
  const today = useMemo(() => new Date(), []);
  // change year and month
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const todayStr = today.toISOString().split("T")[0];
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "" });
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [quickFilter, setQuickFilter] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

// -----------------------------
// Fetch logs + shifts for selected month/year (Main View)
// -----------------------------
useEffect(() => {
  const fetchData = async () => {
    // Start fade-out animation
    setAnimating("fade-out");

    try {
      const [logsRes, shiftsRes] = await Promise.all([
        fetch(
          `http://localhost:8000/hr_logs?year=${selectedYear}&month=${selectedMonth}`
        ),
        fetch(
          `http://localhost:8000/shifts?year=${selectedYear}&month=${selectedMonth}`
        ),
      ]);

      if (!logsRes.ok || !shiftsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const logsData = await logsRes.json();
      const shiftsData = await shiftsRes.json();

      // Wait for fade-out to finish before swapping data
      setTimeout(() => {
        setLogs(logsData.expanded_logs || logsData.logs || []);
        setShifts(shiftsData);

        // Trigger fade-in after data loads
        setAnimating("fade-in");
      }, 300); // match fade-out duration
    } catch (err) {
      console.error("Error fetching logs/shifts:", err);
      setAnimating(""); // reset animation if error
    }
  };

  fetchData();
}, [selectedYear, selectedMonth]);
// -----------------------------
// Fetch user attendance (Individual View)
// -----------------------------
const fetchUserAttendance = useCallback(async (empId) => {
  try {
    const url = `http://localhost:8000/hr_logs?year=${selectedYear}&month=${selectedMonth}&employee_id=${empId}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch user logs: ${res.status}`);
    }

    const data = await res.json();

    if (Array.isArray(data)) {
      // Old backend style (only logs array)
      setUserAttendance(data);
    } else {
      // New backend style (logs + monthly_summary object)
      setUserAttendance(data.logs ?? []);
      setExpandedAttendance(data.expanded_logs ?? []); 
    }
  } catch (err) {
    console.error("Error fetching user attendance:", err.message);
    setUserAttendance([]);
  }
}, [selectedYear, selectedMonth]); 

useEffect(() => {
  if (selectedUser) {
    fetchUserAttendance(selectedUser.employee_id);
  }
}, [selectedUser, fetchUserAttendance]); // clean dependencies

  // Helpers
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  };

  const getDecidedShift = (empId, date) => {
    const shift = shifts.find((s) => s.employee_id === empId && s.date === date);
    if (shift) {
      if (shift.start_time === "-" || shift.end_time === "-") return "-";
      return `${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}`;
    }
    const d = new Date(date);
    if (d.getDay() === 0 || d.getDay() === 6) return "-";
    return "10:00 - 19:00";
  };

  // Sorting
  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    } else if (sortConfig.key === key && sortConfig.direction === "descending") {
      direction = "";
    }
    setSortConfig({ key, direction });
  };

  const getArrow = (key) => {
    if (sortConfig.key !== key) return "";
    if (sortConfig.direction === "ascending") return "▲";
    if (sortConfig.direction === "descending") return "▼";
    return "";
  };

  // Filter + sort
  const filteredLogs = logs
  .filter((log) => {
    const logDate = new Date(log.date);

    // --- Fix: Date filter ---
    if (selectedDate) {
      const logDateStr = new Date(log.date).toISOString().split("T")[0];
      if (logDateStr !== selectedDate) return false;
    }

    // --- Week filter ---
    if (quickFilter === "week") {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      if (logDate < startOfWeek || logDate > endOfWeek) return false;
    }

    // --- Month filter ---
    if (quickFilter === "month") {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      if (logDate < startOfMonth || logDate > endOfMonth) return false;
    }

    return true;
  })
  .filter((log) =>
    Object.values(log).join(" ").toLowerCase().includes(search.toLowerCase())
  )
  .sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    const dir = sortConfig.direction === "ascending" ? 1 : -1;
    return a[sortConfig.key] > b[sortConfig.key] ? dir : -dir;
  });

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentRows = filteredLogs.slice(startIndex, startIndex + rowsPerPage);

const resetFilters = () => {
  setSearch("");
  setSortConfig({ key: "", direction: "" });
  setCurrentPage(1);
  setRowsPerPage(10);
  setSelectedDate(todayStr);
  setQuickFilter(null);

  // Reset month & year to current
  setSelectedMonth(today.getMonth() + 1);
  setSelectedYear(today.getFullYear());
};

// Convert "HH:MM" or "HH:MM:SS" to minutes
const parseWorkToMinutes = (work) => {
  if (!work || work === "-") return 0;
  const parts = work.split(":").map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]; // HH:MM
  }
  if (parts.length === 3) {
    return parts[0] * 60 + parts[1]; // ignore seconds
  }
  return 0;
};

function getWeekStart(date) {
  const d = new Date(date);
  let day = d.getDay(); // 0=Sun, 1=Mon...6=Sat

  // remap: make Monday=0, Sunday=6
  day = (day + 6) % 7;

  // shift back to Monday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);

  // Use local date instead of UTC to avoid off-by-one day
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function groupByWeeks(logs) {
  const weeks = {};
  logs.forEach((l) => {
    const weekKey = getWeekStart(l.date); // start of week (Monday)
    if (!weeks[weekKey]) weeks[weekKey] = [];
    weeks[weekKey].push(l);
  });
  return weeks;
}


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
            navigate("/admin-login", { replace: true });
            navigate("/", { replace: false });
          }}
          className="text-5xl font-bold text-blue-900 cursor-pointer hover:text-blue-700 transition-colors"
        >
          FaceTrack Attendance
        </h1>
        <div className="absolute right-10">
          <button
            onClick={() => navigate("/hr-portal")}
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <ArrowUturnLeftIcon className="h-5 w-5" /> Back
          </button>
        </div>
      </div>

      {/* Individual OR Main View */}
      {selectedUser ? (
        /* ------------------ Individual User View ------------------ */
        <div className="max-w-6xl w-full mx-auto px-6 py-10 flex-grow">
          <h2 className="text-3xl font-bold text-indigo-700 mb-4">
            {selectedUser.name} ({selectedUser.employee_id})
          </h2>
          <p className="mb-6 text-2xl text-gray-700">
            <b>Department:</b> {selectedUser.department || "-"}
          </p>

{/* Controls Row: Month, Year, Close */}
<div className="flex items-center gap-4 mb-6">
  {/* Month Selector */}
  <select
    value={selectedMonth}
    onChange={(e) => setSelectedMonth(Number(e.target.value))}
    className="px-3 py-2 border rounded-md text-base"
  >
    {[
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ].map((m, idx) => (
      <option key={idx + 1} value={idx + 1}>
        {m}
      </option>
    ))}
  </select>

  {/* Year Selector */}
  <select
    value={selectedYear}
    onChange={(e) => setSelectedYear(Number(e.target.value))}
    className="px-3 py-2 border rounded-md text-base"
  >
    {Array.from({ length: 6 }, (_, i) => today.getFullYear() - 3 + i).map((year) => (
      <option key={year} value={year}>
        {year}
      </option>
    ))}
  </select>

  {/* Close Button - pushed right */}
  <button
    onClick={() => {
      setSelectedUser(null);
      setUserAttendance([]);
    }}
    className="ml-auto px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 flex items-center gap-2"
  >
    <XMarkIcon className="h-5 w-5" /> Close
  </button>
</div>

{/* ------------------- Attendance + Summary Table ------------------- */}
<div className="bg-white rounded-lg shadow p-6 mb-10">
  <table className="min-w-full border-collapse text-sm">
    <thead className="bg-gray-200 text-gray-700 sticky top-0 z-10">
      <tr>
        <th className="p-2 border">Date</th>
        <th className="p-2 border">Planned Start</th>
        <th className="p-2 border">Planned End</th>
        <th className="p-2 border">Check In</th>
        <th className="p-2 border">Check Out</th>
        <th className="p-2 border">Break (Hr)</th>
        <th className="p-2 border">Actual Work (Hr)</th>
        <th className="p-2 border">Late</th>
        <th className="p-2 border">Early Leave</th>
        <th className="p-2 border">Overtime (Hr)</th>
        <th className="p-2 border">Status</th>
      </tr>
    </thead>

<tbody className={animating}>
  {Object.entries(
    groupByWeeks(
      [...expandedAttendance].sort((a, b) => new Date(a.date) - new Date(b.date))
    )
  ).map(([weekStart, weekLogs], wi) => (
    <Fragment key={wi}>
      {/* Daily rows → show only current month */}
      {weekLogs
        .filter((log) => new Date(log.date).getMonth() + 1 === selectedMonth)
        .map((log, i) => {
          const [plannedStart, plannedEnd] = getDecidedShift(
            log.employee_id,
            log.date
          ).split(" - ");

          // --- Overtime (still frontend-calculated) ---
          let overtime = "-";
          if (log.actual_work && log.actual_work !== "-") {
            const mins = parseWorkToMinutes(log.actual_work);
            const overtimeMins = mins > 480 ? mins - 480 : 0;
            overtime =
              overtimeMins > 0
                ? `${Math.floor(overtimeMins / 60)}h ${overtimeMins % 60}m`
                : "-";
          }

          // Weekend highlight (Sat & Sun)
          const day = new Date(log.date).getDay(); // 0=Sun, 6=Sat
          const weekendClass =
            day === 6 ? "bg-red-50" : day === 0 ? "bg-pink-50" : "";

          // Today highlight
          const isToday =
            new Date(log.date).toDateString() === new Date().toDateString();

          return (
            <tr
              key={i}
              className={`text-center ${weekendClass} ${
                isToday ? "today-glow" : ""
              }`}
            >
              <td className="p-2 border">{formatDate(log.date)}</td>
              <td className="p-2 border">{plannedStart || "-"}</td>
              <td className="p-2 border">{plannedEnd || "-"}</td>
              <td className="p-2 border">{log.check_in || "-"}</td>
              <td className="p-2 border">{log.check_out || "-"}</td>
              <td className="p-2 border">{log.break_time || "-"}</td>
              <td className="p-2 border">{log.actual_work || "-"}</td>

              {/* Backend-provided late */}
              <td
                key={`late-${log.late}-${i}`}
                className="p-2 border text-yellow-700"
                style={
                  log.late === "Yes"
                    ? { animation: "wiggle 0.4s ease-in-out" }
                    : {}
                }
              >
                {log.late || "-"}
              </td>

              {/* Backend-provided early_leave */}
              <td
                key={`early-${log.early_leave}-${i}`}
                className="p-2 border text-orange-700"
                style={
                  log.early_leave === "Yes"
                    ? { animation: "wiggle 0.4s ease-in-out" }
                    : {}
                }
              >
                {log.early_leave || "-"}
              </td>

              {/* Overtime (frontend calculated) */}
              <td
                className={`p-2 border text-blue-700 ${
                  overtime !== "-" ? "overtime-glow" : ""
                }`}
              >
                {overtime}
              </td>

              {/* Status with shimmer for holidays */}
              <td
                className={`p-2 border font-bold ${
                  log.status === "Present"
                    ? "text-green-600"
                    : log.status === "Absent"
                    ? "text-red-600"
                    : log.status === "On Leave"
                    ? "text-yellow-600"
                    : log.status === "Worked on Holiday"
                    ? "holiday-shimmer text-blue-600"
                    : log.status?.includes("Sunday")
                    ? "sunday-shimmer text-purple-600"
                    : log.status?.includes("Saturday")
                    ? "saturday-shimmer text-pink-600"
                    : "text-gray-600"
                }`}
              >
                {log.status}
              </td>
            </tr>
          );
        })}

      {/* Weekly Summary Row → only if last log is Sunday */}
      {(() => {
        const lastLog = weekLogs[weekLogs.length - 1];
        const lastDay = new Date(lastLog.date).getDay(); // JS: 0=Sunday
        if (lastDay !== 0) return null;

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        // show summary only if Sunday belongs to selected month
        if (weekEnd.getMonth() + 1 !== selectedMonth) return null;

        return (
          <tr className="weekly-summary bg-yellow-200 font-bold text-center">
            <td className="p-2 border">
              Weekly Summary ({formatDate(weekStart)} - {formatDate(weekEnd)})
            </td>
            <td className="p-2 border">-</td>
            <td className="p-2 border">-</td>

            {/* Worked Days */}
            <td className="p-2 border text-green-700">
              {
                weekLogs.filter((l) =>
                  ["Present", "Present on Saturday", "Present on Sunday", "Worked on Holiday"].includes(l.status)
                ).length
              } Worked
            </td>

            {/* Absent Days */}
            <td className="p-2 border text-red-600">
              {weekLogs.filter((l) => l.status === "Absent").length} Absent
            </td>

            <td className="p-2 border">-</td>

            {/* Total Actual Hours */}
            <td className="p-2 border">
              {(() => {
                const totalMins = weekLogs.reduce((acc, l) => {
                  if (!l.actual_work || l.actual_work === "-") return acc;
                  return acc + parseWorkToMinutes(l.actual_work);
                }, 0);
                const h = Math.floor(totalMins / 60);
                const m = totalMins % 60;
                return totalMins > 0 ? `${h}h ${m}m` : "-";
              })()}
            </td>

            {/* Late */}
            <td className="p-2 border text-yellow-700">
              {weekLogs.filter((l) => l.late === "Yes").length} Late
            </td>

            {/* Early Leave */}
            <td className="p-2 border text-orange-700">
              {weekLogs.filter((l) => l.early_leave === "Yes").length} Early
            </td>

            {/* Overtime */}
            <td className="p-2 border text-blue-700">
              {(() => {
                const overtimeMins = weekLogs.reduce((acc, l) => {
                  if (!l.actual_work || l.actual_work === "-") return acc;
                  const mins = parseWorkToMinutes(l.actual_work);
                  return acc + (mins > 480 ? mins - 480 : 0);
                }, 0);
                const h = Math.floor(overtimeMins / 60);
                const m = overtimeMins % 60;
                return overtimeMins > 0 ? `${h}h ${m}m` : "-";
              })()}
            </td>

            {/* Leave Count */}
            <td className="p-2 border text-yellow-600">
              {weekLogs.filter((l) => l.status === "On Leave").length} Leave
            </td>
          </tr>
        );
      })()}
    </Fragment>
  ))}
</tbody>

    {/* -------- Summary Row -------- */}
    <tfoot>
      <tr className="monthly-summary bg-indigo-200 font-bold text-center">
        <td className="p-2 border">Monthly Summary</td>
        <td className="p-2 border">-</td>
        <td className="p-2 border">-</td>

        {/* Worked Days */}
        <td className="p-2 border">
          {
            userAttendance.filter(
              (l) =>
                l.status === "Present" ||
                l.status === "Present on Saturday" ||
                l.status === "Present on Sunday" ||
                l.status === "Worked on Holiday"
            ).length
          } Worked
        </td>

        {/* Absent Days */}
        <td className="p-2 border">
          {userAttendance.filter((l) => l.status === "Absent").length} Absent
        </td>

        <td className="p-2 border">-</td>

        {/* Total Actual Hours */}
        <td className="p-2 border">
          {(() => {
            const totalMins = userAttendance.reduce((acc, l) => {
              if (!l.actual_work || l.actual_work === "-") return acc;
              return acc + parseWorkToMinutes(l.actual_work);
            }, 0);
            const h = Math.floor(totalMins / 60);
            const m = totalMins % 60;
            return totalMins > 0 ? `${h}h ${m}m` : "-";
          })()}
        </td>

        {/* Late Count */}
        <td className="p-2 border">
          {
            userAttendance.filter((l) => {
              const [plannedStart] = getDecidedShift(l.employee_id, l.date).split(" - ");
              return (
                (l.status === "Present" ||
                  l.status === "Present on Saturday" ||
                  l.status === "Present on Sunday" ||
                  l.status === "Worked on Holiday") &&
                l.check_in &&
                plannedStart &&
                plannedStart !== "-" &&
                l.check_in > plannedStart
              );
            }).length
          } Late
        </td>

        {/* Early Leave Count */}
        <td className="p-2 border">
          {
            userAttendance.filter((l) => {
              const [, plannedEnd] = getDecidedShift(l.employee_id, l.date).split(" - ");
              return (
                (l.status === "Present" ||
                  l.status === "Present on Saturday" ||
                  l.status === "Present on Sunday" ||
                  l.status === "Worked on Holiday") &&
                l.check_out &&
                plannedEnd &&
                plannedEnd !== "-" &&
                l.check_out < plannedEnd
              );
            }).length
          } Early
        </td>

        {/* Overtime total */}
        <td className="p-2 border">
          {(() => {
            const overtimeMins = userAttendance.reduce((acc, l) => {
              if (!l.actual_work || l.actual_work === "-") return acc;
              const mins = parseWorkToMinutes(l.actual_work);
              return acc + (mins > 480 ? mins - 480 : 0);
            }, 0);
            const h = Math.floor(overtimeMins / 60);
            const m = overtimeMins % 60;
            return overtimeMins > 0 ? `${h}h ${m}m` : "-";
          })()}
        </td>

        {/* Leave Count */}
        <td className="p-2 border">
          {userAttendance.filter((l) => l.status === "On Leave").length} Leave
        </td>
      </tr>
    </tfoot>
  </table>
  <style>
{`
  @keyframes pulseGlow {
  0%, 100% {
    background-color: #dcfce7; /* light green */
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.7); /* green glow */
  }
  50% {
    background-color: #bbf7d0; /* brighter green */
    box-shadow: 0 0 16px rgba(34, 197, 94, 0.9);
  }
}
.today-glow {
  animation: pulseGlow 2s infinite;
}

@keyframes overtimePulse {
  0%, 100% { background-color: #eff6ff; }
  50% { background-color: #dbeafe; }
}
.overtime-glow {
  animation: overtimePulse 2s infinite;
}
  @keyframes slideIn {
  from { transform: translateX(-50%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
.weekly-summary {
  animation: slideIn 0.6s ease-out;
}
  @keyframes wiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-2deg); }
  75% { transform: rotate(2deg); }
}
.late-anim, .early-anim {
  animation: wiggle 0.4s ease-in-out 1;
}
  @keyframes shimmer {
    0% { background-position: -200px 0; }
    100% { background-position: 200px 0; }
  }
  .holiday-shimmer {
    background: linear-gradient(
      to right,
      #bfdbfe 0%,
      #93c5fd 50%,
      #bfdbfe 100%
    );
    background-size: 400px 100%;
    animation: shimmer 2s linear infinite;
    color: #1e3a8a; /* Indigo text to contrast shimmer */
    font-weight: bold;
  }

  @keyframes summaryGlow {
    0%, 100% { box-shadow: 0 0 6px rgba(79, 70, 229, 0.5); }
    50% { box-shadow: 0 0 12px rgba(79, 70, 229, 0.9); }
  }
  .monthly-summary {
    animation: summaryGlow 3s infinite;
  }

  @keyframes fadeOut {
    to { opacity: 0; transform: translateY(-10px); }
  }
  .fade-out {
    animation: fadeOut 0.3s forwards;
  }
    @keyframes fadeOut {
    to { opacity: 0; transform: translateY(-10px); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .fade-out {
    animation: fadeOut 0.3s forwards;
  }
  .fade-in {
    animation: fadeIn 0.4s ease-out;
  }

@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}

.saturday-shimmer {
  background: linear-gradient(
    to right,
    #fbcfe8 0%,   /* light pink */
    #f472b6 50%,  /* brighter pink */
    #fbcfe8 100%
  );
  background-size: 400px 100%;
  animation: shimmer 2s linear infinite;
  color: #9d174d; /* Deep pink text */
  font-weight: bold;
}

.sunday-shimmer {
  background: linear-gradient(
    to right,
    #ddd6fe 0%,   /* light purple */
    #a78bfa 50%,  /* brighter purple */
    #ddd6fe 100%
  );
  background-size: 400px 100%;
  animation: shimmer 2s linear infinite;
  color: #4c1d95; /* Deep purple text */
  font-weight: bold;
}

`}
</style>
</div>
        </div>
      ) : (
        /* ------------------ Main Logs & Reports View ------------------ */
        <>
          {/* Page Title */}
          <div className="flex justify-center py-8">
            <h2 className="text-3xl font-bold text-indigo-700 flex items-center gap-2">
              <ChartBarIcon className="h-8 w-8 text-indigo-700" />
              Logs & Reports
            </h2>
          </div>

{/* Filters */}
<div className="max-w-7xl w-full mx-auto px-6 mb-6">
  <div className="flex flex-wrap gap-4 justify-between items-center bg-white p-5 rounded-lg shadow text-lg">
    {/* Search */}
    <div className="flex items-center gap-2">
      <MagnifyingGlassIcon className="h-6 w-6 text-indigo-600" />
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search logs..."
        className="px-4 py-2 border rounded-md shadow-sm text-base focus:ring-2 focus:ring-indigo-400"
      />
    </div>

    {/* Date Filter */}
    <input
      type="date"
      value={selectedDate}
      max={todayStr}
      onChange={(e) => {
        setSelectedDate(e.target.value);
        setQuickFilter(null);
      }}
      className="px-3 py-2 border rounded-md text-base"
    />

    {/* Quick Filters */}
    <div className="flex gap-2">
      <button
        onClick={() => {
          setQuickFilter("week");
          setSelectedDate("");
        }}
        className={`px-3 py-2 rounded-md font-semibold shadow ${
          quickFilter === "week"
            ? "bg-indigo-600 text-white"
            : "bg-gray-200 hover:bg-gray-300"
        }`}
      >
        This Week
      </button>
      <button
        onClick={() => {
          setQuickFilter("month");
          setSelectedDate("");
        }}
        className={`px-3 py-2 rounded-md font-semibold shadow ${
          quickFilter === "month"
            ? "bg-indigo-600 text-white"
            : "bg-gray-200 hover:bg-gray-300"
        }`}
      >
        This Month
      </button>
    </div>

    {/* Rows per page */}
    <div>
      <select
        value={rowsPerPage}
        onChange={(e) => setRowsPerPage(Number(e.target.value))}
        className="px-3 py-2 border rounded-md text-base"
      >
        {[10, 20, 50].map((num) => (
          <option key={num} value={num}>
            {num} rows
          </option>
        ))}
      </select>
    </div>

    {/* Reset */}
    <button
      onClick={resetFilters}
      className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md shadow text-base font-semibold"
    >
      <ArrowPathIcon className="h-5 w-5" />
      Reset
    </button>
  </div>
</div>

          {/* Logs Table */}
          <div className="max-w-7xl w-full mx-auto px-6 flex-grow mb-12">
            <table className="w-full border-collapse bg-white shadow-lg rounded-xl overflow-hidden text-lg">
              <thead>
                <tr className="bg-indigo-500 text-white text-lg">
                  <th className="p-4 cursor-pointer" onClick={() => requestSort("date")}>
                    Date {getArrow("date")}
                  </th>
                  <th className="p-4">Employee ID</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Decided Shift</th>
                  <th className="p-4">Check In</th>
                  <th className="p-4">Check Out</th>
                  <th className="p-4">Total Work</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
  {currentRows.length > 0 ? (
    currentRows.map((log, i) => (
      <tr key={i} className="text-center border-b">
        <td className="p-4">{formatDate(log.date)}</td>
        <td className="p-4">{log.employee_id}</td>
        <td
          className="p-4 text-indigo-600 font-bold cursor-pointer hover:underline"
          onClick={() => {
            setSelectedUser(log);
            fetchUserAttendance(log.employee_id);
          }}
        >
          {log.name}
        </td>
        <td className="p-4">{log.department || "-"}</td>
        <td className="p-4">{getDecidedShift(log.employee_id, log.date)}</td>
        <td className="p-4">{log.check_in || "-"}</td>
        <td className="p-4">{log.check_out || "-"}</td>

        {/* Use actual_work instead of total_work */}
        <td className="p-4">{log.actual_work || "-"}</td>

        <td
          className={`p-4 font-bold ${
            log.status === "Present"
              ? "text-green-600"
              : log.status === "Absent"
              ? "text-red-600"
              : log.status === "On Leave"
              ? "text-yellow-600"
              : log.status === "Worked on Holiday"
              ? "text-blue-600"
              : "text-gray-600"
          }`}
        >
          {log.status}
        </td>
      </tr>
    ))
  ) : (
    <tr>
      <td colSpan="9" className="p-6 text-gray-500 text-center">
        No logs available.
      </td>
    </tr>
  )}
</tbody>
            </table>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-6">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
                className={`px-4 py-2 rounded-md font-semibold shadow ${
                  currentPage === 1
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                Previous
              </button>
              <span className="text-lg font-semibold">
                Page {currentPage} of {totalPages || 1}
              </span>
              <button
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage((prev) => prev + 1)}
                className={`px-4 py-2 rounded-md font-semibold shadow ${
                  currentPage === totalPages || totalPages === 0
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <Footer />
    </div>
  );
}

export default LogsReports;