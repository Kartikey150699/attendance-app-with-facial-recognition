import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  UsersIcon,
  PencilSquareIcon,
  TrashIcon,
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

  // Handle name update
  const handleUpdateName = async () => {
    if (!currentName || !newName) {
      setPopupMessage("⚠️ Please enter both current and new name.");
      setPopupMode("message");
      return;
    }

    if (currentName.trim().toLowerCase() === newName.trim().toLowerCase()) {
      setPopupMessage("⚠️ Current name and new name cannot be the same.");
      setPopupMode("message");
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

  // Filtered list
  const filteredUsers = users.filter(
    (u) =>
      u.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase())
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
    // clear admin session
    localStorage.removeItem("currentAdmin");
    // redirect home and prevent back navigation
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

      {/* Body */}
      <div className="flex flex-col items-center flex-grow py-10">
        <h2 className="text-4xl font-bold text-indigo-700 mb-10 flex items-center gap-2">
          <UsersIcon className="h-8 w-8 text-indigo-700" />
          Manage Users
        </h2>

        {/* User List */}
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
                      <td className="p-2 border">{u.name}</td>
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

      {/* Popups */}
      {showPopup && popupMode === "edit" && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="p-8 bg-white rounded-2xl shadow-2xl text-center w-[400px]">
            <h2 className="text-2xl font-bold text-indigo-700 mb-4">Edit User</h2>
            <input
              type="text"
              value={currentName}
              disabled
              className="p-3 border rounded w-full mb-4 bg-gray-100"
            />
            <input
              type="text"
              placeholder="New Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="p-3 border rounded w-full mb-4"
            />
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleUpdateName}
                className="px-6 py-2 bg-yellow-500 text-white font-bold rounded-lg shadow hover:bg-yellow-600"
              >
                Save
              </button>
              <button
                onClick={handlePopupClose}
                className="px-6 py-2 bg-gray-400 text-white font-bold rounded-lg shadow hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showPopup && popupMode === "delete" && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="p-8 bg-white rounded-2xl shadow-2xl text-center w-[400px]">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Delete User</h2>
            <p className="mb-6">
              Are you sure you want to delete <b>{selectedUser?.name}</b>?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={confirmDeleteUser}
                className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg shadow hover:bg-red-700"
              >
                Yes, Delete
              </button>
              <button
                onClick={handlePopupClose}
                className="px-6 py-2 bg-gray-400 text-white font-bold rounded-lg shadow hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showPopup && popupMode === "message" && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div
            className={`p-8 rounded-2xl shadow-2xl text-center transform transition-all duration-300 scale-100 ${
              popupMessage.startsWith("✅")
                ? "bg-green-50 border-2 border-green-400"
                : "bg-red-50 border-2 border-red-400"
            }`}
          >
            <h2
              className={`text-2xl font-extrabold mb-4 ${
                popupMessage.startsWith("✅") ? "text-green-700" : "text-red-700"
              }`}
            >
              {popupMessage.startsWith("✅") ? "Success!" : "Error"}
            </h2>
            <p className="text-lg text-gray-800 mb-6 whitespace-pre-line">{popupMessage}</p>
            <button
              onClick={handlePopupClose}
              className={`px-6 py-2 font-bold rounded-lg shadow ${
                popupMessage.startsWith("✅")
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-red-600 text-white hover:bg-red-700"
              }`}
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

export default ManageUsers;