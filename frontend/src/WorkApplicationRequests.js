import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  PlusIcon,
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
  const [confirmModal, setConfirmModal] = useState(null);

  // Notification modal
  const [notification, setNotification] = useState(null);

  // Pagination + filters
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

// Approvers modal
const [approverModal, setApproverModal] = useState(null);

// Add approver modal state
const [addApproverModal, setAddApproverModal] = useState(false);
const [newApproverId, setNewApproverId] = useState("");
const [newLevel, setNewLevel] = useState("");

// Edit approver modal state
const [editApproverModal, setEditApproverModal] = useState(null);
const [editApproverId, setEditApproverId] = useState("");
const [editLevel, setEditLevel] = useState("");

// Users list (for dropdowns)
const [users, setUsers] = useState([]);



  useEffect(() => {
  const fetchData = async () => {
    try {
      // Fetch applications
      const resApps = await fetch("http://localhost:8000/work-applications/");
      if (!resApps.ok) throw new Error("Failed to fetch applications");
      const appsData = await resApps.json();
      setApplications(appsData);

      // Fetch users
      const resUsers = await fetch("http://localhost:8000/users/list");
      if (!resUsers.ok) throw new Error("Failed to fetch users");
      const usersData = await resUsers.json();
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  fetchData();
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
        .map((val) => {
          if (val === null || val === undefined) return "";
          if (val instanceof Date) return val.toISOString();
          if (typeof val === "object") return JSON.stringify(val); // ✅ fix for nested objects
          return String(val);
        })
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort((a, b) => {
  // Always keep "Pending" applications on top
  if (a.status === "Pending" && b.status !== "Pending") return -1;
  if (a.status !== "Pending" && b.status === "Pending") return 1;

  // If no manual sort applied → default to latest created_at first
  if (!sortConfig.key || !sortConfig.direction) {
    return new Date(b.created_at) - new Date(a.created_at);
  }

  // Respect manual sort (existing logic)
  const dir = sortConfig.direction === "ascending" ? 1 : -1;
  if (sortConfig.key.includes("date")) {
    return new Date(a[sortConfig.key]) > new Date(b[sortConfig.key]) ? dir : -dir;
  }
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

// -------------------------
// Add Approver
// -------------------------
const handleAddApprover = async () => {
  if (!newApproverId || !newLevel) {
    setNotification({ type: "error", message: "⚠️ Please select approver and level." });
    return;
  }

  try {
    const res = await fetch("http://localhost:8000/approvers/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        work_application_id: approverModal.work_application_id,
        approver_id: newApproverId,
        level: newLevel,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to add approver");

    // Refresh list
    const refresh = await fetch(
      `http://localhost:8000/approvers/${approverModal.work_application_id}`
    );
    const approvers = await refresh.json();

    setApproverModal((prev) => ({
      ...prev,
      approvers,
    }));

    setNewApproverId("");
    setNewLevel("");
    setAddApproverModal(false);
    setNotification({ type: "success", message: "✅ Approver added successfully!" });
  } catch (error) {
    console.error("Error adding approver:", error);
    setNotification({ type: "error", message: "❌ Failed to add approver." });
  }
};

// -------------------------
// Delete Approver (confirmed)
// -------------------------
const handleDeleteApproverConfirmed = async (approverId) => {
  try {
    const res = await fetch(`http://localhost:8000/approvers/${approverId}`, {
      method: "DELETE",
    });

    if (!res.ok) throw new Error("Failed to delete approver");

    // Refresh list
    const refresh = await fetch(
      `http://localhost:8000/approvers/${approverModal.work_application_id}`
    );
    const approvers = await refresh.json();

    setApproverModal((prev) => ({
      ...prev,
      approvers,
    }));

    setNotification({ type: "success", message: "🗑️ Approver deleted successfully!" });
  } catch (error) {
    console.error("Error deleting approver:", error);
    setNotification({ type: "error", message: "❌ Failed to delete approver." });
  }
};

// -------------------------
// Delete Approver (open confirm modal)
// -------------------------
const handleDeleteApprover = (approverId) => {
  setConfirmModal({
    message: "Are you sure you want to delete this approver?",
    onConfirm: () => handleDeleteApproverConfirmed(approverId),
  });
};

// -------------------------
// Edit Approver (confirmed)
// -------------------------
const handleEditApproverConfirmed = async (approverId) => {
  if (!editApproverId || !editLevel) {
    setNotification({ type: "error", message: "⚠️ Please select approver and level." });
    return;
  }

  try {
    const res = await fetch(
      `http://localhost:8000/approvers/${approverId}/update`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approver_id: editApproverId,
          new_level: editLevel,
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to update approver");

    // Refresh list
    const refresh = await fetch(
      `http://localhost:8000/approvers/${approverModal.work_application_id}`
    );
    const approvers = await refresh.json();

    setApproverModal((prev) => ({
      ...prev,
      approvers,
    }));

    setEditApproverId("");
    setEditLevel("");
    setEditApproverModal(null);

    setNotification({ type: "success", message: "✅ Approver updated successfully!" });
  } catch (error) {
    console.error("Error editing approver:", error);
    setNotification({ type: "error", message: "❌ Failed to update approver." });
  }
};

// -------------------------
// Edit Approver (open confirm modal)
// -------------------------
const handleEditApprover = (approverId) => {
  setConfirmModal({
    message: "Are you sure you want to update this approver?",
    onConfirm: () => handleEditApproverConfirmed(approverId),
  });
};

// -------------------------
// Open Approver Modal per application
// -------------------------
const openApproverModal = async (application) => {
  try {
    const res = await fetch(`http://localhost:8000/approvers/${application.id}`);
    let approvers = [];
    if (res.ok) {
      approvers = await res.json();
    }

    setApproverModal({
      work_application_id: application.id,   // store app.id
      employee_id: application.employee_id,  // useful for context
      name: application.name,
      approvers: approvers, // specific to this application
    });
  } catch (error) {
    console.error("Error fetching approvers:", error);
    setApproverModal({
      work_application_id: application.id,
      employee_id: application.employee_id,
      name: application.name,
      approvers: [],
    });
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
          <ClipboardDocumentListIcon className="h-8 w-8 text-indigo-700" />
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
<div className="max-w-7xl w-full mx-auto px-4 mb-12 overflow-x-auto">
  <table className="w-full border-collapse bg-white shadow rounded-lg text-sm">
    <thead>
      <tr className="bg-indigo-500 text-white text-xs">
        <th className="px-2 py-2 cursor-pointer" onClick={() => requestSort("created_at")}>
          Date {getArrow("created_at")}
        </th>
        <th className="px-2 py-2">Emp ID</th>
        <th className="px-2 py-2">Name</th>
        <th className="px-2 py-2">Dept</th>
        <th className="px-2 py-2">Type</th>
        <th className="px-2 py-2">Paid</th>
        <th className="px-2 py-2">
          Dates <br />
          <span className="text-[10px]">(S → E)</span>
        </th>
        <th className="px-2 py-2">
          Times <br />
          <span className="text-[10px]">(S → E)</span>
        </th>
        <th className="px-2 py-2">Reason</th>
        <th className="px-2 py-2 cursor-pointer" onClick={() => requestSort("status")}>
          Status {getArrow("status")}
        </th>
        <th className="px-2 py-2">Notes</th>
        <th className="px-2 py-2">Approvers</th>
      </tr>
    </thead>
    <tbody>
      {currentRows.length > 0 ? (
        currentRows.map((app) => {
          const isLong = app.reason && app.reason.length > 20;
          const displayReason = isLong ? app.reason.slice(0, 20) + "..." : app.reason;

          return (
            <tr
              key={app.id}
              className={`text-center border-b ${
                app.status === "Pending" ? "bg-yellow-100" : "bg-white"
              }`}
            >
              <td className="px-2 py-1">
                {new Date(app.created_at).toLocaleDateString("en-US", {
                  year: "2-digit",
                  month: "short",
                  day: "numeric",
                })}
              </td>
              <td className="px-2 py-1">{app.employee_id}</td>
              <td className="px-2 py-1">{app.name || "-"}</td>
              <td className="px-2 py-1">{app.department || "-"}</td>
              <td className="px-2 py-1">{app.application_type || "-"}</td>
              <td className="px-2 py-1 font-semibold">
                {app.use_paid_holiday === "yes" ? (
                  <span className="text-green-600">Yes</span>
                ) : (
                  <span className="text-gray-500">No</span>
                )}
              </td>
              <td className="px-2 py-1 text-xs leading-tight">
                <div>
                  S:{" "}
                  {new Date(app.start_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div>
                  E:{" "}
                  {new Date(app.end_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </td>
              <td className="px-2 py-1 text-xs leading-tight">
                <div>
                  S:{" "}
                  {app.start_time
                    ? new Date(`1970-01-01T${app.start_time}`).toLocaleTimeString(
                        [],
                        { hour: "2-digit", minute: "2-digit" }
                      )
                    : "-"}
                </div>
                <div>
                  E:{" "}
                  {app.end_time
                    ? new Date(`1970-01-01T${app.end_time}`).toLocaleTimeString(
                        [],
                        { hour: "2-digit", minute: "2-digit" }
                      )
                    : "-"}
                </div>
              </td>
              <td
                className="px-2 py-1 text-blue-700 underline cursor-pointer"
                onClick={() => setSelectedReason(app.reason)}
              >
                {displayReason}
              </td>
              <td
                className={`px-2 py-1 font-bold ${
                  app.status === "Approved"
                    ? "text-green-600"
                    : app.status === "Rejected"
                    ? "text-red-600"
                    : "text-yellow-600"
                }`}
              >
                {app.status}
              </td>
              <td className="px-2 py-1 flex items-center gap-1 justify-center">
                <input
                  type="text"
                  defaultValue={app.hr_notes || ""}
                  placeholder="Notes"
                  className="w-20 px-1 py-0.5 border rounded text-xs"
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
                  className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs"
                >
                  ↑
                </button>
              </td>
              <td className="px-2 py-1">
                <button
                  onClick={() => openApproverModal(app)}
                  className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs"
                >
                  Details
                </button>
              </td>
            </tr>
          );
        })
      ) : (
        <tr>
          <td colSpan="12" className="p-6 text-center text-gray-500">
            No applications found.
          </td>
        </tr>
      )}
    </tbody>
  </table>

  {/* Pagination */}
  <div className="flex justify-between items-center mt-4 text-sm">
    <button
      disabled={currentPage === 1}
      onClick={() => setCurrentPage((prev) => prev - 1)}
      className={`px-3 py-1 rounded-md font-semibold shadow ${
        currentPage === 1
          ? "bg-gray-300 text-gray-600 cursor-not-allowed"
          : "bg-indigo-600 text-white hover:bg-indigo-700"
      }`}
    >
      Previous
    </button>
    <span className="font-medium">
      Page {currentPage} of {totalPages || 1}
    </span>
    <button
      disabled={currentPage === totalPages || totalPages === 0}
      onClick={() => setCurrentPage((prev) => prev + 1)}
      className={`px-3 py-1 rounded-md font-semibold shadow ${
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

    {/* Approver Modal (Main List) */}
{approverModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 relative">
      {/* Close */}
      <button
        onClick={() => setApproverModal(null)}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
      >
        <XMarkIcon className="h-6 w-6" />
      </button>

      {/* Title */}
      <h3 className="text-xl font-bold text-indigo-700 mb-4">
  Approvers for {approverModal.name} ({approverModal.employee_id})
</h3>

      {/* Approver List */}
<ul className="mb-4">
  {approverModal.approvers && approverModal.approvers.length > 0 ? (
    approverModal.approvers.map((a, i) => {
      // Dynamic color shades for levels
      const levelColors = [
        "bg-indigo-900 text-white", // Level 1 (darkest)
        "bg-indigo-700 text-white", // Level 2
        "bg-indigo-500 text-white", // Level 3
        "bg-indigo-300 text-black", // Level 4
        "bg-indigo-100 text-black", // Level 5+
      ];

      const colorClass =
        levelColors[a.level - 1] || "bg-gray-200 text-black"; // fallback for higher levels

      // Status badge colors
      const statusColors =
        a.status === "Approved"
          ? "bg-green-100 text-green-700"
          : a.status === "Rejected"
          ? "bg-red-100 text-red-700"
          : "bg-yellow-100 text-yellow-700"; // default Pending

      return (
        <li
          key={a.id}
          className={`flex justify-between items-center p-3 rounded mb-2 shadow ${colorClass}`}
        >
          <div>
            <span>
              Level {a.level}: <b>{a.approver_name}</b>
            </span>
            <span
              className={`ml-3 px-2 py-1 rounded text-xs font-bold ${statusColors}`}
            >
              {a.status || "Pending"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                setEditApproverModal({
                  approverId: a.id,
                  currentLevel: a.level,
                  currentApproverId: a.approver_id,
                })
              }
              className="px-2 py-1 bg-yellow-400 hover:bg-yellow-500 text-black rounded text-sm"
            >
              Edit
            </button>
            <button
              onClick={() => handleDeleteApprover(a.id)}
              className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
            >
              Delete
            </button>
          </div>
        </li>
      );
    })
  ) : (
    <p className="text-gray-500">No approvers assigned yet.</p>
  )}
</ul>

      {/* Add Approver Button */}
      <button
  onClick={() => setAddApproverModal(true)}
  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow"
>
  <PlusIcon className="w-5 h-5" />
  Add Approver
</button>
    </div>
  </div>
)}

{/* Add Approver Modal */}
{addApproverModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
      <button
        onClick={() => setAddApproverModal(false)}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
      >
        <XMarkIcon className="h-6 w-6" />
      </button>
      <h3 className="text-lg font-bold text-indigo-700 mb-4">Add Approver</h3>

      <select
  value={newApproverId}
  onChange={(e) => setNewApproverId(e.target.value)}
  className="w-full px-3 py-2 border rounded mb-3"
>
  <option value="">-- Select Approver --</option>
  {users
    .filter(
      (u) =>
        !(approverModal.approvers || []).some(
          (a) => a.approver_id === u.employee_id // exclude already added approvers
        )
    )
    .map((u) => (
      <option key={u.employee_id} value={u.employee_id}>
        {u.name} ({u.employee_id})
      </option>
    ))}
</select>

      <input
        type="number"
        placeholder="Level"
        min="1"
        value={newLevel}
        onChange={(e) => setNewLevel(Number(e.target.value))}
        className="w-full px-3 py-2 border rounded mb-4"
      />

      <button
        onClick={handleAddApprover}
        className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow"
      >
        Save
      </button>
    </div>
  </div>
)}

{/* Edit Approver Modal */}
{editApproverModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
      <button
        onClick={() => setEditApproverModal(null)}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
      >
        <XMarkIcon className="h-6 w-6" />
      </button>
      <h3 className="text-lg font-bold text-indigo-700 mb-4">Edit Approver</h3>

      <select
        value={editApproverId}
        onChange={(e) => setEditApproverId(e.target.value)}
        className="w-full px-3 py-2 border rounded mb-3"
      >
        <option value="">-- Select Approver --</option>
        {users.map((u) => (
          <option key={u.employee_id} value={u.employee_id}>
            {u.name} ({u.employee_id})
          </option>
        ))}
      </select>

      <input
        type="number"
        placeholder="Level"
        min="1"
        value={editLevel}
        onChange={(e) => setEditLevel(Number(e.target.value))}
        className="w-full px-3 py-2 border rounded mb-4"
      />

      <button
        onClick={() => handleEditApprover(editApproverModal.id)}
        className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg shadow"
      >
        Update
      </button>
    </div>
  </div>
)}

{/* Notification Modal */}
{notification && (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
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

{/* Confirm Modal */}
{confirmModal && (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
      <h3 className="text-xl font-bold text-indigo-700 mb-4">
        {confirmModal.message}
      </h3>
      <div className="flex justify-center gap-4">
        <button
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          onClick={() => {
            confirmModal.onConfirm();
            setConfirmModal(null);
          }}
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

      <Footer />
    </div>
  );
}

export default WorkApplicationRequests;