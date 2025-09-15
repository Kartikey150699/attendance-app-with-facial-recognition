import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  UsersIcon,
  UserGroupIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";

function ManageUsers() {
  const [dateTime, setDateTime] = useState(new Date());
  const [activeSection, setActiveSection] = useState(null);
  const [users, setUsers] = useState([]);
  const [currentName, setCurrentName] = useState("");
  const [newName, setNewName] = useState("");
  const [deleteName, setDeleteName] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [popup, setPopup] = useState(null); // success/error popup

  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch user list
  const fetchUsers = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/users/active");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("❌ Failed to fetch users:", err);
    }
  };

  // Change user name
  const handleChangeName = async () => {
    if (!currentName || !newName) {
      setPopup({
        type: "error",
        message: "⚠️ Please enter both current and new name.",
      });
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
        setPopup({
          type: "error",
          message: data.detail || data.error || "❌ Failed to update user name.",
        });
        return;
      }

      setPopup({ type: "success", message: data.message });
      setCurrentName("");
      setNewName("");
      fetchUsers();
    } catch (err) {
      console.error("❌ Failed to change name:", err);
      setPopup({
        type: "error",
        message: "❌ Could not connect to the server.",
      });
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/users/delete-by-name/${deleteName.trim()}`,
        { method: "DELETE" }
      );
      const data = await res.json();

      if (!res.ok) {
        setPopup({
          type: "error",
          message: data.detail || data.error || "❌ Failed to delete user.",
        });
      } else {
        setPopup({ type: "success", message: data.message });
      }

      setDeleteName("");
      setShowConfirm(false);
      fetchUsers();
    } catch (err) {
      console.error("❌ Failed to delete user:", err);
      setPopup({
        type: "error",
        message: "❌ Could not connect to the server.",
      });
    }
  };

  // Handle popup close (reset to default page)
  const handlePopupClose = () => {
    setPopup(null);
    setActiveSection(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md">
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
            Back
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col items-center flex-grow py-10">
        <h2 className="text-3xl font-bold text-indigo-700 mb-10 flex items-center gap-2">
          <UsersIcon className="h-8 w-8 text-indigo-700" />
          Manage Users
        </h2>

        <div className="grid grid-cols-3 gap-8 mb-10">
          {/* Edit */}
          <button
            onClick={() => setActiveSection("edit")}
            className="px-10 py-6 bg-yellow-500 hover:bg-yellow-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <PencilSquareIcon className="h-6 w-6 text-white" />
            Edit User Info
          </button>

          {/* Delete */}
          <button
            onClick={() => setActiveSection("delete")}
            className="px-10 py-6 bg-red-600 hover:bg-red-700 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <TrashIcon className="h-6 w-6 text-white" />
            Delete User
          </button>

          {/* List */}
          <button
            onClick={() => {
              setActiveSection("list");
              fetchUsers();
            }}
            className="px-10 py-6 bg-green-600 hover:bg-green-700 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <UserGroupIcon className="h-6 w-6 text-white" />
            Show Users List
          </button>
        </div>

        {/* Edit Section */}
        {activeSection === "edit" && (
          <div className="bg-white p-6 rounded-lg shadow-md w-1/2 flex flex-col gap-4">
            <h3 className="text-xl font-bold text-indigo-700">Edit User Info</h3>
            <input
              type="text"
              placeholder="Current Name"
              value={currentName}
              onChange={(e) => setCurrentName(e.target.value)}
              className="p-3 border rounded"
            />
            <input
              type="text"
              placeholder="New Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="p-3 border rounded"
            />
            <div className="flex gap-4">
              <button
                onClick={handleChangeName}
                className="px-6 py-3 bg-yellow-500 text-white font-bold rounded-lg shadow hover:bg-yellow-600"
              >
                Change Name
              </button>
              <button
                onClick={() => {
                  setActiveSection(null);
                  setCurrentName("");
                  setNewName("");
                }}
                className="px-6 py-3 bg-gray-400 text-white font-bold rounded-lg shadow hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Delete Section */}
        {activeSection === "delete" && (
          <div className="bg-white p-6 rounded-lg shadow-md w-1/2 flex flex-col gap-4">
            <h3 className="text-xl font-bold text-red-600">Delete User</h3>
            <input
              type="text"
              placeholder="User Name"
              value={deleteName}
              onChange={(e) => setDeleteName(e.target.value)}
              className="p-3 border rounded"
            />
            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirm(true)}
                className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setActiveSection(null);
                  setDeleteName("");
                  setShowConfirm(false);
                }}
                className="px-6 py-3 bg-gray-400 text-white font-bold rounded-lg shadow hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>

            {showConfirm && (
              <div className="bg-gray-100 p-4 rounded shadow mt-4">
                <p>
                  Are you sure you want to delete <b>{deleteName}</b>?
                </p>
                <div className="flex gap-4 mt-2">
                  <button
                    onClick={handleDeleteUser}
                    className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg shadow hover:bg-red-700"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-6 py-2 bg-gray-400 text-white font-bold rounded-lg shadow hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users List */}
        {activeSection === "list" && (
          <div className="bg-white p-6 rounded-lg shadow-md w-2/3">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-green-600">Active Users</h3>
              <button
                onClick={() => setActiveSection(null)}
                className="px-4 py-2 bg-gray-400 text-white font-bold rounded-lg shadow hover:bg-gray-500"
              >
                Close
              </button>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-200">
                  <th className="p-2 border">ID</th>
                  <th className="p-2 border">Name</th>
                  <th className="p-2 border">Created At</th>
                </tr>
              </thead>
              <tbody>
  {users.map((u) => {
    // Convert backend UTC timestamp into client-local time
    const d = new Date(u.created_at);

    const datePart = d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short", // Sep
      day: "2-digit",
    });

    const timePart = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false, // 24-hour format
    });

    const formattedDate = `${datePart} - ${timePart}`;

    return (
      <tr key={u.id} className="text-center">
        <td className="p-2 border">{u.id}</td>
        <td className="p-2 border">{u.name}</td>
        <td className="p-2 border">{formattedDate}</td>
      </tr>
    );
  })}
</tbody>
            </table>
          </div>
        )}

        {/* Center Popup Modal */}
        {popup && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div
              className={`p-6 rounded-lg shadow-lg text-center w-1/3 ${
                popup.type === "success" ? "bg-green-100" : "bg-red-100"
              }`}
            >
              <p
                className={`text-lg font-bold mb-4 ${
                  popup.type === "success" ? "text-green-700" : "text-red-700"
                }`}
              >
                {popup.message}
              </p>
              <button
                onClick={handlePopupClose}
                className={`px-6 py-2 font-bold rounded-lg shadow ${
                  popup.type === "success"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

export default ManageUsers;