import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  UserPlusIcon,
  DocumentTextIcon,
  LockClosedIcon,
  UsersIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";

function AdminDashboard() {
  const [dateTime, setDateTime] = useState(new Date());
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    // ✅ Get currently logged-in admin from localStorage
    const admin = localStorage.getItem("currentAdmin");
    if (admin) setCurrentAdmin(admin);

    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    // Clear admin info on logout
    localStorage.removeItem("currentAdmin");
    setCurrentAdmin(null);
    navigate("/admin-login");
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md relative">
        {/* Date & Time */}
        <div className="absolute left-10 text-blue-800 text-xl font-bold">
          <HeaderDateTime />
        </div>

        {/* Title */}
        <h1
          onClick={() => navigate("/")}
          className="text-5xl font-bold text-blue-900 cursor-pointer hover:text-blue-700 transition-colors"
        >
          FaceTrack Attendance
        </h1>

        {/* Logout Button */}
        <div className="absolute right-10">
          <button
            onClick={handleLogout}
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white font-bold rounded-lg shadow flex 
                       items-center justify-center gap-2"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 text-white" />
            Logout
          </button>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex flex-col items-center flex-grow py-10">
        <h2 className="text-4xl font-bold text-indigo-700 mb-2 flex items-center justify-center gap-2">
          <Cog6ToothIcon className="h-8 w-8 text-indigo-700" />
          Admin Dashboard
        </h2>

        {/* Welcome message under heading */}
        {currentAdmin && (
          <p className="text-xl font-semibold text-gray-700 mb-12">
            Welcome <span className="text-indigo-700 font-bold">{currentAdmin}</span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-8">
          {/* Row 1 */}
          <button
            onClick={() => navigate("/register-user")}
            className="px-10 py-6 bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow"
          >
            <UserPlusIcon className="h-6 w-6 inline-block mr-2" />
            Register User
          </button>

          <button
            onClick={() => navigate("/attendance-logs")}
            className="px-10 py-6 bg-blue-500 hover:bg-blue-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow"
          >
            <DocumentTextIcon className="h-6 w-6 inline-block mr-2" />
            View Attendance Logs
          </button>

          {/* Row 2 */}
          <button
            onClick={() => navigate("/change-password")}
            className="px-10 py-6 bg-yellow-500 hover:bg-yellow-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow"
          >
            <LockClosedIcon className="h-6 w-6 inline-block mr-2" />
            Change Admin Password
          </button>

          <button className="px-10 py-6 bg-purple-500 hover:bg-purple-600 hover:scale-105 active:scale-95 
                            transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow">
            <UserGroupIcon className="h-6 w-6 inline-block mr-2" />
            HR Portal
          </button>

          {/* Row 3 */}
          <button
            onClick={() => navigate("/manage-users")}
            className="px-10 py-6 bg-indigo-500 hover:bg-indigo-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow"
          >
            <UsersIcon className="h-6 w-6 inline-block mr-2" />
            Manage Users
          </button>

          <button
            onClick={() => navigate("/manage-admin")}
            className="px-10 py-6 bg-pink-500 hover:bg-pink-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow"
          >
            <ShieldCheckIcon className="h-6 w-6 inline-block mr-2" />
            Manage Admins
          </button>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default AdminDashboard;