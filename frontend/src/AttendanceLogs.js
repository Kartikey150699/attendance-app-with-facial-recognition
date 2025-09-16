import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  PencilSquareIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  CalendarIcon
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";

function AttendanceLogs() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("today");
  const [showDeleted, setShowDeleted] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editLog, setEditLog] = useState(null);
  const [editTimes, setEditTimes] = useState({
    check_in: "",
    break_start: "",
    break_end: "",
    check_out: "",
  });

  // Audit trail modal
  const [auditTrail, setAuditTrail] = useState([]);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Export popup
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [exportType, setExportType] = useState("csv");

  const navigate = useNavigate();
  const today = new Date();
const [year, setYear] = useState(today.getFullYear());
const [month, setMonth] = useState(today.getMonth() + 1);
const isCurrentMonth =
  year === today.getFullYear() && month === today.getMonth() + 1;

  // Logged-in admin name (stored at login)
  const adminName = localStorage.getItem("admin_username") || "admin";

  // Fetch logs
  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch(
          `http://localhost:8000/logs?year=${year}&month=${month}`
        );
        const data = await res.json();
        setLogs(data);
        setFilteredLogs(data);
      } catch (err) {
        console.error("Error fetching logs:", err);
      }
    }
    fetchLogs();
  }, [year, month]);

  // Filters + search
  useEffect(() => {
    let updated = [...logs];
    const today = new Date();

    if (!showDeleted) {
      updated = updated.filter((log) => log.employee_id !== "DELETED");
    }

    if (searchTerm.trim() !== "") {
      updated = updated.filter(
        (log) =>
          (log.employee_id ? log.employee_id.toLowerCase() : "").includes(
            searchTerm.toLowerCase()
          ) ||
          (log.user_name_snapshot
            ? log.user_name_snapshot.toLowerCase()
            : ""
          ).includes(searchTerm.toLowerCase())
      );
    }

    if (filterType === "today") {
      const todayStr = today.toISOString().split("T")[0];
      updated = updated.filter((log) => log.date === todayStr);
    } else if (filterType === "week") {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      updated = updated.filter((log) => {
        const logDate = new Date(log.date);
        return logDate >= startOfWeek && logDate <= endOfWeek;
      });
    }

    setFilteredLogs(updated);
  }, [searchTerm, filterType, logs, showDeleted]);

  // Reset filters
const resetFilters = () => {
  const today = new Date();
  setSearchTerm("");
  setFilterType("today");
  setShowDeleted(false);

  setYear(today.getFullYear());
  setMonth(today.getMonth() + 1);

  setFilteredLogs(
    logs.filter((log) => log.employee_id !== "DELETED")
  );
};

  // Month navigation
const handlePrevMonth = () => {
  let newMonth = month - 1;
  let newYear = year;
  if (newMonth < 1) {
    newMonth = 12;
    newYear -= 1;
  }
  setMonth(newMonth);
  setYear(newYear);
};

const handleNextMonth = () => {
  let newMonth = month + 1;
  let newYear = year;
  if (newMonth > 12) {
    newMonth = 1;
    newYear += 1;
  }
  setMonth(newMonth);
  setYear(newYear);
};

  // Open edit modal
  const openEditModal = (log) => {
    setEditLog(log);
    setEditTimes({
      check_in: log.check_in || "",
      break_start: log.break_start || "",
      break_end: log.break_end || "",
      check_out: log.check_out || "",
    });
    setIsModalOpen(true);
  };

  // Save edit
const saveEdit = async () => {
  if (!editLog) return;

  const adminName = localStorage.getItem("currentAdmin"); // ✅ logged-in admin name

  try {
    const res = await fetch(
      `http://localhost:8000/logs/update/${editLog.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editTimes, edited_by: adminName }),
      }
    );

    if (res.ok) {
      const result = await res.json();
      const updatedLog = { ...editLog, ...result.log };
      setLogs((prev) =>
        prev.map((l) => (l.id === editLog.id ? updatedLog : l))
      );
      setIsModalOpen(false);
    } else {
      console.error("Failed to update log");
    }
  } catch (err) {
    console.error("Error saving edit:", err);
  }
};
  // Fetch audit trail
const openAuditTrail = async (log) => {
  try {
    const res = await fetch(`http://localhost:8000/logs/audit/${log.id}`);
    if (!res.ok) throw new Error("Failed to fetch audit trail");

    const data = await res.json();

    // Save both the audit logs and the current log being inspected
    setAuditTrail(data);
    setEditLog({
      id: log.id,
      employee_id: log.employee_id,
      user_name_snapshot: log.user_name_snapshot,
    });

    setIsAuditModalOpen(true);
  } catch (err) {
    console.error("Error fetching audit trail:", err);
  }
};

  // Export current table
const confirmExport = async () => {
  try {
    const res = await fetch(
      `http://localhost:8000/logs/export?year=${year}&month=${month}&format=${exportType}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filteredLogs),
      }
    );
    if (!res.ok) throw new Error("Export failed");

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    // Get filename from backend headers
    const disposition = res.headers.get("Content-Disposition");
    let filename = "attendance_logs";
    if (disposition && disposition.includes("filename=")) {
      filename = disposition
        .split("filename=")[1]
        .replace(/['"]/g, "");
    }

    if (exportType === "pdf") {
      // Open in new tab
      const pdfWindow = window.open();
      pdfWindow.location.href = url;
    } else {
      // Download with correct filename
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    window.URL.revokeObjectURL(url);
    setShowExportPopup(false);
  } catch (err) {
    console.error("Error exporting logs:", err);
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
          onClick={() => navigate("/admin-dashboard")}
          className="text-5xl font-bold text-blue-900 cursor-pointer hover:text-blue-700 transition-colors"
        >
          FaceTrack Attendance
        </h1>
        <div className="absolute right-10 flex gap-3">
          <button
            onClick={() => setShowExportPopup(true)}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            Export
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg shadow flex items-center gap-2"
          >
            <ArrowUturnLeftIcon className="h-5 w-5" />
            Back
          </button>
        </div>
      </div>

      {/* Month-Year Navigation (Combined) */}
<div className="flex flex-wrap justify-center items-center gap-4 mt-6">
  {/* Prev Button */}
  <button
    onClick={handlePrevMonth}
    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg shadow"
  >
    ◀
  </button>

  {/* Year Selector */}
  <select
    value={year}
    onChange={(e) => setYear(parseInt(e.target.value))}
    className="px-3 py-2 border-2 border-indigo-500 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-indigo-400"
  >
    {Array.from({ length: 6 }, (_, i) => today.getFullYear() - 3 + i).map((y) => (
      <option key={y} value={y}>
        {y}
      </option>
    ))}
  </select>

  {/* Month Selector */}
  <select
    value={month}
    onChange={(e) => setMonth(parseInt(e.target.value))}
    className="px-3 py-2 border-2 border-indigo-500 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-indigo-400"
  >
    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
      <option key={m} value={m}>
        {new Date(0, m - 1).toLocaleString("en", { month: "long" })}
      </option>
    ))}
  </select>

  {/* Next Button */}
  <button
    onClick={handleNextMonth}
    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg shadow"
  >
    ▶
  </button>
</div>


      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-center px-10 mt-6 gap-4">
        <input
          type="text"
          placeholder="Search by Employee ID or Name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 border-2 border-indigo-400 rounded-lg shadow-md text-base w-full md:w-1/3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex flex-wrap gap-3">
          {["today", "week", "month"].map((type) => (
  <button
    key={type}
    onClick={() => isCurrentMonth && setFilterType(type)}
    disabled={!isCurrentMonth}
    className={`px-4 py-2 rounded-lg font-semibold shadow-md ${
      !isCurrentMonth
        ? "bg-gray-300 text-gray-600 cursor-not-allowed"
        : filterType === type
        ? "bg-indigo-600 text-white"
        : "bg-white border border-indigo-400 text-indigo-700 hover:bg-indigo-100"
    }`}
  >
    {type === "today"
      ? "Today"
      : type === "week"
      ? "This Week"
      : "This Month"}
  </button>
))}
          <button
            onClick={() => setShowDeleted(!showDeleted)}
            className={`px-4 py-2 rounded-lg font-semibold shadow-md ${
              showDeleted
                ? "bg-red-500 text-white"
                : "bg-white border border-red-400 text-red-600 hover:bg-red-100"
            }`}
          >
            {showDeleted ? "Hide Deleted Users" : "Show Deleted Users"}
          </button>
          <button
            onClick={resetFilters}
            className="px-4 py-2 rounded-lg font-semibold shadow-md bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95 transition-transform"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="flex-grow p-10">
        <table className="w-full border-collapse bg-white shadow-lg rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-indigo-500 text-white text-lg">
              <th className="p-4">Employee ID</th>
              <th className="p-4">Date</th>
              <th className="p-4">Employee</th>
              <th className="p-4">Check In</th>
              <th className="p-4">Break Start</th>
              <th className="p-4">Break End</th>
              <th className="p-4">Check Out</th>
              <th className="p-4">Total Working</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log, idx) => (
                <tr key={idx} className="text-center border-b">
                  <td
                    className={`p-4 font-bold ${
                      log.employee_id === "DELETED"
                        ? "text-red-600"
                        : "text-indigo-700"
                    }`}
                  >
                    {log.employee_id}
                  </td>
                  <td className="p-4">{log.date}</td>
                  <td className="p-4">{log.user_name_snapshot}</td>
                  <td className="p-4">{log.check_in || "-"}</td>
                  <td className="p-4">{log.break_start || "-"}</td>
                  <td className="p-4">{log.break_end || "-"}</td>
                  <td className="p-4">{log.check_out || "-"}</td>
                  <td className="p-4 font-bold text-green-600">
                    {log.total_work}
                  </td>
                  <td className="p-4 flex gap-2 justify-center">
  {/* Show Edit only if not deleted */}
  {log.employee_id !== "DELETED" && (
    <button
      onClick={() => openEditModal(log)}
      className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg shadow flex items-center gap-1"
    >
      <PencilSquareIcon className="h-4 w-4" />
      Edit
    </button>
  )}

  {/* History should always be visible */}
  <button
    onClick={() => openAuditTrail(log)}
    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow flex items-center gap-1"
  >
    <ClockIcon className="h-4 w-4" />
    History
  </button>
</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="p-6 text-gray-500">
                  No logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Export Popup */}
      {showExportPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[400px]">
            <h2 className="text-lg font-bold text-indigo-700 mb-4">
              Export Logs
            </h2>
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              className="w-full p-2 border rounded mb-4"
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
            </select>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowExportPopup(false)}
                className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={confirmExport}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isModalOpen && editLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[400px]">
            <h2 className="text-lg font-bold text-indigo-700 mb-2">
              Edit Attendance – {editLog.employee_id} ({editLog.user_name_snapshot})
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Date: {new Date(editLog.date).toLocaleDateString("en-GB", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>

            {["check_in", "break_start", "break_end", "check_out"].map(
              (field) => (
                <div key={field} className="mb-3">
                  <label className="block text-gray-700 font-semibold capitalize mb-1">
                    {field.replace("_", " ")}
                  </label>
                  <input
                    type="time"
                    step="60"
                    value={editTimes[field]}
                    onChange={(e) =>
                      setEditTimes({ ...editTimes, [field]: e.target.value })
                    }
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                  />
                </div>
              )
            )}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
{isAuditModalOpen && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl shadow-lg p-6 w-[500px] max-h-[80vh] flex flex-col">
      {/* Header */}
      <h2 className="text-lg font-bold text-indigo-700 mb-4">
        Audit Trail – {editLog?.user_name_snapshot} ({editLog?.employee_id})
      </h2>

      {/* Scrollable List */}
      <div className="flex-grow overflow-y-auto pr-2">
        {auditTrail.length > 0 ? (
          <ul className="space-y-3">
            {auditTrail.map((a, idx) => (
              <li
                key={idx}
                className="p-3 border rounded-lg bg-gray-50 shadow-sm"
              >
                <p className="text-sm text-gray-700">
                  <b>Edited By:</b> {a.edited_by || "Unknown"}
                </p>
                <p className="text-sm text-gray-700">
                  <b>Time:</b> {a.edited_at || "N/A"}
                </p>
                <p className="text-sm text-gray-700">
                  <b>Changes:</b>{" "}
                  {a.changes
                    ? Object.entries(a.changes)
                        .map(
                          ([k, v]) =>
                            `${k}: ${v.old || "-"} → ${v.new || "-"}`
                        )
                        .join(", ")
                    : "No details"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600">No audit history found.</p>
        )}
      </div>

      {/* Fixed Footer with Close button */}
      <div className="flex justify-center mt-6 sticky bottom-0 bg-white py-3">
        <button
          onClick={() => setIsAuditModalOpen(false)}
          className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}

      <Footer />
    </div>
  );
}

export default AttendanceLogs;