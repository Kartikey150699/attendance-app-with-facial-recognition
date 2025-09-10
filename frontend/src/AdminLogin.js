import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid";

function AdminLogin() {
  const [dateTime, setDateTime] = useState(new Date());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

const handleLogin = async () => {
  setError(""); // reset error
  try {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);

    const response = await fetch("http://localhost:8000/admin/login", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (response.ok && !data.error) {
      // ✅ login success → go to dashboard
      navigate("/admin-dashboard");
    } else {
      // ❌ login failed → show error
      setError("❌ Invalid username or password");
    }
  } catch (err) {
    setError("⚠️ Server error. Please try again.");
  }
};

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
      <div className="w-full flex items-center justify-between px-10 py-4 bg-indigo-300 shadow-md mb-10">
        <div className="text-blue-800 text-xl font-bold">
          {dateTime.toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })}{" "}
          —{" "}
          {dateTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })}
        </div>

        <div className="absolute left-1/2 transform -translate-x-1/2">
          <h1 className="text-5xl font-bold text-blue-900 text-center">
            FaceTrack Attendance
          </h1>
        </div>

        <div>
          <button
            onClick={() => navigate("/")}
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white text-sm font-bold rounded-lg shadow"
          >
            🔙 Back
          </button>
        </div>
      </div>

      {/* Login Box */}
      <div className="bg-white p-8 rounded-xl shadow-md w-96 mx-auto mt-20">
        <h2 className="text-2xl font-bold text-center mb-6 text-indigo-700">
          Admin Login 🔑
        </h2>

        {/* Username */}
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />

        {/* Password */}
        <div className="relative w-full mb-6">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-3 flex items-center text-gray-600 hover:text-indigo-500"
          >
            {showPassword ? (
              <EyeIcon className="h-5 w-5" />
            ) : (
              <EyeSlashIcon className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-red-500 text-sm mb-4 font-semibold">{error}</p>
        )}

        {/* Login button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full py-2 font-bold rounded-lg shadow ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-indigo-500 hover:bg-indigo-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white"
          }`}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>

      {/* Footer */}
      <footer className="w-full py-4 bg-blue-900 text-center text-xl text-white text-sm mt-auto">
        © 2025 FaceTrack. All rights reserved - Kartikey Koli - IFNET
      </footer>
    </div>
  );
}

export default AdminLogin;
