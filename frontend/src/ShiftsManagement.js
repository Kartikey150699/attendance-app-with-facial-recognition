import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  ClockIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { API_BASE } from "./config";

function ShiftsManagement() {
  const [viewType, setViewType] = useState("weekly"); // default = weekly
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [editShift, setEditShift] = useState(null); // for modal
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);

  const [employeeGroups, setEmployeeGroups] = useState([]); // NEW

  // eslint-disable-next-line no-unused-vars
  const [groupDetails, setGroupDetails] = useState([]); // full group info with employees

  const [draggedGroup, setDraggedGroup] = useState(null);
  const [flashCell, setFlashCell] = useState(null);

  // Excel-style fill down for Group column
const [isFillingGroup, setIsFillingGroup] = useState(false);
const [fillStartIndex, setFillStartIndex] = useState(null);
const [fillHoverIndex, setFillHoverIndex] = useState(null);

const [isFillingShift, setIsFillingShift] = useState(false);
const [fillShiftOrigin, setFillShiftOrigin] = useState(null); // {empIndex, colIndex, start, end}
const [fillShiftTargets, setFillShiftTargets] = useState([]); // highlight cells

useEffect(() => {
  const fetchData = async () => {
    try {
      const [empRes, shiftRes, groupRes, mappingRes, groupFullRes] = await Promise.all([
        fetch(`${API_BASE}/users/active`),
        fetch(`${API_BASE}/shifts/`),
        fetch(`${API_BASE}/shift-groups/`),
        fetch(`${API_BASE}/shift-groups/employee-groups/`),
        fetch(`${API_BASE}/shift-groups/details/full`),
      ]);

      if (!empRes.ok || !shiftRes.ok || !groupRes.ok || !mappingRes.ok || !groupFullRes.ok)
        throw new Error("Failed to fetch data");

      const empData = await empRes.json();
      const shiftData = await shiftRes.json();
      const groupData = await groupRes.json();
      const mappingData = await mappingRes.json();
      const groupFullData = await groupFullRes.json();

      setEmployees(empData);
      setShifts(shiftData);
      setGroups(groupData);
      setEmployeeGroups(mappingData);
      setGroupDetails(groupFullData); // store full group details
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  fetchData();
}, []);

  // Helpers
  function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    return new Date(d.setDate(diff));
  }

 function formatDate(date) {
  if (!(date instanceof Date)) date = new Date(date);
  // Local-safe version (no UTC shift)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

  function getShiftHours(start, end) {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let total = (eh * 60 + em - (sh * 60 + sm)) / 60;
    if (total > 6) total -= 1;
    return total;
  }

  // Week dates
  const weekDates = [...Array(7)].map((_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

// Weekly Shifts (auto-refresh after group or week change)
const weeklyShifts = useMemo(() => {
  return employees.map((emp) => {
    let lateCount = 0; // count "yes" in this week

    const empShifts = weekDates.map((d) => {
      const shift = shifts.find(
        (s) => s.employee_id === emp.employee_id && s.date === formatDate(d)
      );

      if (shift) {
        // Normalize times like 00:00 → "-"
        const cleanStart =
          !shift.start_time ||
          shift.start_time === "-" ||
          shift.start_time === "00:00"
            ? "-"
            : shift.start_time.slice(0, 5);
        const cleanEnd =
          !shift.end_time ||
          shift.end_time === "-" ||
          shift.end_time === "00:00"
            ? "-"
            : shift.end_time.slice(0, 5);

        // if late=yes or is_late=yes → increment counter
        if (shift.late === "yes" || shift.is_late === "yes") {
          lateCount++;
        }

        return {
          date: shift.date,
          start: cleanStart,
          end: cleanEnd,
          hours:
            cleanStart === "-" || cleanEnd === "-"
              ? 0
              : getShiftHours(cleanStart, cleanEnd),
        };
      }

      // if no shift found → placeholder
      return { date: formatDate(d), start: "-", end: "-", hours: 0 };
    });

    // attach lateCount to each employee
    return { ...emp, shifts: empShifts, lateCount };
  });
}, [employees, shifts, weekDates]);

// Monthly summary
const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
const monthDates = [...Array(daysInMonth)].map((_, i) => {
  return new Date(currentYear, currentMonth, i + 1);
});

const monthlySummary = employees.map((emp) => {
  let totalShifts = 0;
  let totalHours = 0;

  monthDates.forEach((d) => {
    const day = d.getDay();
    const dateStr = formatDate(d);

    // Find if employee has an explicit shift in DB
    const shift = shifts.find(
      (s) => s.employee_id === emp.employee_id && s.date === dateStr
    );

    if (shift) {
      // Only count if not deleted
      if (shift.start_time !== "-" && shift.end_time !== "-") {
        totalShifts++;
        totalHours += getShiftHours(shift.start_time, shift.end_time);
      }
    } else {
      // Default only for weekdays, not for weekends
      if (day !== 0 && day !== 6) {
        totalShifts++;
        totalHours += getShiftHours("10:00", "19:00");
      }
    }
  });

  return { ...emp, totalShifts, totalHours };
});

    // Apply search filter to weekly & monthly
const filterBySearch = (list) =>
  list.filter(
    (emp) =>
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(search.toLowerCase()) ||
      (emp.department &&
        emp.department.toLowerCase().includes(search.toLowerCase()))
  );

const filteredWeeklyShifts = filterBySearch(weeklyShifts);
const filteredMonthlySummary = filterBySearch(monthlySummary);

  const today = new Date();

const assignGroup = async (employeeId, groupId) => {
  if (!groupId) return;

  try {
    // Assign group to employee
    const res = await fetch(`${API_BASE}/shift-groups/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      employee_id: employeeId,
      group_id: parseInt(groupId),
      apply_to_future: true, // Apply changes to future weeks
      week_start: formatDate(currentWeekStart), // Start from current visible week
      }),
    });

    if (!res.ok) throw new Error("Failed to assign group");
    console.log("✅ Group assigned");

// Delete all existing shifts for this week (parallel & safe)
await Promise.all(
  weekDates.map((d) =>
    fetch(
      `${API_BASE}/shifts/delete-by-date?employee_id=${employeeId}&date_=${formatDate(d)}`,
      { method: "DELETE" }
    ).catch(() => null)
  )
);

    // Get group schedule and assign clean shifts
    const group = groups.find((g) => g.id === parseInt(groupId));
    const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

    for (const d of weekDates) {
      const dayKey = dayKeys[d.getDay()];
      const times = group?.schedule?.[dayKey];

      // Clean up time values — no 00:00 allowed
      let start_time = "-";
      let end_time = "-";

      if (
        times &&
        Array.isArray(times) &&
        times.length === 2 &&
        times[0] &&
        times[1] &&
        !["00:00", "-", "0:00", "", null, undefined].includes(times[0]) &&
        !["00:00", "-", "0:00", "", null, undefined].includes(times[1])
      ) {
        start_time = times[0];
        end_time = times[1];
      }

      await fetch(`${API_BASE}/shifts/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          date_: formatDate(d),
          start_time,
          end_time,
          assigned_by: localStorage.getItem("currentAdmin") || "System",
        }),
      });
    }

    // Refresh data
    const [shiftRes, mappingRes] = await Promise.all([
      fetch(`${API_BASE}/shifts/`),
      fetch(`${API_BASE}/shift-groups/employee-groups/`),
    ]);

    let shiftData = await shiftRes.json();
    const mappingData = await mappingRes.json();

    // Convert ALL 00:00 values to "-" before setting state
    shiftData = shiftData.map((s) => {
      if (
        !s.start_time ||
        !s.end_time ||
        s.start_time === "00:00" ||
        s.end_time === "00:00" ||
        s.start_time === "0:00" ||
        s.end_time === "0:00"
      ) {
        return { ...s, start_time: "-", end_time: "-" };
      }
      return s;
    });

    setShifts(shiftData);
    setEmployeeGroups(mappingData);

    // Force React refresh
    setCurrentWeekStart((prev) => new Date(prev));
  } catch (err) {
    console.error("❌ Error assigning group:", err);
  }
};

// Save shift function (keep as-is below)
const saveShift = async () => {
  try {
    const response = await fetch(`${API_BASE}/shifts/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: editShift.employee_id,
        date_: editShift.date,
        start_time: editShift.start,
        end_time: editShift.end,
        assigned_by: localStorage.getItem("currentAdmin") || "System",
      }),
    });

    if (!response.ok) throw new Error("Failed to save shift");

    await response.json();

    // Re-fetch shifts immediately
    const shiftRes = await fetch(`${API_BASE}/shifts/`);
    const shiftData = await shiftRes.json();
    setShifts(shiftData);

    setEditShift(null);
  } catch (error) {
    console.error("Error saving shift:", error);
  }
};

useEffect(() => {
  const handleMouseUp = () => {
    if (isFillingGroup) {
      setIsFillingGroup(false);
      setFillStartIndex(null);
      setFillHoverIndex(null);
    }
    if (isFillingShift) {
      setIsFillingShift(false);
      setFillShiftOrigin(null);
      setFillShiftTargets([]);
    }
  };
  window.addEventListener("mouseup", handleMouseUp);
  return () => window.removeEventListener("mouseup", handleMouseUp);
}, [isFillingGroup, isFillingShift]);


const copyShiftToCell = async (employeeId, date_, start_time, end_time) => {
  try {
    await fetch(`${API_BASE}/shifts/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: employeeId,
        date_,
        start_time,
        end_time,
        assigned_by: localStorage.getItem("currentAdmin") || "System",
      }),
    });
  } catch (err) {
    console.error("Error copying shift:", err);
  }
};

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
            onClick={() => navigate("/admin-dashboard")}
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 
                       active:scale-95 transition-transform duration-200 text-white font-bold 
                       rounded-lg shadow flex items-center justify-center gap-2"
          >
            <ArrowUturnLeftIcon className="h-5 w-5 text-white" />
            <span>Back</span>
          </button>
        </div>
      </div>

{/* Title + Groups Button */}
<div className="relative flex justify-center items-center py-6">
  <h2 className="text-4xl font-bold text-indigo-700 flex items-center gap-3">
    <Cog6ToothIcon className="h-8 w-8 text-indigo-700" />
    Shifts Management
  </h2>

  {/* Groups Button — top-right corner below header */}
  <button
    onClick={() => navigate("/groups-management")}
    className="absolute right-10 top-10 px-10 py-2 rounded-lg font-semibold 
               bg-gradient-to-r from-indigo-400 to-indigo-600 
               text-white shadow-md 
               hover:from-indigo-500 hover:to-indigo-700 
               hover:scale-105 active:scale-95 
               transition-transform duration-200"
  >
    Groups
  </button>
</div>

{/* Group Overview Row */}
<div className="max-w-7xl mx-auto px-6 mb-8">
  <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-indigo-500">
    {groups.length === 0 ? (
      <p className="text-gray-500 text-sm">No groups found.</p>
    ) : (
      groups.map((g, index) => {
        const schedule = g.schedule || {};
        const grouped = {};

        const weekOrder = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
        const dayNames = {
          mon: "Mon",
          tue: "Tue",
          wed: "Wed",
          thu: "Thu",
          fri: "Fri",
          sat: "Sat",
          sun: "Sun",
        };

        weekOrder.forEach((day) => {
          if (schedule[day]) {
            const times = schedule[day];
            const key = Array.isArray(times) ? `${times[0]} - ${times[1]}` : "-";
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(dayNames[day]);
          }
        });

        // Catchy gradient palette
        const gradients = [
          "from-indigo-500 via-purple-500 to-pink-500",
          "from-blue-500 via-cyan-400 to-teal-400",
          "from-amber-500 via-orange-500 to-red-500",
          "from-green-500 via-emerald-400 to-lime-400",
          "from-rose-500 via-pink-500 to-fuchsia-500",
        ];
        const gradient = gradients[index % gradients.length];

        return (
          <div
            key={g.id}
            draggable
            onDragStart={() =>
  setDraggedGroup({
    id: g.id,
    name: g.name,
    schedule: g.schedule || {},
  })
}
            onDragEnd={() => setDraggedGroup(null)}
            className={`min-w-[230px] max-w-[250px] h-[100px] rounded-lg cursor-grab active:cursor-grabbing
                       bg-gradient-to-br ${gradient} text-white shadow-md p-3 flex flex-col justify-between
                       transition-all duration-300 ease-out
                       hover:scale-[1.06] hover:shadow-[0_0_15px_rgba(255,255,255,0.5)]
                       ${draggedGroup?.id === g.id ? "ring-4 ring-white ring-offset-2 ring-offset-indigo-400 scale-[1.08]" : ""}`}
          >
            <div>
              <h5 className="text-base font-bold mb-0.5 tracking-wide drop-shadow-sm">
                {g.name}
              </h5>

              <ul className="text-xs space-y-1 font-medium mt-1">
                {Object.entries(grouped).map(([time, days]) => (
                  <li key={time} className="drop-shadow-sm">
                    <div className="flex items-center gap-1">
                      <ClockIcon className="h-3.5 w-3.5 text-white opacity-90" />
                      <span className="text-sm font-semibold tracking-tight">{time}</span>
                    </div>
                    <div className="text-[11px] text-white/90 ml-5 leading-tight">
                      {days.join(", ")}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {g.description && (
              <div className="text-right text-[10px] text-white/80 italic truncate">
                {g.description}
              </div>
            )}
          </div>
        );
      })
    )}
  </div>
</div>

      {/* Filters + Search + Today (only weekly) */}
      <div className="max-w-6xl mx-auto px-6 mb-4">
        <div className="bg-white shadow rounded-lg p-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="font-semibold">View Type:</label>
            <select
              value={viewType}
              onChange={(e) => setViewType(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>

            {viewType === "weekly" && (
              <button
                onClick={() => setCurrentWeekStart(getStartOfWeek(new Date()))}
                className="px-4 py-2 bg-yellow-500 text-white rounded shadow hover:bg-yellow-600"
              >
                Today
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search by ID, name, or department"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border rounded w-64"
            />
          </div>
        </div>
      </div>

      {/* Period Label */}
      <div className="max-w-6xl mx-auto px-6 mb-4 text-center">
        {viewType === "weekly" ? (
          <h3 className="text-xl font-semibold text-gray-700">
            Week of{" "}
            {weekDates[0].toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            -{" "}
            {weekDates[6].toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </h3>
        ) : (
          <h3 className="text-xl font-semibold text-gray-700">
            {new Date(currentYear, currentMonth).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </h3>
        )}
      </div>

      {/* Monthly summary */}
      {viewType === "monthly" && (
        <div className="max-w-6xl mx-auto px-6 mb-6">
          <table className="w-full border border-gray-300 border-collapse bg-white shadow rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-indigo-500 text-white">
                <th className="p-3 border border-gray-300">Employee ID</th>
                <th className="p-3 border border-gray-300">Name</th>
                <th className="p-3 border border-gray-300">Department</th>
                <th className="p-3 border border-gray-300">Total Shifts</th>
                <th className="p-3 border border-gray-300">Total Hours</th>
              </tr>
            </thead>
            <tbody>
              {filteredMonthlySummary.map((emp, i) => (
                <tr key={i} className="text-center">
                  <td className="p-3 border border-gray-300">{emp.employee_id}</td>
                  <td className="p-3 border border-gray-300">{emp.name}</td>
                  <td className="p-3 border border-gray-300">{emp.department}</td>
                  <td className="p-3 border border-gray-300">{emp.totalShifts}</td>
                  <td className="p-3 border border-gray-300">{emp.totalHours}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Monthly navigation */}
          <div className="flex justify-between items-center mt-6">
            <button
              onClick={() => {
                if (currentMonth === 0) {
                  setCurrentMonth(11);
                  setCurrentYear(currentYear - 1);
                } else {
                  setCurrentMonth(currentMonth - 1);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded shadow hover:bg-indigo-600"
            >
              <ChevronLeftIcon className="h-5 w-5" /> Previous Month
            </button>
            <button
              onClick={() => {
                if (currentMonth === 11) {
                  setCurrentMonth(0);
                  setCurrentYear(currentYear + 1);
                } else {
                  setCurrentMonth(currentMonth + 1);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded shadow hover:bg-indigo-600"
            >
              Next Month <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

{/* Weekly table */}
{viewType === "weekly" && (
  <div className="max-w-7xl mx-auto px-6 mb-8 flex-grow">
    {/* Scrollable container */}
    <div
      ref={(el) => {
        if (!el) return;
        // Prevent page scroll when inner scroll is possible
        const handler = (e) => {
          const target = el.querySelector(".inner-scroll");
          if (!target) return;
          const scrollTop = target.scrollTop;
          const scrollHeight = target.scrollHeight;
          const height = target.clientHeight;
          const delta = e.deltaY;

          const atTop = scrollTop === 0;
          const atBottom = scrollTop + height >= scrollHeight - 1;

          // Only stop propagation if we can scroll inside
          if (
            (delta < 0 && !atTop) || // scrolling up, not at top
            (delta > 0 && !atBottom) // scrolling down, not at bottom
          ) {
            e.stopPropagation();
            e.preventDefault();
            target.scrollTop += delta;
          }
        };

        // attach once
        el.addEventListener("wheel", handler, { passive: false });
        return () => el.removeEventListener("wheel", handler);
      }}
      className="border border-gray-300 rounded-lg shadow-lg bg-white relative"
      style={{ height: "430px" }} // ~4 rows visible
    >
      <div
        className="inner-scroll overflow-y-auto overflow-x-auto force-scrollbar"
        style={{ height: "100%", paddingRight: "10px" }}
      >
        <style>{`
          /* Custom always-visible scrollbar */
          .force-scrollbar::-webkit-scrollbar {
            width: 10px;
          }
          .force-scrollbar::-webkit-scrollbar-track {
            background: #e5e7eb;
            border-radius: 8px;
          }
          .force-scrollbar::-webkit-scrollbar-thumb {
            background-color: #6366f1;
            border-radius: 8px;
          }
          .force-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: #4f46e5;
          }
          .force-scrollbar {
            scrollbar-color: #6366f1 #e5e7eb;
            scrollbar-width: thin;
          }
            /* Highlight cells while dragging */
.shift-fill-highlight {
  background-color: #c7d2fe !important; /* Indigo-200 */
  box-shadow: inset 0 0 0 2px #4f46e5;
}
        `}</style>

        <table className="w-full border-collapse text-base">
          <thead className="sticky top-0 bg-indigo-500 text-white shadow z-10">
            <tr>
              <th className="p-4 border border-gray-300">Employee ID</th>
              <th className="p-4 border border-gray-300">Name</th>
              <th className="p-4 border border-gray-300">Department</th>
              <th className="p-4 border border-gray-300">Group</th>
              {weekDates.map((d, i) => (
                <th
                  key={i}
                  className={`p-4 border border-gray-300 text-center ${
                    d.getDay() === 0 || d.getDay() === 6 ? "bg-red-600" : ""
                  } ${
                    formatDate(d) === formatDate(today)
                      ? "bg-yellow-200 text-black font-bold"
                      : ""
                  }`}
                >
                  {d.toLocaleDateString("en-US", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredWeeklyShifts.map((emp, i) => (
              <tr
                key={i}
                className="text-center even:bg-gray-50 transition-all duration-150"
              >
                <td className="p-4 border border-gray-300">{emp.employee_id}</td>
                <td className="p-4 border border-gray-300">{emp.name}</td>
                <td className="p-4 border border-gray-300">{emp.department}</td>

{/* Group cell: supports both Excel-style fill down and drag-drop from group box */}
<td
  className={`relative p-4 border border-gray-300 text-center select-none transition-all duration-200
    ${
      draggedGroup
        ? "border-dashed border-2 border-indigo-400 bg-indigo-50"
        : ""
    }
    hover:bg-indigo-50 ${
      isFillingGroup &&
      i >= Math.min(fillStartIndex ?? -1, fillHoverIndex ?? -1) &&
      i <= Math.max(fillStartIndex ?? -1, fillHoverIndex ?? -1)
        ? "bg-indigo-100 ring-2 ring-indigo-400"
        : ""
    }`}
  
  // Excel fill highlight tracking
  onMouseEnter={() => {
    if (isFillingGroup) setFillHoverIndex(i);
  }}
  
  // Drop from group info box
  onDragOver={(e) => e.preventDefault()}
  onDrop={async () => {
    if (draggedGroup) {
      await assignGroup(emp.employee_id, draggedGroup.id);
      const updatedMappings = await fetch(
        `${API_BASE}/shift-groups/employee-groups/`
      ).then((r) => r.json());
      setEmployeeGroups(updatedMappings);
      setDraggedGroup(null);

      // visual flash
      setFlashCell(emp.employee_id);
      setTimeout(() => setFlashCell(null), 700);
    }
  }}
  
  // Excel fill release logic
  onMouseUp={async () => {
    if (isFillingGroup && fillStartIndex !== null) {
      const start = Math.min(fillStartIndex, fillHoverIndex);
      const end = Math.max(fillStartIndex, fillHoverIndex);

      // find source employee's group
      const sourceEmp = filteredWeeklyShifts[fillStartIndex];
      const sourceGroup = employeeGroups.find(
        (eg) => eg.employee_id === sourceEmp.employee_id
      )?.group_id;

      if (sourceGroup) {
        for (let row = start; row <= end; row++) {
          const targetEmp = filteredWeeklyShifts[row];
          await assignGroup(targetEmp.employee_id, sourceGroup);
        }

        const updatedMappings = await fetch(
          `${API_BASE}/shift-groups/employee-groups/`
        ).then((r) => r.json());
        setEmployeeGroups(updatedMappings);
      }

      setIsFillingGroup(false);
      setFillStartIndex(null);
      setFillHoverIndex(null);
    }
  }}
>
  {/* Select dropdown for group */}
  <select
    className={`border rounded px-2 py-1 text-sm w-full transition-all duration-200
      ${flashCell === emp.employee_id ? "bg-green-100" : "bg-white"}`}
    value={
      employeeGroups.find((eg) => eg.employee_id === emp.employee_id)
        ?.group_id || ""
    }
    onChange={async (e) => {
      await assignGroup(emp.employee_id, e.target.value);
      const updatedMappings = await fetch(
        `${API_BASE}/shift-groups/employee-groups/`
      ).then((r) => r.json());
      setEmployeeGroups(updatedMappings);
      setFlashCell(emp.employee_id);
      setTimeout(() => setFlashCell(null), 700);
    }}
  >
    <option value="">Select Group</option>
    {groups.map((g) => (
      <option key={g.id} value={g.id}>
        {g.name}
      </option>
    ))}
  </select>

  {/* Excel-style bottom-right handle */}
  <div
    className="absolute bottom-0 right-0 w-3 h-3 bg-indigo-500 hover:bg-indigo-600 rounded-sm cursor-crosshair"
    onMouseDown={(e) => {
      e.preventDefault();
      setIsFillingGroup(true);
      setFillStartIndex(i);
      setFillHoverIndex(i);
    }}
  ></div>
</td>

                {/* Daily shifts */}
{emp.shifts.map((s, j) => {
  const cellKey = `${i}-${j}`; // row-col key
  const isHighlighted = fillShiftTargets.includes(cellKey);

  return (
    <td
      key={j}
      className={`relative p-4 border border-gray-300 text-center select-none transition
        ${new Date(s.date).getDay() === 0 || new Date(s.date).getDay() === 6 ? "bg-red-100" : ""}
        ${s.date === formatDate(new Date()) ? "bg-yellow-100 font-bold" : ""}
        ${isHighlighted ? "shift-fill-highlight" : ""}
        hover:bg-indigo-50`}
      
      onClick={() =>
        setEditShift({
          ...emp,
          date: formatDate(s.date),
          start: s.start === "-" ? "" : s.start,
          end: s.end === "-" ? "" : s.end,
        })
      }

      onMouseEnter={() => {
        // while dragging highlight target
        if (isFillingShift && fillShiftOrigin) {
          const newTargets = [];
          const rowMin = Math.min(fillShiftOrigin.empIndex, i);
          const rowMax = Math.max(fillShiftOrigin.empIndex, i);
          const colMin = Math.min(fillShiftOrigin.colIndex, j);
          const colMax = Math.max(fillShiftOrigin.colIndex, j);
          for (let r = rowMin; r <= rowMax; r++) {
            for (let c = colMin; c <= colMax; c++) {
              newTargets.push(`${r}-${c}`);
            }
          }
          setFillShiftTargets(newTargets);
        }
      }}

      onMouseUp={async () => {
        if (isFillingShift && fillShiftOrigin) {
          for (const key of fillShiftTargets) {
            const [row, col] = key.split("-").map(Number);
            const targetEmp = filteredWeeklyShifts[row];
            const targetDate = formatDate(weekDates[col]);
            await copyShiftToCell(
              targetEmp.employee_id,
              targetDate,
              fillShiftOrigin.start,
              fillShiftOrigin.end
            );
          }

          // refresh shifts
          const shiftRes = await fetch(`${API_BASE}/shifts/`);
          const shiftData = await shiftRes.json();
          setShifts(shiftData);

          // reset
          setIsFillingShift(false);
          setFillShiftOrigin(null);
          setFillShiftTargets([]);
        }
      }}
    >
      {!s.start || s.start === "00:00" || s.start === "-" ? "-" : `${s.start} - ${s.end}`}

      {/* Fill handle (bottom-right corner) */}
      {s.start !== "-" && s.end !== "-" && (
        <div
          className="absolute bottom-0 right-0 w-3 h-3 bg-indigo-500 hover:bg-indigo-600 rounded-sm cursor-crosshair"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsFillingShift(true);
            setFillShiftOrigin({
              empIndex: i,
              colIndex: j,
              start: s.start,
              end: s.end,
            });
            setFillShiftTargets([`${i}-${j}`]);
          }}
        ></div>
      )}
    </td>
  );
})}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Weekly navigation */}
    <div className="flex justify-between items-center mt-6">
      <button
        onClick={() =>
          setCurrentWeekStart(
            new Date(currentWeekStart.setDate(currentWeekStart.getDate() - 7))
          )
        }
        className="flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded shadow hover:bg-indigo-600"
      >
        <ChevronLeftIcon className="h-5 w-5" /> Previous Week
      </button>
      <button
        onClick={() => setCurrentWeekStart(getStartOfWeek(new Date()))}
        className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded shadow hover:bg-green-600"
      >
        Today
      </button>
      <button
        onClick={() =>
          setCurrentWeekStart(
            new Date(currentWeekStart.setDate(currentWeekStart.getDate() + 7))
          )
        }
        className="flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded shadow hover:bg-indigo-600"
      >
        Next Week <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>
  </div>
)}

{editShift && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-lg p-6 w-96">
      <h3 className="text-xl font-bold mb-4 text-indigo-700">Edit Shift</h3>
      <p>
        <strong>Employee:</strong> {editShift.name} ({editShift.employee_id})
      </p>
      <p><strong>Department:</strong> {editShift.department}</p>
      <p><strong>Date:</strong> {editShift.date}</p>

      <div className="mt-4">
        <label className="block font-semibold">Start Time</label>
        <input
          type="time"
          value={editShift.start}
          onChange={(e) =>
            setEditShift({ ...editShift, start: e.target.value })
          }
          className="border p-2 rounded w-full"
        />
      </div>

      <div className="mt-4">
        <label className="block font-semibold">End Time</label>
        <input
          type="time"
          value={editShift.end}
          onChange={(e) =>
            setEditShift({ ...editShift, end: e.target.value })
          }
          className="border p-2 rounded w-full"
        />
      </div>

      <div className="flex justify-between mt-6">
        {/* Delete button */}
        <button
  onClick={async () => {
    await fetch(
      `${API_BASE}/shifts/delete-by-date?employee_id=${editShift.employee_id}&date_=${editShift.date}`,
      { method: "DELETE" }
    );

    // update state instantly with placeholder "-"
    setShifts((prev) => {
      const other = prev.filter(
        (s) =>
          !(
            s.employee_id === editShift.employee_id &&
            s.date === editShift.date
          )
      );
      return [
        ...other,
        {
          employee_id: editShift.employee_id,
          date: editShift.date,
          start_time: "-",
          end_time: "-",
        },
      ];
    });

    setEditShift(null);
  }}
  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
>
  Delete
</button>

        <div className="flex gap-3">
          <button
            onClick={() => setEditShift(null)}
            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
          >
            Cancel
          </button>
          <button
  onClick={saveShift}
  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
>
  Save
</button>
        </div>
      </div>
    </div>
    
  </div>
  
)}
      <Footer />
    </div>
  );
}

export default ShiftsManagement;