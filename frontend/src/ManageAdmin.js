import { useState } from "react";
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
 import { API_BASE } from "./config";

function ManageAdmin() {
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
      const res = await fetch(`${API_BASE}/admin/list`);
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

      const res = await fetch(`${API_BASE}/admin/create`, {
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

      const res = await fetch(`${API_BASE}/admin/delete`, {
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
{/* Midnight Glass Header */}
<header className="relative w-full bg-gradient-to-r from-slate-800 via-gray-800 to-slate-900 text-white shadow-xl overflow-hidden border-b border-gray-700/30 mb-10">
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
        FaceTrack <span className="font-light text-gray-300 ml-1">Attendance</span>
      </h1>
    </div>

    {/* Right: Date & Time + Back Button */}
    <div className="flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-4 mt-3 sm:mt-0">
      {/* Date & Time */}
      <div className="text-center text-sm sm:text-base md:text-lg font-semibold text-white tracking-wide drop-shadow-md order-2 sm:order-1">
        <HeaderDateTime />
      </div>

      {/* Back Button */}
      <button
        onClick={() => navigate("/admin-dashboard")}
        className="order-1 sm:order-2 px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 via-pink-500 to-rose-500 
                   hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl 
                   transition-all duration-300 flex items-center gap-2"
      >
        <ArrowUturnLeftIcon className="h-5 w-5" />
        Back
      </button>
    </div>
  </div>
</header>

      {/* Modal Popup */}
      {popup && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
    <div
      className={`p-8 rounded-2xl shadow-2xl text-center transform transition-all duration-300 scale-100 ${
        popup.type === "success"
          ? "bg-green-50 border-2 border-green-400"
          : "bg-red-50 border-2 border-red-400"
      }`}
    >
      {/* Title */}
      <h2
        className={`text-2xl font-extrabold mb-4 ${
          popup.type === "success" ? "text-green-700" : "text-red-700"
        }`}
      >
        {popup.type === "success" ? "Operation Successful!" : "Error Occurred"}
      </h2>

      {/* Main message */}
      <p className="text-lg text-gray-800 mb-6">{popup.message}</p>

      {/* Action button */}
      <button
        onClick={closePopup}
        className={`px-6 py-2 font-bold rounded-lg shadow ${
          popup.type === "success"
            ? "bg-green-600 text-white hover:bg-green-700"
            : "bg-red-600 text-white hover:bg-red-700"
        }`}
      >
        {popup.type === "success" ? "OK" : "Try Again"}
      </button>
    </div>
  </div>
)}

      {/* Body */}
{/* Body */}
<div className="flex flex-col items-center flex-grow px-4 sm:px-8 py-10">
  {/* Title */}
  <h2 className="text-2xl sm:text-3xl font-bold text-indigo-700 mb-10 flex items-center justify-center gap-2 text-center">
    <ShieldCheckIcon className="h-8 w-8 text-indigo-700" />
    Manage Admins
  </h2>

  {/* --- Buttons --- */}
  {!showAddForm && !showDeleteForm && !showAdminList && (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
      {/* Add Admin */}
      <button
        onClick={() => {
          setShowAddForm(true);
          setShowAdminList(false);
        }}
        className="px-8 py-5 bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95 
                   transition-all duration-200 text-white text-lg sm:text-xl font-bold 
                   rounded-lg shadow-lg flex items-center justify-center gap-2 w-full"
      >
        <PlusIcon className="h-6 w-6 text-white" />
        Add Admin
      </button>

      {/* Delete Admin */}
      <button
        onClick={() => {
          setShowDeleteForm(true);
          setShowAdminList(false);
        }}
        className="px-8 py-5 bg-red-600 hover:bg-red-700 hover:scale-105 active:scale-95 
                   transition-all duration-200 text-white text-lg sm:text-xl font-bold 
                   rounded-lg shadow-lg flex items-center justify-center gap-2 w-full"
      >
        <TrashIcon className="h-6 w-6 text-white" />
        Delete Admin
      </button>

      {/* Show Admin List */}
      <button
        onClick={() => {
          fetchAdmins();
          setShowAdminList(true);
        }}
        className="px-8 py-5 bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95 
                   transition-all duration-200 text-white text-lg sm:text-xl font-bold 
                   rounded-lg shadow-lg flex items-center justify-center gap-2 w-full"
      >
        <DocumentTextIcon className="h-6 w-6 text-white" />
        Show Admin List
      </button>
    </div>
  )}

  {/* --- Admin List Panel --- */}
  {showAdminList && (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg mt-10 w-full max-w-md sm:max-w-lg md:max-w-2xl">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-5 gap-3">
        <h3 className="text-2xl font-bold text-indigo-700 flex items-center gap-2 text-center sm:text-left">
          <ClipboardDocumentListIcon className="h-7 w-7 text-indigo-700" />
          List of Admins
        </h3>
        <button
          onClick={() => setShowAdminList(false)}
          className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white font-bold rounded-lg flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <XMarkIcon className="h-5 w-5 text-white" />
          Close
        </button>
      </div>
      <ul className="divide-y divide-gray-300 overflow-y-auto max-h-[400px]">
        {admins.length > 0 ? (
          admins.map((admin, index) => (
            <li
              key={index}
              className="py-2 flex items-center text-base sm:text-lg font-medium break-all"
            >
              <span className="w-10 text-gray-500 flex-shrink-0">{index + 1}.</span>
              <span className="text-gray-800">{admin.username}</span>
            </li>
          ))
        ) : (
          <li className="py-2 text-gray-500 text-center">No admins found</li>
        )}
      </ul>
    </div>
  )}

  {/* --- Add Admin Form --- */}
  {showAddForm && (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-sm sm:max-w-md mt-10">
      <h3 className="text-2xl font-bold text-indigo-700 mb-6 text-center flex items-center justify-center gap-2">
        <UserPlusIcon className="h-7 w-7 text-indigo-700" />
        Add Admin
      </h3>
      <input
        type="text"
        placeholder="Enter username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full border px-4 py-2 rounded-lg mb-4 text-base"
      />
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border px-4 py-2 rounded-lg mb-4 pr-10 text-base"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-2 text-gray-600 hover:text-gray-800"
        >
          {showPassword ? (
            <EyeIcon className="h-5 w-5" />
          ) : (
            <EyeSlashIcon className="h-5 w-5" />
          )}
        </button>
      </div>
      <div className="flex flex-col sm:flex-row justify-between gap-3 mt-4">
        <button
          onClick={handleAddAdmin}
          className="flex-1 px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg"
        >
          Save
        </button>
        <button
          onClick={handleCancel}
          className="flex-1 px-6 py-2 bg-gray-400 hover:bg-gray-500 text-white font-bold rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  )}

  {/* --- Delete Admin Form --- */}
  {showDeleteForm && !showConfirmDelete && (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-sm sm:max-w-md mt-10">
      <h3 className="text-2xl font-bold text-red-600 mb-6 text-center flex items-center justify-center gap-2">
        <TrashIcon className="h-7 w-7 text-red-600" />
        Delete Admin
      </h3>
      <input
        type="text"
        placeholder="Enter username to delete"
        value={deleteUsername}
        onChange={(e) => setDeleteUsername(e.target.value)}
        className="w-full border px-4 py-2 rounded-lg mb-4 text-base"
      />
      <div className="flex flex-col sm:flex-row justify-between gap-3 mt-4">
        <button
          onClick={() => setShowConfirmDelete(true)}
          className="flex-1 px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg"
        >
          Delete
        </button>
        <button
          onClick={handleCancel}
          className="flex-1 px-6 py-2 bg-gray-400 hover:bg-gray-500 text-white font-bold rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  )}

  {/* --- Confirm Delete Modal --- */}
  {showConfirmDelete && (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-xs sm:max-w-sm text-center mt-10">
      <p className="text-base sm:text-lg font-semibold mb-6">
        ⚠️ Are you sure you want to delete admin <b>{deleteUsername}</b>?
      </p>
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <button
          onClick={handleDeleteAdmin}
          className="flex-1 px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg"
        >
          Delete
        </button>
        <button
          onClick={handleCancel}
          className="flex-1 px-6 py-2 bg-gray-400 hover:bg-gray-500 text-white font-bold rounded-lg"
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