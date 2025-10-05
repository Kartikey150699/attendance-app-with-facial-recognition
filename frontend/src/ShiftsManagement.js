import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";

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

  const [groupDetails, setGroupDetails] = useState([]); // full group info with employees

useEffect(() => {
  const fetchData = async () => {
    try {
      const [empRes, shiftRes, groupRes, mappingRes, groupFullRes] = await Promise.all([
        fetch("http://localhost:8000/users/active"),
        fetch("http://localhost:8000/shifts/"),
        fetch("http://localhost:8000/shift-groups/"),
        fetch("http://localhost:8000/shift-groups/employee-groups/"),
        fetch("http://localhost:8000/shift-groups/details/full"),
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
  // ✅ Local-safe version (no UTC shift)
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
  return employees.map((emp) => ({
    ...emp,
    shifts: weekDates.map((d) => {
      const shift = shifts.find(
        (s) => s.employee_id === emp.employee_id && s.date === formatDate(d)
      );

      if (shift) {
        return {
          date: shift.date,
          start: shift.start_time === "-" ? "-" : shift.start_time.slice(0, 5),
          end: shift.end_time === "-" ? "-" : shift.end_time.slice(0, 5),
          hours:
            shift.start_time === "-" || shift.end_time === "-"
              ? 0
              : getShiftHours(shift.start_time, shift.end_time),
        };
      }

      // if no shift found → placeholder
      return { date: formatDate(d), start: "-", end: "-", hours: 0 };
    }),
  }));
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
    const res = await fetch("http://localhost:8000/shift-groups/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: employeeId,
        group_id: parseInt(groupId),
      }),
    });

    if (!res.ok) throw new Error("Failed to assign group");
    const data = await res.json();
    console.log("Group assigned:", data.message);

    // After assignment, re-fetch both shifts AND employee group mappings
    const [shiftRes, mappingRes] = await Promise.all([
      fetch("http://localhost:8000/shifts/"),
      fetch("http://localhost:8000/shift-groups/employee-groups/"),
    ]);

    if (!shiftRes.ok || !mappingRes.ok)
      throw new Error("Failed to reload data");

    const shiftData = await shiftRes.json();
    const mappingData = await mappingRes.json();

    setShifts(shiftData);
    setEmployeeGroups(mappingData);

    // ✅ Force React to re-render this week's table by resetting state
    setCurrentWeekStart((prev) => new Date(prev));
  } catch (error) {
    console.error("Error assigning group:", error);
  }
};

// Save shift function (keep as-is below)
const saveShift = async () => {
  try {
    const response = await fetch("http://localhost:8000/shifts/assign", {
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
    const shiftRes = await fetch("http://localhost:8000/shifts/");
    const shiftData = await shiftRes.json();
    setShifts(shiftData);

    setEditShift(null);
  } catch (error) {
    console.error("Error saving shift:", error);
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
<div className="flex gap-4 overflow-x-auto px-6 py-2 max-w-6xl mx-auto mb-6 scrollbar-thin scrollbar-thumb-indigo-400">
  {groups.length === 0 ? (
    <p className="text-gray-500 text-sm">No groups found.</p>
  ) : (
    groups.map((g) => {
      const schedule = g.schedule || {};
      const grouped = {};
      Object.entries(schedule).forEach(([day, times]) => {
        const key = Array.isArray(times) ? `${times[0]} - ${times[1]}` : "-";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(day.toUpperCase());
      });

      return (
        <div
          key={g.id}
          className="min-w-[230px] bg-white shadow-md rounded-lg p-4 border border-gray-200 
                     hover:shadow-lg hover:scale-[1.02] transition duration-200"
        >
          <h5 className="text-lg font-bold text-indigo-700 mb-1">{g.name}</h5>
          <p className="text-gray-600 text-sm mb-2">
            {g.description || "No description"}
          </p>
          <ul className="text-sm space-y-1">
            {Object.entries(grouped).map(([time, days]) => (
              <li key={time}>
                <span className="font-semibold text-gray-700">
                  {days.join(", ")}
                </span>{" "}
                → {time}
              </li>
            ))}
          </ul>
        </div>
      );
    })
  )}
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
  <div className="max-w-7xl mx-auto px-6 mb-6 flex-grow">
    <table className="w-full border border-gray-300 border-collapse bg-white shadow rounded-lg overflow-hidden text-base">
      <thead>
        <tr className="bg-indigo-500 text-white">
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
          <tr key={i} className="text-center">
            <td className="p-4 border border-gray-300">{emp.employee_id}</td>
            <td className="p-4 border border-gray-300">{emp.name}</td>
            <td className="p-4 border border-gray-300">{emp.department}</td>
            <td className="p-4 border border-gray-300">
<select
  className="border rounded px-2 py-1 text-sm"
  value={
    employeeGroups.find((eg) => eg.employee_id === emp.employee_id)?.group_id || ""
  }
  onChange={async (e) => {
    await assignGroup(emp.employee_id, e.target.value);
    // refresh mapping after assignment
    const updatedMappings = await fetch("http://localhost:8000/shift-groups/employee-groups/").then((r) => r.json());
    setEmployeeGroups(updatedMappings);
  }}
>
  <option value="">Select Group</option>
  {groups.map((g) => (
    <option key={g.id} value={g.id}>
      {g.name}
    </option>
  ))}
</select>
</td>
            {emp.shifts.map((s, j) => (
              <td
                key={j}
                className={`p-4 border border-gray-300 cursor-pointer hover:bg-indigo-100 transition ${
                  new Date(s.date).getDay() === 0 || new Date(s.date).getDay() === 6
                    ? "bg-red-100"
                    : ""
                } ${s.date === formatDate(new Date()) ? "bg-yellow-100 font-bold" : ""}`}
                onClick={() => {
                  // Always open modal — even if it's weekend/default "-"
                  setEditShift({
                    ...emp,
                    date: formatDate(s.date),
                    start: s.start === "-" ? "" : s.start,
                    end: s.end === "-" ? "" : s.end,
                  });
                }}
              >
                {s.start === "-" ? "-" : `${s.start} - ${s.end}`}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>

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
      `http://localhost:8000/shifts/delete-by-date?employee_id=${editShift.employee_id}&date_=${editShift.date}`,
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