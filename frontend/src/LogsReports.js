import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";

function LogsReports() {
  const navigate = useNavigate();
  const [dateTime, setDateTime] = useState(new Date());

  // Logs from backend
  const [logs, setLogs] = useState([]);

  // Filters
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "" });
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [quickFilter, setQuickFilter] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch logs for current month from backend
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(
          `http://localhost:8000/hr_logs?year=${today.getFullYear()}&month=${
            today.getMonth() + 1
          }`
        );
        if (!res.ok) throw new Error("Failed to fetch logs");
        const data = await res.json();
        setLogs(data);
      } catch (err) {
        console.error("Error fetching logs:", err);
      }
    };
    fetchLogs();
  }, []);

  // Helpers: format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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

      // Default view is today
      if (selectedDate) {
        if (log.date !== selectedDate) return false;
      }

      // Quick filters
      if (quickFilter === "week") {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
        const endOfWeek = new Date(today);
        if (logDate < startOfWeek || logDate > endOfWeek) return false;
      }

      if (quickFilter === "month") {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today);
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

  // Pagination logic
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
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md relative">
        <div className="absolute left-10 text-blue-800 text-xl font-bold">
          <HeaderDateTime />
        </div>
        <h1
          onClick={() => navigate("/")}
          className="text-5xl font-bold text-blue-900 cursor-pointer hover:text-blue-700 transition-colors"
        >
          FaceTrack Attendance
        </h1>
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

          {/* Date Selector */}
          <input
            type="date"
            value={selectedDate}
            max={todayStr}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setQuickFilter(null); // clear quick filter if specific date chosen
            }}
            className="px-3 py-2 border rounded-md text-base"
          />

          {/* Quick Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setQuickFilter("week");
                setSelectedDate(""); // clear date when quick filter applied
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
                setSelectedDate(""); // clear date when quick filter applied
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
                  <td className="p-4">{log.name}</td>
                  <td className="p-4">{log.check_in || "-"}</td>
                  <td className="p-4">{log.check_out || "-"}</td>
                  <td className="p-4">{log.total_work}</td>
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
                        : log.status === "Present on Sunday"
                        ? "text-purple-600"
                        : log.status === "Present on Saturday"
                        ? "text-pink-600"
                        : "text-gray-600"
                    }`}
                  >
                    {log.status}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="p-6 text-gray-500 text-center">
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

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default LogsReports;