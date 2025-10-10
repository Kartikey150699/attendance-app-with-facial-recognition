import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  UsersIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { API_BASE } from "./config";

function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [currentName, setCurrentName] = useState("");
  const [newName, setNewName] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [popupMode, setPopupMode] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [attendanceData, setAttendanceData] = useState([]);
  const [showAttendanceView, setShowAttendanceView] = useState(false);

  // Month & Year filters
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const navigate = useNavigate();


  // Fetch active users only
  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/list`);
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("❌ Failed to fetch users:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch attendance logs for a user with filters (using hr_logs)
const fetchAttendance = async (user, month = selectedMonth, year = selectedYear) => {
  try {
    const employeeId = `IFNT${String(user.id).padStart(3, "0")}`;
    const res = await fetch(
      `${API_BASE}/hr_logs?year=${year}&month=${month}&employee_id=${employeeId}`
    );
    const data = await res.json();

    if (!res.ok) {
      setPopupMessage(data.detail || "❌ Failed to fetch attendance.");
      setPopupMode("message");
      setShowPopup(true);
    } else {
      setSelectedUser(user);
      setAttendanceData(data.logs || []);
      // If you also want totals later, you can store separately:
      // setMonthlyTotals(data.monthly_summary || {});
      setShowAttendanceView(true);
    }
  } catch (err) {
    console.error("❌ Fetch error:", err);
    setPopupMessage("❌ Could not connect to the server.");
    setPopupMode("message");
    setShowPopup(true);
  }
};
  // Handle update user
  const handleUpdateUser = async () => {
  if (!currentName || (!newName && !newDepartment)) {
    setPopupMessage("⚠️ Please enter new name and/or department.");
    setPopupMode("message");
    setShowPopup(true);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/users/update-user`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_employee_id: selectedUser.employee_id,
        new_name: newName.trim() || selectedUser.name,
        new_department: newDepartment.trim() || selectedUser.department,
      }),
    });

    const data = await res.json();
if (!res.ok) {
  if (Array.isArray(data.detail)) {
    // Pydantic validation error → collect messages
    const messages = data.detail.map(err => err.msg).join(", ");
    setPopupMessage(`❌ ${messages}`);
  } else {
    setPopupMessage(data.detail || "❌ Failed to update user.");
  }
} else {
  setPopupMessage("✅ User updated successfully!");
  fetchUsers();
}
  } catch (err) {
    setPopupMessage("❌ Could not connect to the server.");
  } finally {
    setPopupMode("message");
    setShowPopup(true);
    setCurrentName("");
    setNewName("");
    setNewDepartment("");
  }
};

  // Handle delete user
  const confirmDeleteUser = async () => {
    if (!selectedUser) return;

    try {
const res = await fetch(`${API_BASE}/users/delete-by-name/${selectedUser.name}`, {
  method: "DELETE",
});
      const data = await res.json();

      if (!res.ok) {
        setPopupMessage(data.detail || "❌ Failed to delete user.");
      } else {
        setPopupMessage(`✅ User "${selectedUser.name}" deleted successfully!`);
        fetchUsers();
      }
    } catch (err) {
      setPopupMessage("❌ Could not connect to the server.");
    } finally {
      setPopupMode("message");
      setShowPopup(true);
      setSelectedUser(null);
    }
  };

  // Popup close
  const handlePopupClose = () => {
    setShowPopup(false);
    setPopupMessage("");
    setPopupMode(null);
    setSelectedUser(null);
  };

  // Format Employee ID
  const formatEmployeeId = (id) => {
    return `IFNT${String(id).padStart(3, "0")}`;
  };

  // Calculate overtime (>8h)
  const calculateOvertime = (totalWork) => {
    if (!totalWork || totalWork === "-") return "-";
    const [h, m] = totalWork.split("h");
    const hours = parseInt(h.trim(), 10) || 0;
    const minutes = parseInt(m?.replace("m", "").trim(), 10) || 0;
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes <= 480) return "-"; // 8h = 480m
    const otMinutes = totalMinutes - 480;
    const otHrs = Math.floor(otMinutes / 60);
    const otMins = otMinutes % 60;
    return `${otHrs}h ${otMins}m`;
  };

  // Filtered list
  const filteredUsers = users.filter(
    (u) =>
      u.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Months for dropdown
  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(0, i).toLocaleString("default", { month: "long" })
  );

  // Status → CSS classes
const getStatusClass = (status) => {
  if (!status) return "text-gray-600 font-medium";

  if (status.includes("Present")) return "text-green-600 font-bold";
  if (status === "On Leave") return "text-blue-600 font-bold";
  if (status === "Holiday") return "text-indigo-600 font-bold";
  if (status === "Worked on Holiday") return "text-purple-600 font-bold";
  if (status === "Absent") return "text-red-600 font-bold";

  return "text-gray-600 font-medium";
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
        FaceTrack <span className="font-light text-gray-300 ml-1">Users</span>
      </h1>
    </div>

    {/* Right: Date & Time + Back button */}
    <div className="flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-4 mt-3 sm:mt-0">
      {/* Date & Time */}
      <div className="text-center text-sm sm:text-base md:text-lg font-semibold text-white tracking-wide drop-shadow-md order-2 sm:order-1">
        <HeaderDateTime />
      </div>

      {/* Back Button */}
      <button
        onClick={() => navigate("/admin-dashboard")}
        className="px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 via-pink-500 to-rose-500 
                   hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl 
                   transition-all duration-300 flex items-center gap-2 order-1 sm:order-2"
      >
        <ArrowUturnLeftIcon className="h-5 w-5" />
        Back
      </button>
    </div>
  </div>
</header>

      {/* Attendance View */}
      {showAttendanceView && selectedUser ? (
        <div className="flex flex-col flex-grow p-4 sm:p-10 relative">
{/* Close Button - Responsive Fix */}
<div className="w-full flex justify-center sm:justify-end mb-4 sm:mb-0 sm:absolute sm:top-6 sm:right-6 z-10">
  <button
    onClick={() => {
      setShowAttendanceView(false);
      setAttendanceData([]);
      setSelectedUser(null);
    }}
    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow flex items-center justify-center gap-2 text-sm sm:text-base"
  >
    <XMarkIcon className="h-5 w-5" />
    <span className="hidden sm:inline">Close</span>
  </button>
</div>

          {/* User Info */}
          <h2 className="text-3xl font-bold text-indigo-700 mb-2">
  {selectedUser.name} ({formatEmployeeId(selectedUser.id)})
</h2>
<p className="text-lg text-gray-700 mb-6">
  <b>Department:</b> {selectedUser.department || "—"}
</p>
          <p className="text-lg mb-4 text-gray-700">
            <b>Created At:</b>{" "}
            {new Date(selectedUser.created_at).toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>

          {/* Month/Year Selectors */}
          <div className="flex gap-4 mb-6">
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                fetchAttendance(selectedUser, e.target.value, selectedYear);
              }}
              className="px-4 py-2 border rounded-lg shadow focus:ring-2 focus:ring-indigo-500"
            >
              {months.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                fetchAttendance(selectedUser, selectedMonth, e.target.value);
              }}
              className="px-4 py-2 border rounded-lg shadow focus:ring-2 focus:ring-indigo-500"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(
                (y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Attendance Logs */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md overflow-x-auto w-[95%] sm:w-[90%] mx-auto">
            <h3 className="text-xl font-bold text-green-600 mb-4">Attendance Logs</h3>
            <table className="min-w-[550px] sm:min-w-[800px] w-full border-collapse text-[10px] sm:text-[13px] md:text-base">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-2 py-1 sm:px-3 sm:py-2 border">Date</th>
                  <th className="px-2 py-1 sm:px-3 sm:py-2 border">Check-in</th>
                  <th className="px-2 py-1 sm:px-3 sm:py-2 border">Check-out</th>
                  <th className="px-2 py-1 sm:px-3 sm:py-2 border">Total Work</th>
                  <th className="px-2 py-1 sm:px-3 sm:py-2 border">Overtime</th>
                  <th className="px-2 py-1 sm:px-3 sm:py-2 border">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.length > 0 ? (
                  attendanceData.map((log, i) => (
                    <tr key={i} className="text-center">
                      <td className="px-2 py-1 sm:px-3 sm:py-2 border">
                        {new Date(log.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-2 py-1 sm:px-3 sm:py-2 border">{log.check_in}</td>
                      <td className="px-2 py-1 sm:px-3 sm:py-2 border">{log.check_out}</td>
                      <td className="px-2 py-1 sm:px-3 sm:py-2 border">{log.actual_work || "-"}</td>
                      <td className="px-2 py-1 sm:px-3 sm:py-2 border">{calculateOvertime(log.total_work)}</td>
                      <td className={`p-2 border ${getStatusClass(log.status)}`}>
                        {log.status || "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="p-4 text-gray-500">
                      No attendance records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* User List View */
        <div className="flex flex-col items-center flex-grow py-6 sm:py-10 px-3 sm:px-0">
          <h2 className="text-4xl font-bold text-indigo-700 mb-10 flex items-center gap-2">
            <UsersIcon className="h-8 w-8 text-indigo-700" />
            Manage Users
          </h2>

          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md w-[95%] sm:w-4/5 md:w-2/3 overflow-x-auto">
            <h3 className="text-xl font-bold text-green-600 mb-4">Active Users</h3>

            {/* Search bar */}
            <input
              type="text"
              placeholder="Search by Employee ID or Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full mb-4 px-4 py-2 border-2 border-indigo-400 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

            <table className="min-w-[600px] sm:min-w-[800px] w-full border-collapse text-[10px] sm:text-[13px] md:text-base">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-2 py-1 sm:px-3 sm:py-2 border">Employee ID</th>
                  <th className="px-2 py-1 sm:px-3 sm:py-2 border">Department</th>
                  <th className="px-2 py-1 sm:px-3 sm:py-2 border">Name</th>
                  <th className="px-2 py-1 sm:px-3 sm:py-2 border">Created At</th>
                  <th className="px-2 py-1 sm:px-3 sm:py-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
  {filteredUsers.length > 0 ? (
    filteredUsers.map((u) => {
      const d = new Date(u.created_at);
      const formattedDate = `${d.toLocaleDateString()} - ${d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })}`;
      return (
        <tr key={u.id} className="text-center">
          {/* Employee ID */}
          <td className="px-2 py-1 sm:px-3 sm:py-2 border">{formatEmployeeId(u.id)}</td>

          {/* Department */}
          <td className="px-2 py-1 sm:px-3 sm:py-2 border">{u.department || "—"}</td>

          {/* Name */}
          <td
            className="px-2 py-1 sm:px-3 sm:py-2 border text-blue-600 cursor-pointer hover:underline"
            onClick={() => fetchAttendance(u)}
          >
            {u.name}
          </td>

          {/* Created At */}
          <td className="px-2 py-1 sm:px-3 sm:py-2 border">{formattedDate}</td>

          {/* Actions */}
          <td className="px-2 py-1 sm:px-3 sm:py-2 border flex gap-2 justify-center">
            <button
              onClick={() => {
                setSelectedUser(u);
                setCurrentName(u.name);
                setNewName("");            // always blank
                setNewDepartment("");      // always blank
                setPopupMode("edit");
                setShowPopup(true);
              }}
              className="px-3 py-1 bg-yellow-500 text-white rounded-lg shadow hover:bg-yellow-600 flex items-center gap-1"
            >
              <PencilSquareIcon className="h-4 w-4" /> Edit
            </button>
            <button
              onClick={() => {
                setSelectedUser(u);
                setPopupMode("delete");
                setShowPopup(true);
              }}
              className="px-3 py-1 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 flex items-center gap-1"
            >
              <TrashIcon className="h-4 w-4" /> Delete
            </button>
          </td>
        </tr>
      );
    })
  ) : (
    <tr>
      <td colSpan="5" className="p-4 text-gray-500">
        No users found
      </td>
    </tr>
  )}
</tbody>
            </table>
          </div>
        </div>
      )}

      {showPopup && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-[90%] sm:w-full max-w-md relative mx-3">
{/* Proper Close Button for Popup */}
<button
  onClick={handlePopupClose}
  className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 transition-colors"
>
  <XMarkIcon className="h-6 w-6" />
</button>

      {/* EDIT MODE */}
      {popupMode === "edit" && selectedUser && (
  <div className="flex flex-col gap-4">
    <h3 className="text-xl font-bold text-indigo-700 mb-2">Edit User</h3>

    {/* Show current info */}
    <p className="text-gray-700">
      <b>Current Name:</b> {selectedUser.name}
    </p>
    <p className="text-gray-700">
      <b>Current Department:</b> {selectedUser.department || "—"}
    </p>

    {/* Input for new values */}
    <input
      type="text"
      value={newName}
      onChange={(e) => setNewName(e.target.value)}
      placeholder="Enter new name"
      className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
    />
    <input
      type="text"
      value={newDepartment}
      onChange={(e) => setNewDepartment(e.target.value)}
      placeholder="Enter new department"
      className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
    />

    <button
      onClick={handleUpdateUser}
      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
    >
      Save Changes
    </button>
  </div>
)}

      {/* DELETE MODE */}
      {popupMode === "delete" && selectedUser && (
        <div className="text-center">
          <h3 className="text-xl font-bold text-red-600 mb-4">
            Delete {selectedUser.name}?
          </h3>
          <div className="flex justify-center gap-4">
            <button
              onClick={confirmDeleteUser}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Yes, Delete
            </button>
            <button
              onClick={handlePopupClose}
              className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* MESSAGE MODE */}
      {popupMode === "message" && (
        <div className="text-center">
          <p className="mb-4">{popupMessage}</p>
          <button
            onClick={handlePopupClose}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            OK
          </button>
        </div>
      )}
    </div>
  </div>
)}

      <Footer />
    </div>
  );
}

export default ManageUsers;