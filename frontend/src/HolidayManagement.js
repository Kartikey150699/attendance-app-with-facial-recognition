import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUturnLeftIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime";

function HolidayManagement() {
  const navigate = useNavigate();

  // Holidays state
  const [holidays, setHolidays] = useState([]);

  // Filters & Sorting
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "" });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ date: "", holiday_name: "", created_by: 1 });
  const [editHoliday, setEditHoliday] = useState(null);

  // Delete confirmation modal
  const [deleteHoliday, setDeleteHoliday] = useState(null);

  // Validation Error Modal
  const [validationError, setValidationError] = useState(null);

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

  // Fetch holidays from backend
  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const res = await fetch("http://localhost:8000/holiday/");
      if (!res.ok) throw new Error("Failed to fetch holidays");
      const data = await res.json();
      setHolidays(data);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    }
  };

  // Sorting
  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    } else if (sortConfig.key === key && sortConfig.direction === "descending") {
      direction = "";
    }
    setSortConfig({ key, direction });
  };

  const getArrow = (key) => {
    if (sortConfig.key !== key) return "";
    if (sortConfig.direction === "ascending") return "▲";
    if (sortConfig.direction === "descending") return "▼";
    return "";
  };

  // Format date → "2025 Sep 23"
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Filter + sort data
  const filteredHolidays = holidays
  .filter((h) => {
    if (!h.date) return false;
    const d = new Date(h.date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  })
  .filter((h) =>
    Object.values(h).join(" ").toLowerCase().includes(search.toLowerCase())
  )

  // Pagination logic
  const totalPages = Math.ceil(filteredHolidays.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentRows = filteredHolidays.slice(
    startIndex,
    startIndex + rowsPerPage
  );

  const resetFilters = () => {
  setSearch("");
  setSortConfig({ key: "", direction: "" });
  setMonth(new Date().getMonth() + 1);  
  setYear(new Date().getFullYear());  
  setCurrentPage(1);
  setRowsPerPage(10);
};

  // Add or Edit holiday
  const handleSaveHoliday = async () => {
    if (!newHoliday.date || !newHoliday.holiday_name.trim()) {
  setValidationError("⚠️ Please enter both date and holiday name.");
  return;
}

    try {
      if (editHoliday) {
        // Update existing holiday
        const res = await fetch(
          `http://localhost:8000/holiday/${editHoliday.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newHoliday),
          }
        );
        if (!res.ok) throw new Error("Failed to update holiday");
      } else {
        // Add new holiday
        const res = await fetch("http://localhost:8000/holiday/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newHoliday),
        });
        if (!res.ok) throw new Error("Failed to add holiday");
      }
      await fetchHolidays();
      setNewHoliday({ date: "", holiday_name: "", created_by: 1 });
      setEditHoliday(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving holiday:", error);
    }
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (deleteHoliday) {
      try {
        const res = await fetch(
          `http://localhost:8000/holiday/${deleteHoliday.id}`,
          {
            method: "DELETE",
          }
        );
        if (!res.ok) throw new Error("Failed to delete holiday");
        await fetchHolidays();
      } catch (error) {
        console.error("Error deleting holiday:", error);
      }
    }
    setDeleteHoliday(null);
  };

  // Open modal for editing
  const handleEdit = (holiday) => {
    setNewHoliday({
      date: holiday.date,
      holiday_name: holiday.holiday_name,
      created_by: holiday.created_by || 1,
    });
    setEditHoliday(holiday);
    setIsModalOpen(true);
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
  className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
>
  <ArrowUturnLeftIcon className="h-5 w-5 text-white" />
  <span>Back</span>
</button>
        </div>
      </div>

      {/* Page Title */}
      <div className="flex justify-center py-8">
        <h2 className="text-3xl font-bold text-indigo-700 flex items-center gap-2">
          <CalendarDaysIcon className="h-8 w-8 text-indigo-700" />
          Holiday Management
        </h2>
      </div>

      {/* Filters */}
      <div className="max-w-6xl w-full mx-auto px-6 mb-6">
        <div className="flex flex-wrap gap-4 justify-between items-center bg-white p-5 rounded-lg shadow text-lg">
          {/* Search */}
          <div className="flex items-center gap-2">
            <MagnifyingGlassIcon className="h-6 w-6 text-indigo-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search holidays..."
              className="px-4 py-2 border rounded-md shadow-sm text-base focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Month & Year Selectors */}
<div className="flex gap-3">
  <select
    value={month}
    onChange={(e) => setMonth(Number(e.target.value))}
    className="px-3 py-2 border rounded-md text-base"
  >
    {monthNames.map((m, i) => (
      <option key={i + 1} value={i + 1}>
        {m}
      </option>
    ))}
  </select>
  <select
    value={year}
    onChange={(e) => setYear(Number(e.target.value))}
    className="px-3 py-2 border rounded-md text-base"
  >
    {Array.from({ length: 5 }, (_, i) => year - 2 + i).map((y) => (
      <option key={y} value={y}>
        {y}
      </option>
    ))}
  </select>
</div>

          {/* Rows per page */}
          <div>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="px-3 py-2 border rounded-md text-base"
            >
              {[10, 20, 50].map((num) => (
                <option key={num} value={num}>
                  {num} rows
                </option>
              ))}
            </select>
          </div>

          {/* Reset */}
          <button
            onClick={resetFilters}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md shadow text-base font-semibold"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Reset
          </button>

          {/* Add Holiday */}
          <button
            onClick={() => {
              setIsModalOpen(true);
              setEditHoliday(null);
              setNewHoliday({ date: "", holiday_name: "", created_by: 1 });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md shadow text-base font-semibold"
          >
            <PlusCircleIcon className="h-5 w-5" />
            Add Holiday
          </button>
        </div>
      </div>

      {/* Holidays Table */}
      <div className="max-w-6xl w-full mx-auto px-6 flex-grow mb-12">
        <table className="w-full border-collapse bg-white shadow-lg rounded-xl overflow-hidden text-lg">
          <thead>
            <tr className="bg-indigo-500 text-white text-lg">
              <th className="p-4 cursor-pointer" onClick={() => requestSort("date")}>
                Date {getArrow("date")}
              </th>
              <th className="p-4 cursor-pointer" onClick={() => requestSort("holiday_name")}>
                Holiday Name {getArrow("holiday_name")}
              </th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentRows.length > 0 ? (
              currentRows.map((h) => (
                <tr key={h.id} className="text-center border-b">
                  <td className="p-4">{formatDate(h.date)}</td>
                  <td className="p-4">{h.holiday_name}</td>
                  <td className="p-4 flex justify-center gap-3">
                    <button
                      onClick={() => handleEdit(h)}
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
                <td colSpan="4" className="p-6 text-gray-500 text-center">
                  No holidays found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-6">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => prev - 1)}
            className={`px-4 py-2 rounded-md font-semibold shadow ${
              currentPage === 1
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            Previous
          </button>
          <span className="text-lg font-semibold">
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage((prev) => prev + 1)}
            className={`px-4 py-2 rounded-md font-semibold shadow ${
              currentPage === totalPages || totalPages === 0
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            Next
          </button>
        </div>
      </div>

      {/* Modal for Add/Edit Holiday */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg w-[400px] relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <h3 className="text-2xl font-bold text-indigo-700 mb-6 text-center">
              {editHoliday ? "Edit Holiday" : "Add New Holiday"}
            </h3>
            <div className="flex flex-col gap-4">
              <input
                type="date"
                value={newHoliday.date}
                onChange={(e) =>
                  setNewHoliday({ ...newHoliday, date: e.target.value })
                }
                className="px-4 py-2 border rounded-md shadow-sm text-base focus:ring-2 focus:ring-indigo-400"
              />
              <input
                type="text"
                value={newHoliday.holiday_name}
                onChange={(e) =>
                  setNewHoliday({ ...newHoliday, holiday_name: e.target.value })
                }
                placeholder="Holiday Name"
                className="px-4 py-2 border rounded-md shadow-sm text-base focus:ring-2 focus:ring-indigo-400"
              />
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
                  {editHoliday ? "Save Changes" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteHoliday && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg w-[400px] relative text-center">
            <h3 className="text-2xl font-bold text-red-600 mb-6">
              Confirm Delete
            </h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {deleteHoliday.holiday_name}
              </span>{" "}
              ({formatDate(deleteHoliday.date)})?
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

      {/* Validation Error Modal */}
{validationError && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg w-[350px] text-center relative">
      <h3 className="text-xl font-bold text-red-600 mb-4">Validation Error</h3>
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

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default HolidayManagement;