import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import {
  ArrowUturnLeftIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { API_BASE } from "./config";

function CalendarView() {
  const navigate = useNavigate();
  const location = useLocation(); // check where user came from

  // Date → YYYY-MM-DD string
  const formatDateLocal = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Human-readable format
  const formatReadableDate = (d) => {
    return d
      .toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
      .replace(",", "");
  };

  // State
  const [selectedDate, setSelectedDate] = useState(formatDateLocal(new Date()));
  const [holidays, setHolidays] = useState([]);
  const [slideDirection, setSlideDirection] = useState("");
  const prevMonthRef = useRef(new Date().getMonth());

  // Detect month slide animation
  useEffect(() => {
    const currentMonth = new Date(selectedDate).getMonth();
    const prevMonth = prevMonthRef.current;

    if (currentMonth > prevMonth) {
      setSlideDirection("slide-left");
    } else if (currentMonth < prevMonth) {
      setSlideDirection("slide-right");
    }

    prevMonthRef.current = currentMonth;
  }, [selectedDate]);

  // Fetch holidays
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const res = await fetch(`${API_BASE}/holiday`);
        if (!res.ok) throw new Error("Failed to fetch holidays");
        const data = await res.json();

        setHolidays(
          data.map((h) => ({
            date: h.date.split("T")[0],
            name: h.holiday_name,
          }))
        );
      } catch (err) {
        console.error("Error fetching holidays:", err);
      }
    };

    fetchHolidays();
  }, []);

  // Highlight holidays in calendar
  const tileClassName = ({ date, view }) => {
    if (view === "month") {
      const formatted = formatDateLocal(date);
      if (holidays.some((h) => h.date === formatted)) {
        return "holiday-tile";
      }
    }
    return null;
  };

  // Current selected holiday
  const holidayForSelectedDate = holidays.find((h) => h.date === selectedDate);

  // Holidays in current month
  const currentMonth = new Date(selectedDate).getMonth();
  const currentYear = new Date(selectedDate).getFullYear();
  const monthHolidays = holidays.filter((h) => {
    const d = new Date(h.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  // Handle back button
  const handleBack = () => {
    if (location.state?.from === "work") {
      navigate("/work-application");
    } else if (location.state?.from === "hr") {
      navigate("/hr-portal");
    } else {
      navigate(-1); // fallback
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200 overflow-hidden">
      {/* Header */}
 {/* Midnight Glass Header */}
<header className="relative w-full bg-gradient-to-r from-slate-800 via-gray-800 to-slate-900 text-white shadow-xl overflow-hidden border-b border-gray-700/30">
  {/* Frosted glass overlay */}
  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 backdrop-blur-md"></div>

  {/* Header Content */}
  <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between px-6 sm:px-10 lg:px-16 py-4 sm:py-5">
    {/* Left: Logo + Title */}
    <div
      onClick={() => {
        // Clear all session-related storage
        localStorage.removeItem("user");
        localStorage.removeItem("employeeId");
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
        onClick={handleBack}
        className="px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 via-pink-500 to-rose-500 
                   hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl 
                   transition-all duration-300 flex items-center gap-2 order-1 sm:order-2"
      >
        <ArrowUturnLeftIcon className="h-5 w-5" />
        Back
      </button>
    </div>
  </div>
</header>

      {/* Title */}
      <div className="flex justify-center py-8">
        <h2 className="text-3xl font-bold text-indigo-700 flex items-center gap-2">
          <CalendarDaysIcon className="h-8 w-8 text-indigo-700" />
          Calendar View
        </h2>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 mb-12 bg-white p-6 sm:p-10 rounded-2xl shadow-2xl 
                flex flex-col lg:flex-row gap-6 lg:gap-10">
        {/* Calendar */}
        <div className="flex-1 flex justify-center overflow-hidden min-w-[280px]">
          <div
            className={`calendar-container ${slideDirection}`}
            key={selectedDate.slice(0, 7)}
          >
            <Calendar
              onChange={(val) => setSelectedDate(formatDateLocal(val))}
              onActiveStartDateChange={({ activeStartDate }) =>
                setSelectedDate(formatDateLocal(activeStartDate))
              }
              value={new Date(selectedDate)}
              tileClassName={tileClassName}
              className="rounded-xl shadow-lg border-2 border-indigo-200 text-lg p-6 w-full"
            />
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 p-4 sm:p-6 bg-indigo-50 rounded-xl shadow-inner flex flex-col mt-6 lg:mt-0">
          {/* Selected Date */}
          <div>
            <h3 className="font-bold text-indigo-700 mb-4 text-2xl">
              Details for {formatReadableDate(new Date(selectedDate))}
            </h3>
            {holidayForSelectedDate ? (
              <p className="text-red-600 font-semibold text-lg">
                Holiday: {holidayForSelectedDate.name}
              </p>
            ) : (
              <p className="text-gray-600">No holiday on this day.</p>
            )}
          </div>

          {/* Holiday List */}
          <div className="mt-8">
            <h4 className="text-xl font-bold text-indigo-800 mb-3">
              Holidays in{" "}
              {new Date(selectedDate).toLocaleString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h4>
            {monthHolidays.length > 0 ? (
              <ul className="space-y-3">
                {monthHolidays.map((h, i) => (
                  <li
                    key={i}
                    onClick={() => setSelectedDate(h.date)}
                    className="p-4 bg-red-100 rounded-lg shadow-sm flex justify-between items-center 
                               cursor-pointer hover:bg-red-200 hover:scale-[1.02] transform transition-all duration-200"
                  >
                    <span className="font-semibold text-red-700">
                      {new Date(h.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="text-gray-800">{h.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No holidays this month.</p>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default CalendarView;