import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import {
  ArrowUturnLeftIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";

function CalendarView() {
  const navigate = useNavigate();
  const [dateTime, setDateTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Sample holidays + logs (replace with backend later)
  const holidays = ["2025-01-01", "2025-12-25", "2025-08-15"];
  const logs = [
    { date: "2025-09-01", name: "John Doe", status: "Present" },
    { date: "2025-09-03", name: "Jane Smith", status: "Holiday Worked" },
  ];

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Tile styling for holidays & worked days
  const tileClassName = ({ date, view }) => {
    if (view === "month") {
      const formatted = date.toISOString().split("T")[0];
      if (holidays.includes(formatted)) {
        return "holiday-tile";
      }
      if (logs.some((log) => log.date === formatted)) {
        return "log-tile";
      }
    }
    return null;
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md relative">
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
            onClick={() => navigate(-1)}
            className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg shadow flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
          >
            <ArrowUturnLeftIcon className="h-5 w-5" />
            Back
          </button>
        </div>
      </div>

      {/* Page Title */}
      <div className="flex justify-center py-8">
        <h2 className="text-3xl font-bold text-indigo-700 flex items-center gap-2">
          <CalendarDaysIcon className="h-8 w-8 text-indigo-700" />
          Calendar View
        </h2>
      </div>

      {/* Calendar Section */}
      <div className="max-w-6xl w-full mx-auto px-6 mb-12 bg-white p-10 rounded-2xl shadow-2xl">
        {/* Calendar centered and enlarged */}
        <div className="flex justify-center">
          <Calendar
            onChange={setSelectedDate}
            value={selectedDate}
            tileClassName={tileClassName}
            className="rounded-xl shadow-lg border-2 border-indigo-200 text-lg p-6 w-full max-w-3xl"
          />
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-10 mt-8 text-lg">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-400 rounded-lg shadow"></div>
            <span className="font-semibold text-gray-700">Holiday</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-400 rounded-lg shadow"></div>
            <span className="font-semibold text-gray-700">Worked / Logs</span>
          </div>
        </div>

        {/* Selected Date Details */}
        <div className="mt-10 p-8 border-2 border-indigo-200 rounded-xl bg-indigo-50 shadow-inner text-lg text-center">
          <h3 className="font-bold text-indigo-700 mb-4 text-2xl">
            Details for {selectedDate.toDateString()}:
          </h3>
          {holidays.includes(selectedDate.toISOString().split("T")[0]) && (
            <p className="text-red-600 font-semibold text-lg">Holiday</p>
          )}
          {logs
            .filter(
              (log) => log.date === selectedDate.toISOString().split("T")[0]
            )
            .map((log, i) => (
              <p key={i}>
                {log.name} —{" "}
                <span className="font-semibold text-indigo-700">
                  {log.status}
                </span>
              </p>
            ))}
          {!holidays.includes(selectedDate.toISOString().split("T")[0]) &&
            !logs.some(
              (log) => log.date === selectedDate.toISOString().split("T")[0]
            ) && (
              <p className="text-gray-600">No records for this day.</p>
            )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default CalendarView;