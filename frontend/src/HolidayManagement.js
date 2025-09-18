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
  const [dateTime, setDateTime] = useState(new Date());

  // Holidays state
  const [holidays, setHolidays] = useState([
    { date: "2025-01-01", name: "New Year" },
    { date: "2025-01-26", name: "Republic Day" },
    { date: "2025-08-15", name: "Independence Day" },
    { date: "2025-12-25", name: "Christmas" },
  ]);

  // Filters & Sorting
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "" });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ date: "", name: "" });
  const [editIndex, setEditIndex] = useState(null);

  // Delete confirmation modal
  const [deleteIndex, setDeleteIndex] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Filter + sort data
  const filteredHolidays = holidays
    .filter((h) =>
      Object.values(h).join(" ").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortConfig.key || !sortConfig.direction) return 0;
      const dir = sortConfig.direction === "ascending" ? 1 : -1;
      return a[sortConfig.key] > b[sortConfig.key] ? dir : -dir;
    });

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
    setCurrentPage(1);
    setRowsPerPage(10);
  };

  // Add or Edit holiday
  const handleSaveHoliday = () => {
    if (!newHoliday.date || !newHoliday.name.trim()) {
      alert("Please enter both date and holiday name.");
      return;
    }
    if (editIndex !== null) {
      // Editing
      const updated = [...holidays];
      updated[editIndex] = newHoliday;
      setHolidays(updated);
    } else {
      // Adding
      setHolidays([...holidays, newHoliday]);
    }
    setNewHoliday({ date: "", name: "" });
    setEditIndex(null);
    setIsModalOpen(false);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (deleteIndex !== null) {
      const updated = holidays.filter((_, i) => i !== deleteIndex);
      setHolidays(updated);
    }
    setDeleteIndex(null);
  };

  // Open modal for editing
  const handleEdit = (index) => {
    setNewHoliday(holidays[index]);
    setEditIndex(index);
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
              setEditIndex(null);
              setNewHoliday({ date: "", name: "" });
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
              <th
                className="p-4 cursor-pointer select-none"
                onClick={() => requestSort("date")}
              >
                Date {getArrow("date")}
              </th>
              <th
                className="p-4 cursor-pointer select-none"
                onClick={() => requestSort("name")}
              >
                Holiday Name {getArrow("name")}
              </th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentRows.length > 0 ? (
              currentRows.map((h, i) => (
                <tr key={i} className="text-center border-b">
                  <td className="p-4">{h.date}</td>
                  <td className="p-4">{h.name}</td>
                  <td className="p-4 flex justify-center gap-3">
                    <button
                      onClick={() => handleEdit(i + startIndex)}
                      className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow flex items-center gap-1"
                    >
                      <PencilSquareIcon className="h-5 w-5" /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteIndex(i + startIndex)}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md shadow flex items-center gap-1"
                    >
                      <TrashIcon className="h-5 w-5" /> Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="p-6 text-gray-500 text-center">
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
              {editIndex !== null ? "Edit Holiday" : "Add New Holiday"}
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
                value={newHoliday.name}
                onChange={(e) =>
                  setNewHoliday({ ...newHoliday, name: e.target.value })
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
                  {editIndex !== null ? "Save Changes" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteIndex !== null && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg w-[400px] relative text-center">
            <h3 className="text-2xl font-bold text-red-600 mb-6">
              Confirm Delete
            </h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {holidays[deleteIndex]?.name}
              </span>{" "}
              ({holidays[deleteIndex]?.date})?
            </p>
            <div className="flex justify-between">
              <button
                onClick={() => setDeleteIndex(null)}
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

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default HolidayManagement;