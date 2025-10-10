import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRightOnRectangleIcon,
  ClipboardDocumentListIcon,
  PencilSquareIcon,
  BuildingOffice2Icon,
  ClockIcon,
  GiftIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { API_BASE } from "./config";

function WorkApplication() {
  const location = useLocation();
  const navigate = useNavigate();

  // Get user from location OR localStorage
  const storedUser = {
    name: localStorage.getItem("user"),
    employee_id: localStorage.getItem("employeeId"),
  };

  const user = location.state?.user || storedUser.name || null;
  const employeeId = location.state?.employeeId || storedUser.employee_id || null;

  const [department, setDepartment] = useState(null); 
  
  // Form states
  const [applicationType, setApplicationType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [usePaidHoliday, setUsePaidHoliday] = useState("");

  // Remaining Paid Holidays
  const [remainingDays, setRemainingDays] = useState(null);

  // Notification count
  const [pendingApprovals, setPendingApprovals] = useState(0);

  // Popup state
  const [popup, setPopup] = useState({ show: false, message: "", type: "" });


  // Protect route
  useEffect(() => {
    if (!user || !employeeId) {
      navigate("/work-application-login", { replace: true });
    }
  }, [user, employeeId, navigate]);

  // Fetch department dynamically
  useEffect(() => {
    const fetchDepartment = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/active`);
        const data = await res.json();
        const record = data.find((u) => u.employee_id === employeeId);
        if (record) {
          setDepartment(record.department);
        }
      } catch (err) {
        console.error("Error fetching department:", err);
      }
    };
    if (employeeId) fetchDepartment();
  }, [employeeId]);

  // Fetch remaining paid holidays
  useEffect(() => {
    const fetchRemaining = async () => {
      try {
        const res = await fetch(`${API_BASE}/paid-holidays/`);
        if (!res.ok) throw new Error("Failed to fetch paid holidays");
        const data = await res.json();
        const record = data.find((h) => h.employee_id === employeeId);
        setRemainingDays(record ? record.remaining_days : 0);
      } catch (error) {
        console.error("Error fetching remaining holidays:", error);
        setRemainingDays(0);
      }
    };

    if (employeeId) fetchRemaining();
  }, [employeeId]);

  // Fetch pending approvals count
  useEffect(() => {
    const fetchPendingApprovals = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/approvers/by-approver/${employeeId}`
        );
        if (!res.ok) throw new Error("Failed to fetch approvals");
        const data = await res.json();
        const pending = data.filter((a) => a.status === "Pending").length;
        setPendingApprovals(pending);
      } catch (err) {
        console.error("Error fetching approvals:", err);
      }
    };

    if (employeeId) fetchPendingApprovals();
  }, [employeeId]);

  // Format time
  const formatTime = (t) => (t ? (t.length === 5 ? `${t}:00` : t) : null);

  // Submit
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
      reason: reason,
      use_paid_holiday: usePaidHoliday || "no",
    };

    try {
      const res = await fetch(`${API_BASE}/work-applications/`, {
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

      // Reset
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
{/* Midnight Glass Header */}
<header className="relative w-full bg-gradient-to-r from-slate-800 via-gray-800 to-slate-900 text-white shadow-xl overflow-hidden border-b border-gray-700/30">
  {/* Frosted glass overlay */}
  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 backdrop-blur-md"></div>

  {/* Header Content */}
  <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between px-6 sm:px-10 lg:px-16 py-4 sm:py-5">

    {/* Left: Logo + Title */}
    <div
      onClick={() => navigate("/", { replace: true })}
      className="flex items-center gap-3 cursor-pointer transition-transform duration-300 hover:scale-105"
    >
      <img
        src={`${process.env.PUBLIC_URL}/favicon.png`}
        alt="FaceTrack Logo"
        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-md border border-white/20 bg-white/10 p-1 object-contain"
      />
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
        FaceTrack <span className="font-light text-gray-300 ml-1">Work Application</span>
      </h1>
    </div>

    {/* Right: Date & Time + Logout */}
    <div className="flex flex-col sm:flex-row items-center justify-end gap-3 sm:gap-5 mt-3 sm:mt-0">
      {/* Date & Time */}
      <div className="text-center text-sm sm:text-base md:text-lg font-semibold text-white tracking-wide drop-shadow-md order-2 sm:order-1">
        <HeaderDateTime />
      </div>

      {/* Logout Button */}
      <button
        onClick={() => {
          localStorage.removeItem("user");
          localStorage.removeItem("employeeId");
          navigate("/work-application-login", { replace: true });
          window.location.reload();
        }}
        className="order-1 sm:order-2 px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 via-pink-500 to-rose-500 
                   hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl 
                   transition-all duration-300 flex items-center gap-2"
      >
        <ArrowRightOnRectangleIcon className="h-5 w-5" />
        Logout
      </button>
    </div>
  </div>
</header>

{/* Remaining Paid Holidays + Action Buttons */}
<div className="flex flex-col items-center justify-center gap-4 px-3 sm:px-5 md:px-10 mt-6 text-center">

  {/* Row 1 — Remaining Paid Holidays */}
  <div
    className={`shadow-md rounded-lg px-4 sm:px-5 md:px-6 py-2 sm:py-3 
                flex items-center justify-center gap-2 
                text-sm sm:text-base md:text-lg font-semibold whitespace-nowrap w-full max-w-[500px]
                ${
                  remainingDays === 0
                    ? "bg-red-100 text-red-700 border border-red-400"
                    : "bg-green-100 text-green-700 border border-green-400"
                }`}
  >
    <GiftIcon
      className={`h-5 w-5 md:h-6 md:w-6 ${
        remainingDays === 0 ? "text-red-600" : "text-green-600"
      }`}
    />
    <span>
      Remaining Paid Holidays:{" "}
      {remainingDays !== null ? remainingDays : "Loading..."}
    </span>
  </div>

  {/* Row 2 — Action Buttons (Responsive 2x2 Grid) */}
  <div
    className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 gap-3 sm:gap-4 
               w-full max-w-[500px] sm:max-w-[550px] md:max-w-[600px]"
  >
    {/* My Approvals */}
    <div className="relative flex justify-center">
      <button
        onClick={() => navigate("/my-approvals", { state: { employeeId } })}
        className="w-full h-[45px] sm:h-[48px] md:h-[50px]
                   bg-purple-600 hover:bg-purple-700 text-white font-semibold 
                   rounded-md shadow flex items-center justify-center gap-1 
                   transition-transform hover:scale-105 active:scale-95 text-xs sm:text-sm md:text-base"
      >
        <CheckCircleIcon className="h-4 w-4 md:h-5 md:w-5" />
        My Approvals
      </button>
      {pendingApprovals > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
          {pendingApprovals}
        </span>
      )}
    </div>

    {/* Your Applications */}
    <button
      onClick={() =>
        navigate("/your-applications", { state: { user, employeeId } })
      }
      className="w-full h-[45px] sm:h-[48px] md:h-[50px]
                 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold 
                 rounded-md shadow flex items-center justify-center gap-1 
                 transition-transform hover:scale-105 active:scale-95 text-xs sm:text-sm md:text-base"
    >
      <ClipboardDocumentListIcon className="h-4 w-4 md:h-5 md:w-5" />
      Your Applications
    </button>

    {/* Holiday Calendar */}
    <button
      onClick={() => navigate("/calendar-view", { state: { from: 'work' } })}
      className="w-full h-[45px] sm:h-[48px] md:h-[50px]
                 bg-blue-600 hover:bg-blue-700 text-white font-semibold 
                 rounded-md shadow flex items-center justify-center gap-1 
                 transition-transform hover:scale-105 active:scale-95 text-xs sm:text-sm md:text-base"
    >
      <BuildingOffice2Icon className="h-4 w-4 md:h-5 md:w-5" />
      Holiday Calendar
    </button>

    {/* My Attendance */}
    <button
      onClick={() =>
        navigate("/my-attendance", { state: { user, employeeId } })
      }
      className="w-full h-[45px] sm:h-[48px] md:h-[50px]
                 bg-green-600 hover:bg-green-700 text-white font-semibold 
                 rounded-md shadow flex items-center justify-center gap-1 
                 transition-transform hover:scale-105 active:scale-95 text-xs sm:text-sm md:text-base"
    >
      <ClockIcon className="h-4 w-4 md:h-5 md:w-5" />
      My Attendance
    </button>
  </div>
</div>

      {/* Request Form */}
      <div className="flex justify-center px-3 sm:px-4 mb-12 mt-6">
<form
  onSubmit={handleSubmit}
  className="w-full max-w-3xl bg-white rounded-xl shadow-lg 
             p-4 sm:p-6 md:p-8 border border-indigo-200 
             space-y-5 sm:space-y-6 text-sm sm:text-base"
>
          <h3 className="text-xl font-bold text-indigo-700 mb-4 flex items-center gap-2 justify-center">
            <PencilSquareIcon className="h-6 w-6 text-indigo-700" />
            Submit New Request
          </h3>

          {/* Name, Employee ID & Department */}
          <div className="flex flex-col sm:flex-col md:flex-row justify-between items-center gap-3 text-center md:text-left">
            <div className="flex items-center gap-2">
              <label className="text-gray-700 font-semibold">Name:</label>
              <span className="text-red-600 font-bold">{user}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-700 font-semibold">Employee ID:</label>
              <span className="text-red-600 font-bold">{employeeId}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-700 font-semibold">Department:</label>
              <span className="text-red-600 font-bold">{department || "—"}</span>
            </div>
          </div>

          {/* Application Type + Paid Holidays */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
<style>
{`
/* Common small screens — improve readability */
@media (max-width: 640px) {
  select, input, textarea {
    font-size: 14px !important;
  }
}

/* iPad & Tablets (Portrait + Landscape) */
@media (min-width: 768px) and (max-width: 1024px) {

  /* Keep holidays + buttons aligned horizontally */
  .ipad-row {
    display: flex !important;
    flex-direction: column !important; /* stack neatly on narrow screens */
    align-items: center !important;
    justify-content: center !important;
    gap: 0.8rem !important;
    width: 100% !important;
    padding: 0 0.8rem !important;
  }

  /* Buttons container */
  .ipad-fix {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;  /* allow wrap if needed */
    justify-content: center !important;
    align-items: center !important;
    gap: 0.6rem !important;
    width: 100% !important;
    max-width: 95vw !important;
  }

  /* Individual buttons */
  .ipad-fix button {
    flex: 1 1 auto !important;
    min-width: 140px !important;   /* smaller but balanced */
    max-width: 160px !important;
    height: 42px !important;
    font-size: 0.85rem !important;
    border-radius: 0.5rem !important;
    white-space: nowrap !important;
  }
}

/* Phones (below iPad) */
@media (max-width: 767px) {
  .ipad-row {
    flex-direction: column !important;
    align-items: center !important;
    gap: 0.6rem !important;
    padding: 0 0.5rem !important;
  }

  .ipad-fix {
    flex-direction: column !important;
    width: 100% !important;
    align-items: center !important;
    gap: 0.5rem !important;
  }

  .ipad-fix button {
    width: 90% !important;
    max-width: 280px !important;
    height: 44px !important;
    font-size: 0.9rem !important;
  }
}

/* ✅ Mac / Large Desktop — no change */
@media (min-width: 1025px) {
  .ipad-fix {
    justify-content: flex-end !important;
    max-width: 1050px !important;
    padding-right: 1rem !important;
  }
  .ipad-fix button {
    width: 230px !important;
  }
}
`}
</style>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default WorkApplication;