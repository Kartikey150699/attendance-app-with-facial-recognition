import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRightOnRectangleIcon,
  ClipboardDocumentListIcon,
  PencilSquareIcon,
  BuildingOffice2Icon,
  ClockIcon,
  GiftIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";

function WorkApplication() {
  const location = useLocation();
  const navigate = useNavigate();

  // Get user from location OR localStorage
  const storedUser = {
    name: localStorage.getItem("user"),
    employee_id: localStorage.getItem("employeeId"),
  };

  const user = location.state?.user || storedUser.name || null;
  const employeeId =
    location.state?.employeeId || storedUser.employee_id || null;

  const [dateTime, setDateTime] = useState(new Date());

  // Form states
  const [applicationType, setApplicationType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState(""); // keep it string only
  const [usePaidHoliday, setUsePaidHoliday] = useState(""); // separate state

  // Remaining Paid Holidays
  const [remainingDays, setRemainingDays] = useState(null);

  // Popup state
  const [popup, setPopup] = useState({ show: false, message: "", type: "" });

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Protect route: redirect if not logged in
  useEffect(() => {
    if (!user || !employeeId) {
      navigate("/work-application-login", { replace: true });
    }
  }, [user, employeeId, navigate]);

  // Fetch remaining paid holidays for employee
  useEffect(() => {
    const fetchRemaining = async () => {
      try {
        const res = await fetch("http://localhost:8000/paid-holidays/");
        if (!res.ok) throw new Error("Failed to fetch paid holidays");
        const data = await res.json();

        const record = data.find((h) => h.employee_id === employeeId);
        if (record) {
          setRemainingDays(record.remaining_days);
        } else {
          setRemainingDays(0);
        }
      } catch (error) {
        console.error("Error fetching remaining holidays:", error);
        setRemainingDays(0);
      }
    };

    if (employeeId) fetchRemaining();
  }, [employeeId]);

  // Format optional time
  const formatTime = (t) => (t ? (t.length === 5 ? `${t}:00` : t) : null);

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!applicationType || !startDate || !endDate || !reason.trim()) {
      setPopup({
        show: true,
        message: "⚠️ Please fill all mandatory fields.",
        type: "error",
      });
      return;
    }

    const payload = {
      employee_id: employeeId,
      name: user,
      application_type: applicationType,
      start_date: startDate,
      end_date: endDate,
      start_time: formatTime(startTime),
      end_time: formatTime(endTime),
      reason: reason, // ✅ plain string
      use_paid_holiday: usePaidHoliday || "no", // ✅ dropdown state
    };

    try {
      const res = await fetch("http://localhost:8000/work-applications/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to submit request");
      const data = await res.json();

      setPopup({
        show: true,
        message: "✅ Work application submitted successfully!",
        type: "success",
      });
      console.log("Submitted Application:", data);

      // Reset form
      setApplicationType("");
      setStartDate("");
      setEndDate("");
      setStartTime("");
      setEndTime("");
      setReason("");
      setUsePaidHoliday("");
    } catch (error) {
      console.error("Error submitting application:", error);
      setPopup({
        show: true,
        message: "❌ Failed to submit application. Please try again.",
        type: "error",
      });
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200 overflow-x-hidden">
      {/* Header */}
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md relative">
        <div className="absolute left-10 text-blue-800 text-xl font-bold">
          <HeaderDateTime />
        </div>
        <h1
          onClick={() => navigate("/", { replace: true })}
          className="text-5xl font-bold text-blue-900 cursor-pointer hover:text-blue-700 transition-colors"
        >
          FaceTrack Attendance
        </h1>
        <div className="absolute right-10">
          <button
            onClick={() => {
              localStorage.removeItem("user");
              localStorage.removeItem("employeeId");
              navigate("/work-application-login", { replace: true });
              window.location.reload();
            }}
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 text-white" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Remaining Paid Holidays + Action Buttons */}
      <div className="flex justify-between items-center px-10 mt-4">
        <div
          className={`shadow-md rounded-lg px-6 py-3 flex items-center gap-2 text-lg font-semibold ${
            remainingDays === 0
              ? "bg-red-100 text-red-700 border border-red-400"
              : "bg-green-100 text-green-700 border border-green-400"
          }`}
        >
          <GiftIcon
            className={`h-6 w-6 ${
              remainingDays === 0 ? "text-red-600" : "text-green-600"
            }`}
          />
          Remaining Paid Holidays:{" "}
          <span>
            {remainingDays !== null ? remainingDays : "Loading..."}
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() =>
              navigate("/your-applications", { state: { user, employeeId } })
            }
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow flex items-center gap-2 
                       transition-transform hover:scale-105 active:scale-95"
          >
            <ClipboardDocumentListIcon className="h-5 w-5" />
            Your Applications
          </button>
          <button
            onClick={() => navigate("/calendar-view", { state: { from: "work" } })}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow flex items-center gap-2 
                       transition-transform hover:scale-105 active:scale-95"
          >
            <BuildingOffice2Icon className="h-5 w-5" />
            Holiday Calendar
          </button>
          <button
            onClick={() =>
              navigate("/my-attendance", { state: { user, employeeId } })
            }
            className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow flex items-center gap-2 
                       transition-transform hover:scale-105 active:scale-95"
          >
            <ClockIcon className="h-5 w-5" />
            My Attendance
          </button>
        </div>
      </div>

      {/* Request Form */}
      <div className="flex justify-center px-4 mb-12 mt-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-8 border border-indigo-200 space-y-6 text-base"
        >
          <h3 className="text-xl font-bold text-indigo-700 mb-4 flex items-center gap-2 justify-center">
            <PencilSquareIcon className="h-6 w-6 text-indigo-700" />
            Submit New Request
          </h3>

          {/* Name & Employee ID */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <label className="text-gray-700 font-semibold">Name:</label>
              <span className="text-red-600 font-bold">{user}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-700 font-semibold">Employee ID:</label>
              <span className="text-red-600 font-bold">{employeeId}</span>
            </div>
          </div>

          {/* Application Type + Paid Holidays */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-gray-700 font-semibold mb-1">
                Application Type
              </label>
              <select
                value={applicationType}
                onChange={(e) => setApplicationType(e.target.value)}
                className="px-3 py-2 text-sm border-2 border-indigo-300 rounded-lg shadow-sm 
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
              >
                <option value="">未選択</option>
                <option value="有給休暇（全日)">有給休暇（全日)</option>
                <option value="有給休暇（半日)">有給休暇（半日)</option>
                <option value="慶弔休暇">慶弔休暇</option>
                <option value="欠勤">欠勤</option>
                <option value="直行">直行</option>
                <option value="直帰">直帰</option>
                <option value="直行直帰">直行直帰</option>
                <option value="出張">出張</option>
                <option value="遅刻">遅刻</option>
                <option value="早退">早退</option>
                <option value="振替休日">振替休日</option>
                <option value="早出">早出</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-gray-700 font-semibold mb-1">
                Use Paid Holidays
              </label>
              <select
                value={usePaidHoliday}
                onChange={(e) => setUsePaidHoliday(e.target.value)}
                className="px-3 py-2 text-sm border-2 border-indigo-300 rounded-lg shadow-sm 
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
              >
                <option value="">Select</option>
                <option value="yes" disabled={remainingDays === 0}>
                  Yes {remainingDays === 0 ? "(Not Available)" : ""}
                </option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-4 gap-4">
            <div className="flex flex-col">
              <label className="text-gray-700 font-semibold mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={todayStr}
                className="px-2 py-2 text-sm border-2 border-indigo-300 rounded-lg shadow-sm 
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="text-gray-700 font-semibold mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || todayStr}
                className="px-2 py-2 text-sm border-2 border-indigo-300 rounded-lg shadow-sm 
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="text-gray-700 font-semibold mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="px-2 py-2 text-sm border-2 border-indigo-300 rounded-lg shadow-sm 
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-gray-700 font-semibold mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="px-2 py-2 text-sm border-2 border-indigo-300 rounded-lg shadow-sm 
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Reason */}
          <div className="flex flex-col">
            <label className="text-gray-700 font-semibold mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows="4"
              placeholder="Enter your reason"
              className="px-3 py-2 text-sm border-2 border-indigo-300 rounded-lg shadow-sm 
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y min-h-[100px]"
              required
            ></textarea>
          </div>

          {/* Submit */}
          <div className="flex justify-center mt-6">
            <button
              type="submit"
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow 
                         transition-transform hover:scale-105 active:scale-95 text-sm"
            >
              Submit Request
            </button>
          </div>
        </form>
      </div>

      {/* Popup */}
      {popup.show && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full text-center">
            <p
              className={`font-bold text-lg ${
                popup.type === "success"
                  ? "text-green-600"
                  : popup.type === "error"
                  ? "text-red-600"
                  : "text-blue-600"
              }`}
            >
              {popup.message}
            </p>
            <button
              onClick={() => setPopup({ show: false, message: "", type: "" })}
              className="mt-4 px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg shadow"
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

export default WorkApplication;