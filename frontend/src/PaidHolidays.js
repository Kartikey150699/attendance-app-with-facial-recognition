import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  GiftIcon,
  MagnifyingGlassIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";
import { API_BASE } from "./config";

function PaidHolidays() {
  const navigate = useNavigate();

  // States
  const [paidHolidays, setPaidHolidays] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newHoliday, setNewHoliday] = useState({
    employee_id: "",
    employee_name: "",
    department: "",
    total_quota: 0,
    used_days: 0,
    valid_till: "",
    created_by: 1,
  });
  const [editHoliday, setEditHoliday] = useState(null);
  const [deleteHoliday, setDeleteHoliday] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // Fetch Paid Holidays & Users
  useEffect(() => {
    fetchPaidHolidays();
    fetchUsers();
  }, []);

  const fetchPaidHolidays = async () => {
    try {
      const res = await fetch(`${API_BASE}/paid-holidays/`);
      if (!res.ok) throw new Error("Failed to fetch paid holidays");
      const data = await res.json();
      setPaidHolidays(data);
    } catch (error) {
      console.error("Error fetching paid holidays:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/list`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // Save Paid Holiday (Add/Edit)
  const handleSaveHoliday = async () => {
    if (!newHoliday.employee_id || !newHoliday.total_quota) {
      setValidationError("⚠️ Please select employee and quota days.");
      return;
    }

    try {
      if (editHoliday) {
        // Update existing
        const res = await fetch(
          `${API_BASE}/paid-holidays/${editHoliday.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newHoliday),
          }
        );
        if (!res.ok) throw new Error("Failed to update record");
      } else {
        // Add new
        const res = await fetch(`${API_BASE}/paid-holidays/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newHoliday),
        });
        if (!res.ok) throw new Error("Failed to add record");
      }
      await fetchPaidHolidays();
      setNewHoliday({
        employee_id: "",
        employee_name: "",
        department: "",
        total_quota: 0,
        used_days: 0,
        valid_till: "",
        created_by: 1,
      });
      setEditHoliday(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving paid holiday:", error);
    }
  };

  // Delete
  const confirmDelete = async () => {
    if (deleteHoliday) {
      try {
        const res = await fetch(
          `${API_BASE}/paid-holidays/${deleteHoliday.id}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Failed to delete record");
        await fetchPaidHolidays();
      } catch (error) {
        console.error("Error deleting record:", error);
      }
    }
    setDeleteHoliday(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
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
  onClick={() => navigate("/admin-dashboard")}
  className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 
             transition-transform duration-200 text-white font-bold rounded-lg shadow flex 
             items-center justify-center gap-2"
>
  <ArrowUturnLeftIcon className="h-5 w-5 text-white" />
  Back
</button>
        </div>
      </div>

      {/* Title */}
      <div className="flex justify-center py-8">
        <h2 className="text-3xl font-bold text-indigo-700 flex items-center gap-2">
          <GiftIcon className="h-8 w-8 text-indigo-700" />
          Paid Holidays Management
        </h2>
      </div>

      {/* Search + Add */}
      <div className="max-w-6xl w-full mx-auto px-6 mb-6 flex justify-between items-center bg-white p-5 rounded-lg shadow text-lg">
        <div className="flex items-center gap-2">
          <MagnifyingGlassIcon className="h-6 w-6 text-indigo-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID..."
            className="px-4 py-2 border rounded-md shadow-sm text-base focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <button
          onClick={() => {
            setIsModalOpen(true);
            setEditHoliday(null);
            setNewHoliday({
              employee_id: "",
              employee_name: "",
              department: "",
              total_quota: 0,
              used_days: 0,
              valid_till: "",
              created_by: 1,
            });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md shadow text-base font-semibold"
        >
          <PlusCircleIcon className="h-5 w-5" />
          Assign Paid Quota
        </button>
      </div>

      {/* Paid Holidays Table */}
      <div className="max-w-6xl w-full mx-auto px-6 flex-grow mb-12">
        <table className="w-full border-collapse bg-white shadow-lg rounded-xl overflow-hidden text-lg">
          <thead>
            <tr className="bg-purple-600 text-white text-lg">
              <th className="p-4">Employee ID</th>
              <th className="p-4">Name</th>
              <th className="p-4">Department</th>
              <th className="p-4">Total Quota</th>
              <th className="p-4">Used</th>
              <th className="p-4">Remaining</th>
              <th className="p-4">Valid Till</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paidHolidays.length > 0 ? (
              paidHolidays
                .filter((h) =>
                  Object.values(h)
                    .join(" ")
                    .toLowerCase()
                    .includes(search.toLowerCase())
                )
                .map((h) => (
                  <tr key={h.id} className="text-center border-b">
                    <td className="p-4">{h.employee_id}</td>
                    <td className="p-4">{h.employee_name}</td>
                    <td className="p-4">{h.department || "-"}</td>
                    <td className="p-4">{h.total_quota}</td>
                    <td className="p-4">{h.used_days}</td>
                    <td className="p-4">{h.remaining_days}</td>
                    <td className="p-4">
                      {h.valid_till ? formatDate(h.valid_till) : "-"}
                    </td>
                    <td className="p-4 flex justify-center gap-3">
                      <button
                        onClick={() => {
                          setEditHoliday(h);
                          setNewHoliday(h);
                          setIsModalOpen(true);
                        }}
                        className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow flex items-center gap-1"
                      >
                        <PencilSquareIcon className="h-5 w-5" /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteHoliday(h)}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md shadow flex items-center gap-1"
                      >
                        <TrashIcon className="h-5 w-5" /> Delete
                      </button>
                    </td>
                  </tr>
                ))
            ) : (
              <tr>
                <td colSpan="8" className="p-6 text-gray-500 text-center">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

{/* Add/Edit Modal */}
{isModalOpen && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
    <div className="bg-white p-8 rounded-lg shadow-lg w-[450px] relative">
      <button
        onClick={() => setIsModalOpen(false)}
        className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
      >
        <XMarkIcon className="h-6 w-6" />
      </button>
      <h3 className="text-2xl font-bold text-indigo-700 mb-6 text-center">
        {editHoliday ? "Edit Paid Leave Quota" : "Assign Paid Leave Quota"}
      </h3>

      <div className="flex flex-col gap-4">
        {/* Employee Selector (Only for Add) */}
        {!editHoliday && (
          <>
            <label className="font-semibold text-gray-700">Select Employee</label>
            <select
              value={newHoliday.employee_id}
              onChange={(e) => {
                const selectedUser = users.find(
                  (u) => u.employee_id === e.target.value
                );
                setNewHoliday({
                  ...newHoliday,
                  employee_id: selectedUser.employee_id,
                  employee_name: selectedUser.name,
                  department: selectedUser.department,
                });
              }}
              className="px-4 py-2 border rounded-md shadow-sm text-base focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Select Employee</option>
              {users.map((u) => (
                <option key={u.id} value={u.employee_id}>
                  {u.employee_id} - {u.name} ({u.department})
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500">
              Choose the employee to whom you want to assign paid leaves.
            </p>
          </>
        )}

        {/* Read-only Employee Info (Only for Edit) */}
        {editHoliday && (
          <div className="p-3 bg-gray-100 rounded-md border text-gray-800">
            <p>
              <span className="font-semibold">Employee:</span>{" "}
              {newHoliday.employee_name} ({newHoliday.employee_id})
            </p>
            <p>
              <span className="font-semibold">Department:</span>{" "}
              {newHoliday.department || "-"}
            </p>
          </div>
        )}

        {/* Quota Days */}
        <label className="font-semibold text-gray-700">
          Total Paid Leave Days
        </label>
        <input
          type="number"
          min="1"
          value={newHoliday.total_quota || ""}
          onChange={(e) =>
            setNewHoliday({
              ...newHoliday,
              total_quota: parseInt(e.target.value),
            })
          }
          placeholder="Enter number of paid leave days"
          className="px-4 py-2 border rounded-md shadow-sm text-base focus:ring-2 focus:ring-indigo-400"
        />
        <p className="text-sm text-gray-500">
          {editHoliday
            ? "Change total leave days for this employee."
            : "Enter how many paid leave days this employee will receive."}
        </p>

        {/* Valid Till */}
        <label className="font-semibold text-gray-700">
          Valid Till (Expiry Date)
        </label>
        <input
          type="date"
          value={newHoliday.valid_till || ""}
          onChange={(e) =>
            setNewHoliday({ ...newHoliday, valid_till: e.target.value })
          }
          className="px-4 py-2 border rounded-md shadow-sm text-base focus:ring-2 focus:ring-indigo-400"
        />
        <p className="text-sm text-gray-500">
          {editHoliday
            ? "Update the expiry date of this quota."
            : "Set the last date until which the employee can use the paid leaves."}
        </p>

        <div className="flex justify-between mt-4">
          <button
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-md shadow font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveHoliday}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md shadow font-semibold"
          >
            {editHoliday ? "Save Changes" : "Assign"}
          </button>
        </div>
      </div>
    </div>
  </div>
)}

      {/* Delete Modal */}
      {deleteHoliday && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg w-[400px] relative text-center">
            <h3 className="text-2xl font-bold text-red-600 mb-6">
              Confirm Delete
            </h3>
            <p className="text-gray-700 mb-6">
              Remove Paid Holiday Quota for{" "}
              <span className="font-semibold">
                {deleteHoliday.employee_name} ({deleteHoliday.employee_id})
              </span>
              ?
            </p>
            <div className="flex justify-between">
              <button
                onClick={() => setDeleteHoliday(null)}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-md shadow font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md shadow font-semibold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Error */}
      {validationError && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-[350px] text-center relative">
            <h3 className="text-xl font-bold text-red-600 mb-4">
              Validation Error
            </h3>
            <p className="text-gray-700 mb-6">{validationError}</p>
            <button
              onClick={() => setValidationError(null)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow font-semibold"
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

export default PaidHolidays;