import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon,
  UserIcon,
  IdentificationIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";

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
  const [dateTime, setDateTime] = useState(new Date());

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

  // Auto update time
  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch user's applications
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const res = await fetch(
          `http://localhost:8000/work-applications/?employee_id=${employeeId}`
        );
        if (!res.ok) throw new Error("Failed to fetch applications");
        const data = await res.json();
        setApplications(data);
      } catch (err) {
        console.error("Error fetching applications:", err);
      }
    };
    fetchApplications();
  }, [employeeId]);

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
      if (!app.start_date) return false;
      const appMonth = new Date(app.start_date).getMonth() + 1;
      const appYear = new Date(app.start_date).getFullYear();
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
            onClick={() => navigate(-1)}
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <ArrowUturnLeftIcon className="h-5 w-5" />
            Back
          </button>
        </div>
      </div>

      {/* User Info */}
      <div className="max-w-7xl w-full mx-auto px-6 mt-6">
        <div className="bg-white shadow-md rounded-lg p-4 flex justify-between text-lg font-semibold">
          <span className="flex items-center gap-2">
            <UserIcon className="h-6 w-6 text-indigo-600" />
            Name: <span className="text-red-600">{user}</span>
          </span>
          <span className="flex items-center gap-2">
            <IdentificationIcon className="h-6 w-6 text-indigo-600" />
            Employee ID: <span className="text-red-600">{employeeId}</span>
          </span>
        </div>
      </div>

      {/* Filters Section */}
      <div className="max-w-7xl w-full mx-auto px-6 mt-6 mb-6">
        <div className="flex flex-wrap gap-4 justify-between items-center bg-white p-5 rounded-lg shadow text-lg">
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
      <div className="max-w-7xl w-full mx-auto px-6 flex-grow mb-12">
        <table className="w-full border-collapse bg-white shadow-lg rounded-xl overflow-hidden text-lg">
          <thead>
            <tr className="bg-indigo-500 text-white text-lg">
              <th className="p-4 cursor-pointer select-none" onClick={() => requestSort("application_type")}>
                Type {getArrow("application_type")}
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
                    <td className="p-4">{app.start_date}</td>
                    <td className="p-4">{app.end_date}</td>
                    <td className="p-4">{app.start_time || "-"}</td>
                    <td className="p-4">{app.end_time || "-"}</td>
                    <td
                      className="p-4 text-blue-700 underline cursor-pointer"
                      onClick={() => setSelectedReason(app.reason)}
                    >
                      {displayReason}
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
                <td colSpan="8" className="p-6 text-center text-gray-500">
                  No applications found for this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
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

      {/* Reason Modal */}
      {selectedReason && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 relative max-h-[70vh] overflow-y-auto">
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