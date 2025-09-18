import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";

function WorkApplicationRequests() {
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "" });
  const [selectedReason, setSelectedReason] = useState(null);

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState(null); // {id, newStatus}

  // Notification modal
  const [notification, setNotification] = useState(null); // {type, message}

  // Pagination + filters
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const res = await fetch("http://localhost:8000/work-applications/");
        if (!res.ok) throw new Error("Failed to fetch applications");
        const data = await res.json();
        setApplications(data);
      } catch (error) {
        console.error("Error fetching applications:", error);
      }
    };
    fetchApplications();
  }, []);

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
  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  const filteredApps = applications
    .filter((app) => {
      const subDate = app.created_at ? new Date(app.created_at) : null;
      if (!subDate) return true;
      return subDate.getMonth() + 1 === month && subDate.getFullYear() === year;
    })
    .filter((app) =>
      Object.values(app)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortConfig.key || !sortConfig.direction) return 0;
      const dir = sortConfig.direction === "ascending" ? 1 : -1;
      return a[sortConfig.key] > b[sortConfig.key] ? dir : -dir;
    });

  // Pagination
  const totalPages = Math.ceil(filteredApps.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentRows = filteredApps.slice(startIndex, startIndex + rowsPerPage);

  // Backend update
  const handleUpdate = async (id, status, hrNotes) => {
    try {
      const res = await fetch(
        `http://localhost:8000/work-applications/${id}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, hr_notes: hrNotes }),
        }
      );

      if (!res.ok) throw new Error("Failed to update application");
      const updated = await res.json();

      setApplications((prev) =>
        prev.map((app) => (app.id === id ? updated : app))
      );

      setNotification({ type: "success", message: "✅ Updated successfully!" });
    } catch (error) {
      console.error("Error updating application:", error);
      setNotification({ type: "error", message: "❌ Failed to update. Please try again." });
    } finally {
      setConfirmModal(null);
    }
  };

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
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <ArrowUturnLeftIcon className="h-5 w-5 text-white" />
            <span>Back</span>
          </button>
        </div>
      </div>

      {/* Page Title */}
      <div className="flex justify-center py-6">
        <h2 className="text-3xl font-bold text-indigo-700 flex items-center gap-3">
          Work Application Requests
        </h2>
      </div>

      {/* Filters */}
      <div className="max-w-7xl w-full mx-auto px-6 mt-4 mb-6">
        <div className="flex flex-wrap gap-4 justify-between items-center bg-white p-5 rounded-lg shadow text-lg">
          {/* Search */}
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

      {/* Applications Table */}
      <div className="max-w-7xl w-full mx-auto px-6 mb-12">
        <table className="w-full border-collapse bg-white shadow rounded-lg text-base">
          <thead>
            <tr className="bg-indigo-500 text-white text-lg">
              <th className="p-4 cursor-pointer" onClick={() => requestSort("created_at")}>
                Submission Date {getArrow("created_at")}
              </th>
              <th className="p-4">Employee ID</th>
              <th className="p-4">Name</th>
              <th className="p-4">Dates<br /><span className="text-xs">(Start → End)</span></th>
              <th className="p-4">Times<br /><span className="text-xs">(Start → End)</span></th>
              <th className="p-4">Reason</th>
              <th className="p-4 cursor-pointer" onClick={() => requestSort("status")}>
                Status {getArrow("status")}
              </th>
              <th className="p-4">HR Notes</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {currentRows.length > 0 ? (
              currentRows.map((app) => {
                const isLong = app.reason && app.reason.length > 25;
                const displayReason = isLong ? app.reason.slice(0, 25) + "..." : app.reason;

                return (
                  <tr
                    key={app.id}
                    className={`text-center border-b ${
                      app.status === "Pending" ? "bg-yellow-100" : "bg-white"
                    }`}
                  >
                    <td className="p-4">
                      {app.created_at ? new Date(app.created_at).toLocaleDateString() : "-"}
                    </td>
                    <td className="p-4">{app.employee_id}</td>
                    <td className="p-4">{app.name || "-"}</td>
                    <td className="p-4">
                      {app.start_date} → {app.end_date}
                    </td>
                    <td className="p-4">
                      {app.start_time || "-"} → {app.end_time || "-"}
                    </td>
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
                    <td className="p-4 flex items-center gap-1 justify-center">
                      <input
                        type="text"
                        defaultValue={app.hr_notes || ""}
                        placeholder="Optional notes"
                        className="px-2 py-1 border rounded-md text-sm"
                        id={`hrnote-${app.id}`}
                      />
                      <button
                        onClick={() =>
                          handleUpdate(
                            app.id,
                            app.status,
                            document.getElementById(`hrnote-${app.id}`).value
                          )
                        }
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                      >
                        ↑
                      </button>
                    </td>
                    <td className="p-4">
                      <select
                        defaultValue={app.status}
                        onChange={(e) => setConfirmModal({ id: app.id, newStatus: e.target.value })}
                        className="px-2 py-1 border rounded-md text-sm"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9" className="p-6 text-center text-gray-500">
                  No applications found.
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

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative text-center">
            <h3 className="text-xl font-bold text-indigo-700 mb-4">
              Confirm change to {confirmModal.newStatus}?
            </h3>
            <div className="flex gap-4 justify-center">
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                onClick={() =>
                  handleUpdate(confirmModal.id, confirmModal.newStatus, "")
                }
              >
                Yes
              </button>
              <button
                className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {notification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative text-center">
            <h3
              className={`text-xl font-bold mb-4 ${
                notification.type === "success" ? "text-green-600" : "text-red-600"
              }`}
            >
              {notification.message}
            </h3>
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              onClick={() => setNotification(null)}
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

export default WorkApplicationRequests;