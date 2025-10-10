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
import { API_BASE } from "./config";

// This will be available everywhere in the file, no ESLint error, no duplicate
const parseLocalDate = (input) => {
  if (!input) return null;

  if (input instanceof Date) return input;

  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}/.test(input)) {
    const [y, m, d] = input.split("T")[0].split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0); // noon avoids timezone shift
  }

  try {
    const d = new Date(input);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  } catch {
    return new Date();
  }
};

function LogsReports() {
  const navigate = useNavigate();

 const [expandedRow, setExpandedRow] = useState(null);

  const [animating, setAnimating] = useState("");

  const [expandedAttendance, setExpandedAttendance] = useState([]);
  // Logs & Shifts
  const [logs, setLogs] = useState([]);
  const [holidays, setHolidays] = useState([]);
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
    setAnimating("fade-out");
    try {
      // Only fetch logs and shifts (holidays are already included inside hr_logs)
const [logsRes, shiftsRes] = await Promise.all([
  fetch(`${API_BASE}/hr_logs/?year=${selectedYear}&month=${selectedMonth}`),
  fetch(`${API_BASE}/shifts/?year=${selectedYear}&month=${selectedMonth}`),
]);

      // Parse responses
      const logsData = await logsRes.json();
      const shiftsData = await shiftsRes.json();

      // Apply small delay for fade animation
      setTimeout(() => {
        // Logs (expanded or normal)
        setLogs(logsData.expanded_logs || logsData.logs || []);

        // Shifts
        setShifts(shiftsData || []);

        // Holidays are now part of hr_logs response — no more 404 error
        setHolidays(logsData.holidays || []);

        // Animation
        setAnimating("fade-in");
      }, 300);
    } catch (err) {
      console.error("Error fetching data:", err);
      setAnimating("");
    }
  };

  fetchData();
}, [selectedYear, selectedMonth]);


// -----------------------------
// Fetch user attendance (Individual View)
// -----------------------------
const fetchUserAttendance = useCallback(async (empId) => {
  try {
    const url = `${API_BASE}/hr_logs/?year=${selectedYear}&month=${selectedMonth}&employee_id=${empId}`;
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


// Local display of date without timezone shift
const formatDate = (dateStr) => {
  if (!dateStr) return "-";

  const d = parseLocalDate(dateStr);

  return d.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Local-safe shift lookup
const getDecidedShift = (empId, dateStr) => {
  const d = parseLocalDate(dateStr);
  const normalized = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

  // Normalize holiday array
  const holidayArray = Array.isArray(holidays)
    ? holidays
    : holidays?.holidays || [];

  // Safely extract date regardless of field name
  const isHoliday = holidayArray.some((h) => {
    const rawDate =
      h.date || h.holiday_date || h.holiday || h.day || h.holidayDate;
    if (!rawDate) return false;
    const formatted = rawDate.split("T")[0];
    return formatted === normalized;
  });

  // If this day is a holiday → no planned shift
  if (isHoliday) return "-";

  // Otherwise normal shift lookup
  const shift = shifts.find(
    (s) => s.employee_id === empId && s.date === normalized
  );

  if (shift) {
    if (shift.start_time === "-" || shift.end_time === "-") return "-";
    return `${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}`;
  }

  return "-";
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
    const logDate = parseLocalDate(log.date);

    // --- Date filter ---
    if (selectedDate) {
      const logDateStr = parseLocalDate(log.date).toISOString().split("T")[0];
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
  const d = parseLocalDate(date);
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

const toggleRow = (i) => {
  setExpandedRow(expandedRow === i ? null : i);
};


  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
{/* Midnight Glass Header */}
<header className="relative w-full bg-gradient-to-r from-slate-800 via-gray-800 to-slate-900 text-white shadow-xl overflow-hidden border-b border-gray-700/30 mb-10">
  {/* Frosted glass overlay */}
  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 backdrop-blur-md"></div>

  {/* Header Content */}
  <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between px-6 sm:px-10 lg:px-16 py-4 sm:py-5">

    {/* Left: Logo + Title */}
    <div
      onClick={() => {
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
        FaceTrack <span className="font-light text-gray-300 ml-1">Reports</span>
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
        onClick={() => navigate("/hr-portal")}
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
<div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-10 overflow-x-auto">
  <table className="min-w-[900px] sm:min-w-full border-collapse text-xs sm:text-sm">
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
      [...expandedAttendance].sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date))
    )
  ).map(([weekStart, weekLogs], wi) => (
    <Fragment key={wi}>
      {/* Daily rows → show only current month */}
      {weekLogs
        .filter((log) => parseLocalDate(log.date).getMonth() + 1 === selectedMonth)
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
          const day = parseLocalDate(log.date).getDay(); // 0=Sun, 6=Sat
          const weekendClass =
            day === 6 ? "bg-red-50" : day === 0 ? "bg-pink-50" : "";

          // Today highlight
          const isToday =
            parseLocalDate(log.date).toDateString() === new Date().toDateString();

          return (
            <tr
  key={i}
  className={`text-center cursor-pointer hover:bg-indigo-50 transition ${weekendClass} ${
    isToday ? "today-glow" : ""
  }`}
  onClick={() => toggleRow(i)}
>
              <td className="p-2 border">{formatDate(log.date)}</td>
              <td className="p-2 border">{plannedStart || "-"}</td>
              <td className="p-2 border">{plannedEnd || "-"}</td>
              <td className="p-2 border">{log.check_in || "-"}</td>
              <td className="p-2 border">{log.check_out || "-"}</td>
              <td className="p-2 border">{log.break_time || "-"}</td>
              <td className="p-2 border">{log.actual_work || "-"}</td>

              {/* Calculated Late */}
<td
  key={`late-${i}`}
  className="p-2 border text-yellow-700"
>
  {(() => {
    const [plannedStart] = getDecidedShift(log.employee_id, log.date).split(" - ");

    // If no planned shift or no check-in
    if (!plannedStart || plannedStart === "-" || !log.check_in) return "-";

    const [ph, pm] = plannedStart.split(":").map(Number);
    const [ah, am] = log.check_in.split(":").map(Number);

    const plannedMins = ph * 60 + pm;
    const actualMins = ah * 60 + am;

    if (actualMins > plannedMins)
      return (
        <span style={{ animation: "wiggle 0.4s ease-in-out" }}>Yes</span>
      );
    return "No";
  })()}
</td>

{/* Calculated Early Leave */}
<td
  key={`early-${i}`}
  className="p-2 border text-orange-700"
>
  {(() => {
    const [, plannedEnd] = getDecidedShift(log.employee_id, log.date).split(" - ");

    // If no planned shift or no check-out
    if (!plannedEnd || plannedEnd === "-" || !log.check_out) return "-";

    const [ph, pm] = plannedEnd.split(":").map(Number);
    const [ah, am] = log.check_out.split(":").map(Number);

    const plannedMins = ph * 60 + pm;
    const actualMins = ah * 60 + am;

    if (actualMins < plannedMins)
      return (
        <span style={{ animation: "wiggle 0.4s ease-in-out" }}>Yes</span>
      );
    return "No";
  })()}
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
  {(() => {
    const logDate = parseLocalDate(log.date);
    const today = new Date();

// --- FUTURE DATES ---
if (logDate > today) {
  // Show approved future leave types (like 有給休暇, 欠勤, etc.)
  if (log.leave_reason && log.leave_reason.trim() !== "-") {
    return log.leave_reason;
  }

  // Show upcoming holidays
  if (log.holiday_name && log.holiday_name.trim() !== "-") {
    return `Holiday (${log.holiday_name})`;
  }

  // Otherwise just blank or dash
  return "-";
}

    // --- PAST OR TODAY ---
    if (log.status === "On Leave") {
      if (log.leave_reason && log.leave_reason.trim() !== "-") {
        return `On Leave (${log.leave_reason})`;
      }
      if (log.hr_notes && log.hr_notes.trim() !== "-") {
        return `On Leave (${log.hr_notes})`;
      }
    }

    if (log.status === "Worked on Holiday" && log.holiday_name) {
      return `Worked on Holiday (${log.holiday_name})`;
    }

    return log.status || "-";
  })()}
</td>
            </tr>
          );
        })}

      {/* Weekly Summary Row → only if last log is Sunday */}
      {(() => {
        const lastLog = weekLogs[weekLogs.length - 1];
        const lastDay = parseLocalDate(lastLog.date).getDay(); // JS: 0=Sunday
        if (lastDay !== 0) return null;

        const weekEnd = parseLocalDate(weekStart);
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
  {
    weekLogs.filter((l) => {
      const [plannedStart] = getDecidedShift(l.employee_id, l.date).split(" - ");
      if (!plannedStart || plannedStart === "-" || !l.check_in) return false;

      const [ph, pm] = plannedStart.split(":").map(Number);
      const [ah, am] = l.check_in.split(":").map(Number);
      const plannedMins = ph * 60 + pm;
      const actualMins = ah * 60 + am;

      return (
        ["Present", "Present on Saturday", "Present on Sunday", "Worked on Holiday"].includes(l.status) &&
        actualMins > plannedMins
      );
    }).length
  } Late
</td>

{/* Early Leave */}
<td className="p-2 border text-orange-700">
  {
    weekLogs.filter((l) => {
      const [, plannedEnd] = getDecidedShift(l.employee_id, l.date).split(" - ");
      if (!plannedEnd || plannedEnd === "-" || !l.check_out) return false;

      const [ph, pm] = plannedEnd.split(":").map(Number);
      const [ah, am] = l.check_out.split(":").map(Number);
      const plannedMins = ph * 60 + pm;
      const actualMins = ah * 60 + am;

      return (
        ["Present", "Present on Saturday", "Present on Sunday", "Worked on Holiday"].includes(l.status) &&
        actualMins < plannedMins
      );
    }).length
  } Early
</td>

            {/* Overtime */}
            <td className="p-2 border text-blue-700 w-48">
              {(() => {
                // --- Daily Overtime (sum of per-day >8h) ---
                const dailyOvertimeMins = weekLogs.reduce((acc, l) => {
                  if (!l.actual_work || l.actual_work === "-") return acc;
                  const mins = parseWorkToMinutes(l.actual_work);
                    return acc + (mins > 480 ? mins - 480 : 0);
                  }, 0);
                  const dailyH = Math.floor(dailyOvertimeMins / 60);
                  const dailyM = dailyOvertimeMins % 60;

                // --- Weekly Overtime (if total > 40h = 2400 mins) ---
                const totalWeekMins = weekLogs.reduce((acc, l) => {
                  if (!l.actual_work || l.actual_work === "-") return acc;
                    return acc + parseWorkToMinutes(l.actual_work);
                  }, 0);
                  const weeklyOvertimeMins = totalWeekMins > 2400 ? totalWeekMins - 2400 : 0;
                const weeklyH = Math.floor(weeklyOvertimeMins / 60);
                const weeklyM = weeklyOvertimeMins % 60;
                    return (
                  <>
                  Daily OT: {dailyOvertimeMins > 0 ? `${dailyH}h ${dailyM}m` : "-"}
                <br />
                  Weekly OT: {weeklyOvertimeMins > 0 ? `${weeklyH}h ${weeklyM}m` : "-"}
                </>
                );
              })()}
            </td>

{/* Leave Count (includes approved future leaves) */}
<td className="p-2 border text-yellow-600">
  {
    weekLogs.filter((l) => {
      const s = (l.status || "").trim();
      const d = parseLocalDate(l.date);

      // --- Week range restriction ---
      const startOfWeek = parseLocalDate(weekStart);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      if (d < startOfWeek || d > endOfWeek) return false;

      // --- Skip if not in current month ---
      if (d.getMonth() + 1 !== selectedMonth) return false;

      // --- Skip common non-leave statuses ---
      if (
        ["Present", "Present on Saturday", "Present on Sunday", "Worked on Holiday", "Absent", "-", ""].includes(s)
      ) return false;

      // --- Skip holidays ---
      if (s.includes("Holiday") || s.includes("休日")) return false;

      // --- Recognize official leave types ---
      const leaveTypes = [
        "有給休暇（全日)",
        "有給休暇（半日)",
        "慶弔休暇",
        "欠勤",
        "直行",
        "直帰",
        "直行直帰",
        "出張",
        "遅刻",
        "早退",
        "振替休日",
        "早出",
      ];

      // Count future dates only if it's an approved leave type
      const isLeave = leaveTypes.some((t) => s.includes(t));
      if (parseLocalDate(l.date) > new Date() && !isLeave) return false;

      return isLeave;
    }).length
  } Leave
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
      if (!plannedStart || plannedStart === "-" || !l.check_in) return false;

      // Parse time safely
      const [ph, pm] = plannedStart.split(":").map(Number);
      const [ah, am] = l.check_in.split(":").map(Number);

      // Compare properly by minutes
      const plannedMins = ph * 60 + pm;
      const actualMins = ah * 60 + am;

      return (
        ["Present", "Present on Saturday", "Present on Sunday", "Worked on Holiday"].includes(l.status) &&
        actualMins > plannedMins
      );
    }).length
  } Late
</td>

        {/* Early Leave Count */}
<td className="p-2 border">
  {
    userAttendance.filter((l) => {
      const [, plannedEnd] = getDecidedShift(l.employee_id, l.date).split(" - ");
      if (!plannedEnd || plannedEnd === "-" || !l.check_out) return false;

      const [ph, pm] = plannedEnd.split(":").map(Number);
      const [ah, am] = l.check_out.split(":").map(Number);

      const plannedMins = ph * 60 + pm;
      const actualMins = ah * 60 + am;

      return (
        ["Present", "Present on Saturday", "Present on Sunday", "Worked on Holiday"].includes(l.status) &&
        actualMins < plannedMins
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
{/* Leave Count (includes all approved leaves in this month, even future) */}
<td className="p-2 border text-yellow-600">
  {
    userAttendance.filter((l) => {
      const s = (l.status || "").trim();
      const d = parseLocalDate(l.date);

      // --- Include only dates within selected month ---
      if (d.getMonth() + 1 !== selectedMonth) return false;

      // --- Skip irrelevant statuses ---
      if (
        ["Present", "Present on Saturday", "Present on Sunday", "Worked on Holiday", "Absent", "-", ""].includes(s)
      ) return false;

      // --- Skip holidays ---
      if (s.includes("Holiday") || s.includes("休日")) return false;

      // --- Official leave types (same as weekly) ---
      const leaveTypes = [
        "有給休暇（全日)",
        "有給休暇（半日)",
        "慶弔休暇",
        "欠勤",
        "直行",
        "直帰",
        "直行直帰",
        "出張",
        "遅刻",
        "早退",
        "振替休日",
        "早出",
      ];

      // Count it as leave only if it matches an official leave type
      return leaveTypes.some((t) => s.includes(t));
    }).length
  } Leave
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
  tr:hover {
  background-color: #a3afd2ff;
  transition: background-color 0.3s ease;
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
<div className="max-w-7xl w-full mx-auto px-4 sm:px-6 mb-6">
<div className="flex flex-wrap justify-center sm:justify-between items-center gap-4 sm:gap-6 bg-white p-4 sm:p-5 rounded-lg shadow text-base sm:text-lg text-center">    {/* Search */}
    <div className="flex items-center gap-2">
      <MagnifyingGlassIcon className="h-6 w-6 text-indigo-600" />
<input
  type="text"
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  placeholder="Search logs..."
  className="flex-1 sm:flex-none w-full sm:w-64 px-3 py-2 border rounded-md shadow-sm text-sm sm:text-base focus:ring-2 focus:ring-indigo-400 text-center placeholder:text-center"
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
  className="px-3 py-2 border rounded-md text-sm sm:text-base w-44 sm:w-auto text-center"
/>

    {/* Quick Filters */}
    <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-center">
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
  className="px-3 py-2 border rounded-md text-sm sm:text-base w-44 sm:w-auto text-center"
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
  className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md shadow text-sm sm:text-base font-semibold w-full sm:w-auto"
>
      <ArrowPathIcon className="h-5 w-5" />
      Reset
    </button>
  </div>
</div>

          {/* Logs Table */}
          <div className="max-w-7xl w-full mx-auto px-2 sm:px-6 flex-grow mb-12">
            <div className="overflow-x-auto rounded-xl shadow-lg bg-white 
                  w-[95%] sm:w-[90%] md:w-full mx-auto">
              <table className="min-w-[800px] sm:min-w-full border-collapse text-sm sm:text-lg">
              <thead>
                <tr className="bg-indigo-500 text-white text-xs sm:text-sm md:text-base lg:text-lg">
                  <th className="p-2 sm:p-3 md:p-4 cursor-pointer" onClick={() => requestSort("date")}>
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
      </div>

            {/* Pagination */}
            <div className="flex flex-wrap justify-center sm:justify-between items-center gap-3 mt-6 px-2 text-center">
<button
  disabled={currentPage === 1}
  onClick={() => setCurrentPage((prev) => prev - 1)}
  className={`px-3 sm:px-4 py-2 rounded-md font-semibold shadow text-sm sm:text-base ${
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
  className={`px-3 sm:px-4 py-2 rounded-md font-semibold shadow text-sm sm:text-base ${
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