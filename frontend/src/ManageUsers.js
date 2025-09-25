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

function ManageUsers() {
  const [dateTime, setDateTime] = useState(new Date());
  const [users, setUsers] = useState([]);
  const [currentName, setCurrentName] = useState("");
  const [newName, setNewName] = useState("");
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

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch active users only
  const fetchUsers = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/users/list");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("❌ Failed to fetch users:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch attendance logs for a user with filters
  const fetchAttendance = async (user, month = selectedMonth, year = selectedYear) => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/attendance/user/${user.id}?month=${month}&year=${year}`
      );
      const data = await res.json();
      if (!res.ok) {
        setPopupMessage(data.detail || "❌ Failed to fetch attendance.");
        setPopupMode("message");
        setShowPopup(true);
      } else {
        setSelectedUser(user);
        setAttendanceData(data);
        setShowAttendanceView(true);
      }
    } catch (err) {
      setPopupMessage("❌ Could not connect to the server.");
      setPopupMode("message");
      setShowPopup(true);
    }
  };

  // Handle name update
  const handleUpdateName = async () => {
    if (!currentName || !newName) {
      setPopupMessage("⚠️ Please enter both current and new name.");
      setPopupMode("message");
      setShowPopup(true);
      return;
    }

    if (currentName.trim().toLowerCase() === newName.trim().toLowerCase()) {
      setPopupMessage("⚠️ Current name and new name cannot be the same.");
      setPopupMode("message");
      setShowPopup(true);
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/users/update-name", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_name: currentName.trim(),
          new_name: newName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPopupMessage(data.detail || "❌ Failed to update user name.");
      } else {
        setPopupMessage(`✅ User name updated successfully!\nNew Name: ${newName}`);
        fetchUsers();
      }
    } catch (err) {
      setPopupMessage("❌ Could not connect to the server.");
    } finally {
      setPopupMode("message");
      setShowPopup(true);
      setCurrentName("");
      setNewName("");
    }
  };

  // Handle delete user
  const confirmDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/users/delete-by-name/${selectedUser.name}`,
        { method: "DELETE" }
      );
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

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md">
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
                       active:scale-95 transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <ArrowUturnLeftIcon className="h-5 w-5 text-white" />
            Back
          </button>
        </div>
      </div>

      {/* Attendance View */}
      {showAttendanceView && selectedUser ? (
        <div className="flex flex-col flex-grow p-10 relative">
          {/* Close Button */}
          <button
            onClick={() => {
              setShowAttendanceView(false);
              setAttendanceData([]);
              setSelectedUser(null);
            }}
            className="absolute top-6 right-6 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow flex items-center gap-2"
          >
            <XMarkIcon className="h-5 w-5" /> Close
          </button>

          {/* User Info */}
          <h2 className="text-3xl font-bold text-indigo-700 mb-6">
            {selectedUser.name} ({formatEmployeeId(selectedUser.id)})
          </h2>
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
          <div className="bg-white p-6 rounded-lg shadow-md overflow-auto">
            <h3 className="text-xl font-bold text-green-600 mb-4">Attendance Logs</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-200">
                  <th className="p-2 border">Date</th>
                  <th className="p-2 border">Check-in</th>
                  <th className="p-2 border">Check-out</th>
                  <th className="p-2 border">Total Work</th>
                  <th className="p-2 border">Overtime</th>
                  <th className="p-2 border">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.length > 0 ? (
                  attendanceData.map((log, i) => (
                    <tr key={i} className="text-center">
                      <td className="p-2 border">
                        {new Date(log.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="p-2 border">
                        {log.check_in
                          ? new Date(log.check_in).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td className="p-2 border">
                        {log.check_out
                          ? new Date(log.check_out).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td className="p-2 border">{log.total_work || "-"}</td>
                      <td className="p-2 border">{calculateOvertime(log.total_work)}</td>
                      <td className="p-2 border">{log.status || "-"}</td>
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
        <div className="flex flex-col items-center flex-grow py-10">
          <h2 className="text-4xl font-bold text-indigo-700 mb-10 flex items-center gap-2">
            <UsersIcon className="h-8 w-8 text-indigo-700" />
            Manage Users
          </h2>

          <div className="bg-white p-6 rounded-lg shadow-md w-2/3">
            <h3 className="text-xl font-bold text-green-600 mb-4">Active Users</h3>

            {/* Search bar */}
            <input
              type="text"
              placeholder="Search by Employee ID or Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full mb-4 px-4 py-2 border-2 border-indigo-400 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-200">
                  <th className="p-2 border">Employee ID</th>
                  <th className="p-2 border">Name</th>
                  <th className="p-2 border">Created At</th>
                  <th className="p-2 border">Actions</th>
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
                        <td className="p-2 border">{formatEmployeeId(u.id)}</td>
                        <td
                          className="p-2 border text-blue-600 cursor-pointer hover:underline"
                          onClick={() => fetchAttendance(u)}
                        >
                          {u.name}
                        </td>
                        <td className="p-2 border">{formattedDate}</td>
                        <td className="p-2 border flex gap-2 justify-center">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setCurrentName(u.name);
                              setNewName("");
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
                    <td colSpan="4" className="p-4 text-gray-500">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default ManageUsers;