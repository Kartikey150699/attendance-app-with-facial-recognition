import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { EyeIcon, 
  EyeSlashIcon, 
  ArrowUturnLeftIcon, 
  ShieldCheckIcon,
  PlusIcon,
  TrashIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  UserPlusIcon,
  XMarkIcon
 } from "@heroicons/react/24/solid";
 import Footer from "./Footer";
 import HeaderDateTime from "./HeaderDateTime"; 

function ManageAdmin() {
  const [dateTime, setDateTime] = useState(new Date());
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAdminList, setShowAdminList] = useState(false);

  const [admins, setAdmins] = useState([]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [deleteUsername, setDeleteUsername] = useState("");
  const [popup, setPopup] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const resetForms = () => {
    setUsername("");
    setPassword("");
    setShowPassword(false);
    setDeleteUsername("");
    setShowConfirmDelete(false);
  };

  // Fetch Admin List
  const fetchAdmins = async () => {
    try {
      const res = await fetch("http://localhost:8000/admin/list");
      const data = await res.json();
      if (data.error) {
        setPopup({ type: "error", message: data.error });
      } else {
        setAdmins(data.admins || []);
      }
    } catch (err) {
      console.error("Error fetching admins:", err);
      setPopup({ type: "error", message: "❌ Failed to fetch admins" });
    }
  };

  // Add Admin
  const handleAddAdmin = async () => {
    if (!username || !password) {
      setPopup({
        type: "error",
        message: "⚠️ Please enter both username and password",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);

      const res = await fetch("http://localhost:8000/admin/create", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.error) {
        setPopup({ type: "error", message: `❌ ${data.error}` });
      } else {
        setPopup({ type: "success", message: `✅ ${data.message}` });
        resetForms();
        setShowAddForm(false);
        setShowAdminList(false); 
      }
    } catch (err) {
      console.error("Error adding admin:", err);
      setPopup({ type: "error", message: "❌ Failed to add admin" });
    }
  };

  // Delete Admin
  const handleDeleteAdmin = async () => {
    if (!deleteUsername) {
      setPopup({
        type: "error",
        message: "⚠️ Please enter a username to delete",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("username", deleteUsername);
      formData.append("current_admin", localStorage.getItem("currentAdmin"));

      const res = await fetch("http://localhost:8000/admin/delete", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.error) {
        setPopup({ type: "error", message: `❌ ${data.error}` });
      } else {
        setPopup({ type: "success", message: `✅ ${data.message}` });
        resetForms();
        setShowDeleteForm(false);
        setShowAdminList(false); 
      }
    } catch (err) {
      console.error("Error deleting admin:", err);
      setPopup({ type: "error", message: "❌ Failed to delete admin" });
    }
  };

  const handleCancel = () => {
    resetForms();
    setShowAddForm(false);
    setShowDeleteForm(false);
    setShowAdminList(false); 
  };

  const closePopup = () => {
    setPopup(null);
    resetForms();
    setShowAddForm(false);
    setShowDeleteForm(false);
    setShowAdminList(false); 
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
  className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 
             transition-transform duration-200 text-white font-bold rounded-lg shadow flex 
             items-center justify-center gap-2"
>
  <ArrowUturnLeftIcon className="h-5 w-5 text-white" />
  Back
</button>
        </div>
      </div>

      {/* Modal Popup */}
      {popup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white p-8 rounded-xl shadow-lg w-[350px] text-center">
            <h3
              className={`text-xl font-bold mb-4 ${
                popup.type === "success" ? "text-green-600" : "text-red-600"
              }`}
            >
              {popup.type === "success" ? "✅ Success" : "❌ Error"}
            </h3>
            <p className="text-gray-700 mb-6">{popup.message}</p>
            <button
              onClick={closePopup}
              className={`px-6 py-2 rounded-lg font-bold ${
                popup.type === "success"
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }`}
            >
              {popup.type === "success" ? "OK" : "Try Again"}
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-col items-center flex-grow py-10">
        <h2 className="text-3xl font-bold text-indigo-700 mb-10 flex items-center justify-center gap-2">
  <ShieldCheckIcon className="h-8 w-8 text-indigo-700" />
  Manage Admin
</h2>

        {!showAddForm && !showDeleteForm && (
          <div className="grid grid-cols-3 gap-8">
            <button
  onClick={() => {
    setShowAddForm(true);
    setShowAdminList(false); 
  }}
  className="px-10 py-6 bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow flex items-center justify-center gap-2"
>
  <PlusIcon className="h-6 w-6 text-white transition-transform duration-200 group-hover:rotate-90" />
  Add Admin
</button>
            <button
  onClick={() => {
    setShowDeleteForm(true);
    setShowAdminList(false);
  }}
  className="px-10 py-6 bg-red-600 hover:bg-red-700 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow flex items-center justify-center gap-2"
>
  <TrashIcon className="h-6 w-6 text-white transition-transform duration-200 group-hover:rotate-12" />
  Delete Admin
</button>
            <button
  onClick={() => {
    fetchAdmins();
    setShowAdminList(true);
  }}
  className="px-10 py-6 bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow flex items-center gap-2"
>
  <DocumentTextIcon className="h-6 w-6 text-white" />
  Admin List
</button>
          </div>
        )}

        {/* Admin List Panel */}
        {showAdminList && (
          <div className="bg-white p-6 rounded-xl shadow-lg mt-10 w-[500px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-indigo-700 flex items-center gap-2">
  <ClipboardDocumentListIcon className="h-7 w-7 text-indigo-700" />
  List of Admins
</h3>
              <button
  onClick={() => setShowAdminList(false)}
  className="px-4 py-1 bg-gray-400 hover:bg-gray-500 text-white font-bold rounded-lg flex items-center gap-2"
>
  <XMarkIcon className="h-5 w-5 text-white" />
  Close
</button>
            </div>
            <ul className="divide-y divide-gray-300">
              {admins.length > 0 ? (
                admins.map((admin, index) => (
                  <li
                    key={index}
                    className="py-2 flex items-center text-lg font-medium"
                  >
                    <span className="w-10 text-gray-500">{index + 1}.</span>
                    <span className="text-gray-800">{admin.username}</span>
                  </li>
                ))
              ) : (
                <li className="py-2 text-gray-500">No admins found</li>
              )}
            </ul>
          </div>
        )}

        {/* Add Admin Form */}
        {showAddForm && (
          <div className="bg-white p-8 rounded-xl shadow-lg w-[400px]">
            <h3 className="text-2xl font-bold text-indigo-700 mb-6 text-center flex items-center justify-center gap-2">
  <UserPlusIcon className="h-7 w-7 text-indigo-700" />
  Add Admin
</h3>
            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border px-4 py-2 rounded-lg mb-4"
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border px-4 py-2 rounded-lg mb-4 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2 text-gray-600 hover:text-gray-800"
              >
                {showPassword ? (
                  <EyeIcon className="h-5 w-5" /> // 👁️ password visible
                ) : (
                  <EyeSlashIcon className="h-5 w-5" /> // 🙈 password hidden
                )}
              </button>
            </div>
            <div className="flex justify-between mt-4">
              <button
                onClick={handleAddAdmin}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="px-6 py-2 bg-gray-400 hover:bg-gray-500 text-white font-bold rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Delete Admin Form */}
        {showDeleteForm && !showConfirmDelete && (
          <div className="bg-white p-8 rounded-xl shadow-lg w-[400px]">
            <h3 className="text-2xl font-bold text-red-600 mb-6 text-center flex items-center justify-center gap-2">
  <TrashIcon className="h-7 w-7 text-red-600" />
  Delete Admin
</h3>
            <input
              type="text"
              placeholder="Enter username to delete"
              value={deleteUsername}
              onChange={(e) => setDeleteUsername(e.target.value)}
              className="w-full border px-4 py-2 rounded-lg mb-4"
            />
            <div className="flex justify-between mt-4">
              <button
                onClick={() => setShowConfirmDelete(true)}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg"
              >
                Delete
              </button>
              <button
                onClick={handleCancel}
                className="px-6 py-2 bg-gray-400 hover:bg-gray-500 text-white font-bold rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Confirm Delete */}
        {showConfirmDelete && (
          <div className="bg-white p-6 rounded-xl shadow-lg w-[350px] text-center">
            <p className="text-lg font-semibold mb-6">
              ⚠️ Are you sure you want to delete admin <b>{deleteUsername}</b>?
            </p>
            <div className="flex justify-center gap-6">
              <button
                onClick={handleDeleteAdmin}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg"
              >
                Delete
              </button>
              <button
                onClick={handleCancel}
                className="px-6 py-2 bg-gray-400 hover:bg-gray-500 text-white font-bold rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default ManageAdmin;