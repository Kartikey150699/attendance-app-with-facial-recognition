import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function AdminDashboard() {
  const [dateTime, setDateTime] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    navigate("/admin-login"); // redirect to Admin Login page
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md">
        {/* Date & Time */}
        <div className="absolute left-10 text-blue-800 text-xl font-bold">
          {dateTime.toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })} —{" "}
          {dateTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })}
        </div>

        {/* Title */}
        <h1 className="text-5xl font-bold text-blue-900">
          FaceTrack Attendance
        </h1>

        {/* Logout Button */}
        <div className="absolute right-10">
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-sm font-bold rounded-lg shadow"
          >
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex flex-col items-center flex-grow py-10">
        <h2 className="text-4xl font-bold text-indigo-700 mb-16">
          Admin Dashboard
        </h2>

        <div className="grid grid-cols-2 gap-8">
          {/* Row 1 */}
          <button
            onClick={() => navigate("/register-user")}
            className="px-10 py-6 bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow"
          >
            👤 Register User
          </button>

          <button className="px-10 py-6 bg-blue-500 hover:bg-blue-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow">
            📑 View Attendance Logs
          </button>

          {/* Row 2 */}
          <button
  onClick={() => navigate("/change-password")}
  className="px-10 py-6 bg-yellow-500 hover:bg-yellow-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow"
>
  🔒 Change Password
</button>


          <button className="px-10 py-6 bg-purple-500 hover:bg-purple-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow">
            📤 Export Attendance
          </button>

          {/* Row 3 */}
          <button
  onClick={() => navigate("/manage-users")}
  className="px-10 py-6 bg-indigo-500 hover:bg-indigo-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow"
>
  👥 Manage Users
</button>


          <button
  onClick={() => navigate("/manage-admin")}
  className="px-10 py-6 bg-pink-500 hover:bg-pink-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-xl font-bold rounded-lg shadow"
>
  🛡️ Manage Admin
</button>

        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-4 bg-blue-900 text-center text-xl text-white mt-auto">
        © 2025 FaceTrack. All rights reserved - Kartikey Koli
      </footer>
    </div>
  );
}

export default AdminDashboard;
