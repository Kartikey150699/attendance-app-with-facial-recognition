import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { API_BASE } from "./config";

function MyApprovals() {
  const navigate = useNavigate();
  const location = useLocation();

  const employeeId =
    location.state?.employeeId || localStorage.getItem("employeeId");

  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    approverId: null,
    status: null,
    details: {},
  });

  const [reasonModal, setReasonModal] = useState({
    show: false,
    reason: "",
  });

  // Fetch approvals where this user is an approver
  useEffect(() => {
    const fetchApprovals = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/approvers/by-approver/${employeeId}`
        );
        if (!res.ok) throw new Error("Failed to fetch approvals");
        const data = await res.json();
        setApprovals(data);
      } catch (err) {
        console.error("Error fetching approvals:", err);
      } finally {
        setLoading(false);
      }
    };

    if (employeeId) fetchApprovals();
  }, [employeeId]);

  // Update status after confirmation
  const updateStatus = async (id, status) => {
    try {
      const res = await fetch(`${API_BASE}/approvers/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      const updated = await res.json();

      setApprovals((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status: updated.data.status } : a
        )
      );

      setConfirmModal({
        show: false,
        approverId: null,
        status: null,
        details: {},
      });
    } catch (err) {
      console.error("Error updating status:", err);
      alert("❌ Failed to update status");
    }
  };

  // Filter approvals by month/year of submission
  const filteredApprovals = approvals.filter((a) => {
    if (!a.created_at) return true;
    const appDate = new Date(a.created_at);
    return (
      appDate.getMonth() + 1 === Number(selectedMonth) &&
      appDate.getFullYear() === Number(selectedYear)
    );
  });

  if (loading) return <p className="text-center mt-10">Loading approvals...</p>;

  // Helper to preview reason
  const previewReason = (reason) => {
    if (!reason) return "—";
    return reason.length > 30 ? reason.substring(0, 30) + "..." : reason;
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200 overflow-x-hidden">
      {/* Header */}
{/* Midnight Glass Header */}
<header className="relative w-full bg-gradient-to-r from-slate-800 via-gray-800 to-slate-900 text-white shadow-xl overflow-hidden border-b border-gray-700/30">
  {/* Frosted overlay for glass effect */}
  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 backdrop-blur-md"></div>

  {/* Header Content */}
  <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between px-6 sm:px-10 lg:px-16 py-4 sm:py-5">
    
    {/* Left: Logo + Title */}
    <div
      onClick={() => navigate("/")}
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
        onClick={() => navigate("/work-application")}
        className="order-1 sm:order-2 px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 via-rose-500 to-pink-400 
                   hover:from-red-600 hover:to-pink-500 text-white font-semibold shadow-lg hover:shadow-xl 
                   transition-all duration-300 flex items-center gap-2"
      >
        <ArrowUturnLeftIcon className="h-5 w-5 text-white" />
        Back
      </button>
    </div>
  </div>
</header>

<div className="flex flex-col items-center justify-center mt-6 text-center px-4">
  {/* Title */}
  <h1 className="text-3xl sm:text-4xl font-extrabold text-indigo-700 mb-3 flex items-center gap-2 justify-center">
    <ClipboardDocumentCheckIcon className="h-7 w-7 text-indigo-600" />
    My Approvals
  </h1>

  {/* Filters */}
  <div className="flex justify-center gap-3 flex-wrap">
    <select
      value={selectedMonth}
      onChange={(e) => setSelectedMonth(e.target.value)}
      className="px-3 py-1 border rounded shadow-sm text-sm sm:text-base"
    >
      {[...Array(12).keys()].map((m) => (
        <option key={m + 1} value={m + 1}>
          {new Date(0, m).toLocaleString("default", { month: "long" })}
        </option>
      ))}
    </select>

    <select
      value={selectedYear}
      onChange={(e) => setSelectedYear(e.target.value)}
      className="px-3 py-1 border rounded shadow-sm text-sm sm:text-base"
    >
      {[2024, 2025, 2026].map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  </div>
</div>

<div className="flex-grow p-4 sm:p-6">

        {filteredApprovals.length === 0 ? (
          <p>No applications for this period.</p>
        ) : (
          <div className="overflow-x-auto w-full">
  <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden 
                   text-[10px] sm:text-sm md:text-base 
                   table-auto border-collapse">
              <thead className="bg-indigo-200 text-indigo-900 text-sm border-b border-black">
                <tr>
                  <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[10px] sm:text-sm">Employee</th>
                  <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[10px] sm:text-sm">Department</th>
                  <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[10px] sm:text-sm">Submission Date</th>
                  <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[10px] sm:text-sm">Period</th>
                  <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[10px] sm:text-sm">Reason</th>
                  <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[10px] sm:text-sm">Application Type</th>
                  <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[10px] sm:text-sm">Paid Leave</th>
                  <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[10px] sm:text-sm">Level</th>
                  <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[10px] sm:text-sm">Status</th>
                  <th className="px-4 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredApprovals.map((a) => (
                  <tr
                    key={a.id}
                    className={`text-sm border-b border-black ${
                      a.status === "Pending"
                        ? "bg-yellow-100"
                        : a.status === "Approved"
                        ? "bg-green-100"
                        : a.status === "Rejected"
                        ? "bg-red-100"
                        : ""
                    }`}
                  >
                    <td className="px-1 sm:px-3 py-1.5 sm:py-2 break-words whitespace-normal text-[10px] sm:text-sm">
                      {a.employee_name} ({a.employee_id})
                    </td>
                    <td className="px-1 sm:px-3 py-1.5 sm:py-2 break-words whitespace-normal text-[10px] sm:text-sm">{a.department || "-"}</td>
                    <td className="px-1 sm:px-3 py-1.5 sm:py-2 break-words whitespace-normal text-[10px] sm:text-sm">
                      {a.created_at
                        ? new Date(a.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-1 sm:px-3 py-1.5 sm:py-2 break-words whitespace-normal text-[10px] sm:text-sm">
                      {a.start_date} → {a.end_date}
                    </td>
                    <td
                      className="px-4 py-2 text-blue-600 cursor-pointer underline"
                      onClick={() =>
                        setReasonModal({ show: true, reason: a.reason })
                      }
                    >
                      {previewReason(a.reason)}
                    </td>
                    <td className="px-1 sm:px-3 py-1.5 sm:py-2 break-words whitespace-normal text-[10px] sm:text-sm">{a.application_type}</td>
                    <td className="px-1 sm:px-3 py-1.5 sm:py-2 break-words whitespace-normal text-[10px] sm:text-sm">
                      {a.use_paid_holiday === "yes" ? (
                        <span className="text-green-700 font-semibold">Yes</span>
                      ) : (
                        <span className="text-gray-600 font-semibold">No</span>
                        )}
                    </td>
                    <td className="px-1 sm:px-3 py-1.5 sm:py-2 break-words whitespace-normal text-[10px] sm:text-sm">{a.level}</td>

                    {/* Status Column */}
                    <td className="px-1 sm:px-3 py-1.5 sm:py-2 break-words whitespace-normal text-[10px] sm:text-sm">
                      {a.status === "Rejected" && a.rejection_message ? (
                        <span className="text-red-600 font-bold">
                          {a.rejection_message}
                        </span>
                      ) : (
                        <span
                          className={
                            a.status === "Approved"
                              ? "text-green-600 font-bold"
                              : a.status === "Rejected"
                              ? "text-red-600 font-bold"
                              : "text-yellow-600 font-bold"
                          }
                        >
                          {a.status}
                        </span>
                      )}
                    </td>

                    {/* Action Column */}
                    <td className="px-4 py-2 text-center">
                      {a.status === "Pending" && (
                        <div className="flex gap-2 justify-center">
                          {a.can_take_action ? (
                            <>
                              <button
                                onClick={() =>
                                  setConfirmModal({
                                    show: true,
                                    approverId: a.id,
                                    status: "Approved",
                                    details: a,
                                  })
                                }
                                className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-green-500 hover:bg-green-600 text-white rounded flex items-center gap-1"
                              >
                                <CheckCircleIcon className="h-4 w-4" /> Approve
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmModal({
                                    show: true,
                                    approverId: a.id,
                                    status: "Rejected",
                                    details: a,
                                  })
                                }
                                className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-red-500 hover:bg-red-600 text-white rounded flex items-center gap-1"
                              >
                                <XCircleIcon className="h-4 w-4" /> Reject
                              </button>
                            </>
                          ) : (
                            <div className="text-gray-500 text-sm italic">
                              Waiting for {a.waiting_for || "lower level approver"}
                            </div>
                          )}
                        </div>
                      )}

                      {a.status === "Rejected" && (
                        <div className="text-red-600 font-bold text-sm italic">
                          {a.rejection_message || "Rejected"}
                        </div>
                      )}

                      {a.status === "Approved" && (
                        <div className="text-green-600 font-bold text-sm italic">
                          Approved
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reason Modal */}
      {reasonModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg max-w-[90vw] sm:max-w-lg w-full mx-2">
            <h2 className="text-lg font-bold mb-3 text-indigo-700">
              Application Reason
            </h2>
            <div className="max-h-60 overflow-y-auto border p-3 rounded bg-gray-50">
              {reasonModal.reason}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setReasonModal({ show: false, reason: "" })}
                className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg max-w-[90vw] sm:max-w-md w-full text-center mx-2">
            <p className="font-bold text-lg text-gray-800 mb-3">
              Confirm {confirmModal.status}
            </p>
            <p>
              Employee:{" "}
              <b>
                {confirmModal.details.employee_name} (
                {confirmModal.details.employee_id})
              </b>
            </p>
            <p>Department: {confirmModal.details.department || "-"}</p>
            <p>
              Submission Date:{" "}
              {confirmModal.details.created_at
                ? new Date(confirmModal.details.created_at).toLocaleDateString()
                : "—"}
            </p>
            <p>Application Type: {confirmModal.details.application_type}</p>
            <div className="flex justify-center gap-3 mt-4">
<button
  onClick={() =>
    updateStatus(confirmModal.approverId, confirmModal.status)
  }
  className={`px-5 py-2 text-white rounded-lg shadow transition-all duration-200 ${
    confirmModal.status === "Rejected"
      ? "bg-red-600 hover:bg-red-700"
      : "bg-green-600 hover:bg-green-700"
  }`}
>
  Yes, {confirmModal.status}
</button>
              <button
                onClick={() =>
                  setConfirmModal({
                    show: false,
                    approverId: null,
                    status: null,
                    details: {},
                  })
                }
                className="px-5 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg shadow"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default MyApprovals;