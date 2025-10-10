import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon,
  UserIcon,
  IdentificationIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { API_BASE } from "./config";

function YourApplications() {
  const location = useLocation();
  const navigate = useNavigate();

  // Get user and employee info
  const storedUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const user = location.state?.user || storedUser.name || "Guest";
  const employeeId =
    location.state?.employeeId || storedUser.employee_id || "EMP000";

  // Applications (fetched from backend)
  const [applications, setApplications] = useState([]);

  // Filters
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "" });
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Reason modal
  const [selectedReason, setSelectedReason] = useState(null);

  // Fetch user's applications
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/work-applications/?employee_id=${employeeId}`
        );
        if (!res.ok) throw new Error("Failed to fetch applications");
        const data = await res.json();

        // only this user's applications are shown
        const filtered = data.filter(
          (app) => app.employee_id === employeeId
        );

        setApplications(filtered);
      } catch (err) {
        console.error("Error fetching applications:", err);
      }
    };
    fetchApplications();
  }, [employeeId]);

  // Date formatter
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Time formatter
  const formatTime = (timeString) => {
    if (!timeString) return "-";
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Sorting
  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    } else if (sortConfig.key === key && sortConfig.direction === "descending") {
      direction = ""; // reset
    }
    setSortConfig({ key, direction });
  };

  const getArrow = (key) => {
    if (sortConfig.key !== key) return "";
    if (sortConfig.direction === "ascending") return "▲";
    if (sortConfig.direction === "descending") return "▼";
    return "";
  };

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  // Filter + sort data
  const filteredApps = applications
    .filter((app) => {
      if (!app.created_at) return false;
      const appMonth = new Date(app.created_at).getMonth() + 1;
      const appYear = new Date(app.created_at).getFullYear();
      return appMonth === month && appYear === year;
    })
    .filter(
      (app) =>
        app.application_type?.toLowerCase().includes(search.toLowerCase()) ||
        app.reason?.toLowerCase().includes(search.toLowerCase()) ||
        app.status?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortConfig.key || !sortConfig.direction) return 0;
      const dir = sortConfig.direction === "ascending" ? 1 : -1;

      if (sortConfig.key === "created_at") {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateA > dateB ? dir : -dir;
      }

      return a[sortConfig.key] > b[sortConfig.key] ? dir : -dir;
    });

  // Pagination logic
  const totalPages = Math.ceil(filteredApps.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentRows = filteredApps.slice(startIndex, startIndex + rowsPerPage);

  const resetFilters = () => {
    setSearch("");
    setSortConfig({ key: "", direction: "" });
    setMonth(new Date().getMonth() + 1);
    setYear(new Date().getFullYear());
    setCurrentPage(1);
    setRowsPerPage(10);
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
      onClick={() => {
        // Clear login info and navigate home
        localStorage.removeItem("user");
        localStorage.removeItem("employeeId");
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
        onClick={() => navigate(-1)}
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

      {/* User Info */}
<div className="max-w-7xl w-full mx-auto px-6 mt-6">
  <div className="bg-white shadow-md rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center text-base sm:text-lg font-semibold gap-3 sm:gap-0 text-center sm:text-left">
    
    {/* For phone (vertical layout) */}
    <div className="flex flex-col items-center sm:hidden">
      <span className="flex items-center gap-2 text-indigo-700 text-2xl font-bold mb-2">
        <DocumentTextIcon className="h-6 w-6" />
        Your Applications
      </span>
      <span className="flex items-center gap-2 mb-1">
        <UserIcon className="h-6 w-6 text-indigo-600" />
        Name: <span className="text-red-600">{user}</span>
      </span>
      <span className="flex items-center gap-2">
        <IdentificationIcon className="h-6 w-6 text-indigo-600" />
        Employee ID: <span className="text-red-600">{employeeId}</span>
      </span>
    </div>

    {/* For iPad and Mac (original horizontal layout) */}
    <div className="hidden sm:flex justify-between items-center w-full">
      <span className="flex items-center gap-2">
        <UserIcon className="h-6 w-6 text-indigo-600" />
        Name: <span className="text-red-600">{user}</span>
      </span>
      <span className="flex items-center gap-2 text-indigo-700 text-2xl font-bold">
        <DocumentTextIcon className="h-6 w-6" />
        Your Applications
      </span>
      <span className="flex items-center gap-2">
        <IdentificationIcon className="h-6 w-6 text-indigo-600" />
        Employee ID: <span className="text-red-600">{employeeId}</span>
      </span>
    </div>
  </div>
</div>

      {/* Filters Section */}
      <div className="max-w-7xl w-full mx-auto px-6 mt-6 mb-6">
        <div className="flex flex-col sm:flex-wrap sm:flex-row gap-4 justify-center sm:justify-between items-center bg-white p-4 sm:p-5 rounded-lg shadow text-base sm:text-lg text-center sm:text-left">
          <div className="flex items-center gap-2">
            <MagnifyingGlassIcon className="h-6 w-6 text-indigo-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search applications..."
              className="px-4 py-2 border rounded-md shadow-sm text-base focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Month & Year Selectors */}
          <div className="flex gap-3">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="px-3 py-2 border rounded-md text-base"
            >
              {monthNames.map((m, i) => (
                <option key={i + 1} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 border rounded-md text-base"
            >
              {Array.from({ length: 5 }, (_, i) => year - 2 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
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

          <button
            onClick={resetFilters}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md shadow text-base font-semibold"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Reset
          </button>
        </div>
      </div>

      {/* Applications Table */}
      <div className="max-w-7xl w-full mx-auto px-2 sm:px-6 flex-grow mb-12 overflow-x-auto">
        <table className="min-w-[650px] sm:min-w-full border-collapse bg-white shadow-lg rounded-xl overflow-hidden text-[10px] sm:text-xs md:text-sm lg:text-base">
          <thead>
            <tr className="bg-indigo-500 text-white text-[11px] sm:text-sm md:text-base">
              <th className="p-4 cursor-pointer select-none" onClick={() => requestSort("application_type")}>
                Type {getArrow("application_type")}
              </th>
              <th className="p-4 cursor-pointer select-none" onClick={() => requestSort("created_at")}>
                Submission Date {getArrow("created_at")}
              </th>
              <th className="p-4 cursor-pointer select-none" onClick={() => requestSort("start_date")}>
                Start Date {getArrow("start_date")}
              </th>
              <th className="p-4 cursor-pointer select-none" onClick={() => requestSort("end_date")}>
                End Date {getArrow("end_date")}
              </th>
              <th className="p-4">Start Time</th>
              <th className="p-4">End Time</th>
              <th className="p-4">Reason</th>
              <th className="p-4">Paid Holiday</th> {/* ✅ New Column */}
              <th className="p-4 cursor-pointer select-none" onClick={() => requestSort("status")}>
                Status {getArrow("status")}
              </th>
              <th className="p-4">HR Notes</th>
            </tr>
          </thead>
          <tbody>
            {currentRows.length > 0 ? (
              currentRows.map((app) => {
                const isLong = app.reason && app.reason.length > 20;
                const displayReason = isLong ? app.reason.slice(0, 20) + "..." : app.reason;

                return (
                  <tr key={app.id} className="text-center border-b">
                    <td className="p-4">{app.application_type}</td>
                    <td className="p-4">{formatDate(app.created_at)}</td>
                    <td className="p-4">{formatDate(app.start_date)}</td>
                    <td className="p-4">{formatDate(app.end_date)}</td>
                    <td className="p-4">{formatTime(app.start_time)}</td>
                    <td className="p-4">{formatTime(app.end_time)}</td>
                    <td
                      className="p-4 text-blue-700 underline cursor-pointer"
                      onClick={() => setSelectedReason(app.reason)}
                    >
                      {displayReason}
                    </td>
                    <td className="p-4">
                      {app.use_paid_holiday === "yes" ? (
                        <span className="text-green-600 font-bold">Yes</span>
                      ) : (
                        <span className="text-red-600 font-bold">No</span>
                      )}
                    </td>
                    <td
                      className={`p-4 font-bold ${
                        app.status === "Approved"
                          ? "text-green-600"
                          : app.status === "Rejected"
                          ? "text-red-600"
                          : "text-yellow-600"
                      }`}
                    >
                      {app.status}
                    </td>
                    <td className="p-4">{app.hr_notes || "-"}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="10" className="p-6 text-center text-gray-500">
                  No applications found for this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

              {/* Pagination Controls */}
<div className="flex justify-center items-center gap-4 flex-wrap mt-8 mb-12 text-xs sm:text-sm md:text-base">
  {/* Previous Button */}
  <button
    disabled={currentPage === 1}
    onClick={() => setCurrentPage((prev) => prev - 1)}
    className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-md font-semibold shadow transition-all duration-200 ${
      currentPage === 1
        ? "bg-gray-300 text-gray-600 cursor-not-allowed"
        : "bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105"
    }`}
  >
    Previous
  </button>

  {/* Page Indicator */}
  <span className="font-semibold text-gray-800 bg-white border border-gray-300 rounded-lg px-4 py-1.5 shadow-sm">
    Page {currentPage} of {totalPages || 1}
  </span>

  {/* Next Button */}
  <button
    disabled={currentPage === totalPages || totalPages === 0}
    onClick={() => setCurrentPage((prev) => prev + 1)}
    className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-md font-semibold shadow transition-all duration-200 ${
      currentPage === totalPages || totalPages === 0
        ? "bg-gray-300 text-gray-600 cursor-not-allowed"
        : "bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105"
    }`}
  >
    Next
  </button>
</div>

      {/* Reason Modal */}
      {selectedReason && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[90vw] sm:max-w-lg p-4 sm:p-6 relative max-h-[80vh] overflow-y-auto mx-3">
            <button
              onClick={() => setSelectedReason(null)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <h3 className="text-xl font-bold text-indigo-700 mb-4">Full Reason</h3>
            <p className="text-gray-800 whitespace-pre-line">{selectedReason}</p>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default YourApplications;