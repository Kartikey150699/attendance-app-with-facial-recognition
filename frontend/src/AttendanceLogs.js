import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUturnLeftIcon } from "@heroicons/react/24/solid"; 
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";

function AttendanceLogs() {
  const [logs, setLogs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch("http://localhost:8000/attendance/logs"); 
        const data = await res.json();
        setLogs(data);
      } catch (err) {
        console.error("Error fetching logs:", err);
      }
    }
    fetchLogs();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md relative">
        {/* DateTime */}
        <div className="absolute left-10 text-blue-800 text-xl font-bold">
          <HeaderDateTime />
        </div>

        {/* Title */}
        <h1
          onClick={() => navigate("/admin-dashboard")}
          className="text-5xl font-bold text-blue-900 cursor-pointer hover:text-blue-700 transition-colors"
        >
          FaceTrack Attendance
        </h1>

        {/* Back Button */}
        <div className="absolute right-10">
          <button
            onClick={() => navigate(-1)}
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <ArrowUturnLeftIcon className="h-5 w-5" />
            Back
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="flex-grow p-10">
        <table className="w-full border-collapse bg-white shadow-lg rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-indigo-500 text-white text-lg">
              <th className="p-4">Date</th>
              <th className="p-4">Employee</th>
              <th className="p-4">Check In</th>
              <th className="p-4">Break Start</th>
              <th className="p-4">Break End</th>
              <th className="p-4">Check Out</th>
            </tr>
          </thead>
          <tbody>
            {logs.length > 0 ? (
              logs.map((log, idx) => (
                <tr key={idx} className="text-center border-b">
                  <td className="p-4">{log.date}</td>
                  <td className="p-4">{log.user_name_snapshot}</td>
                  <td className="p-4">{log.check_in || "-"}</td>
                  <td className="p-4">{log.break_start || "-"}</td>
                  <td className="p-4">{log.break_end || "-"}</td>
                  <td className="p-4">{log.check_out || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="p-6 text-gray-500">
                  No logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Footer />
    </div>
  );
}

export default AttendanceLogs;