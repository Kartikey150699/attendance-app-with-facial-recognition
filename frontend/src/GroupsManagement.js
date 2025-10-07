import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUturnLeftIcon, Cog6ToothIcon } from "@heroicons/react/24/solid";
import HeaderDateTime from "./HeaderDateTime";
import Footer from "./Footer";
import { API_BASE } from "./config";

function GroupsManagement() {
  const [groups, setGroups] = useState([]);
  const [newGroup, setNewGroup] = useState({ name: "", description: "", schedule: {} });
  const [modal, setModal] = useState({ isOpen: false });
  const [editingGroup, setEditingGroup] = useState(null); // group being edited
  const navigate = useNavigate();

  // Fetch groups
  useEffect(() => {
    fetch(`${API_BASE}/shift-groups/`)
      .then((res) => res.json())
      .then((data) => setGroups(data))
      .catch(() =>
        setModal({
          isOpen: true,
          title: "❌ Error",
          message: "❌ Failed to load groups",
          onConfirm: () => setModal({ isOpen: false }),
        })
      );
  }, []);

  // Create group
  const createGroup = async () => {
    if (!newGroup.name.trim()) {
      setModal({
        isOpen: true,
        title: "❌ Error",
        message: "Group name is required!",
        onConfirm: () => setModal({ isOpen: false }),
      });
      return;
    }
    if (Object.keys(newGroup.schedule).length === 0) {
      setModal({
        isOpen: true,
        title: "❌ Error",
        message: "Please select at least one day!",
        onConfirm: () => setModal({ isOpen: false }),
      });
      return;
    }
    const times = Object.values(newGroup.schedule)[0];
    if (times[0] === "00:00" && times[1] === "00:00") {
      setModal({
        isOpen: true,
        title: "❌ Error",
        message: "Please set valid start and end times!",
        onConfirm: () => setModal({ isOpen: false }),
      });
      return;
    }

const res = await fetch(`${API_BASE}/shift-groups/create`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(newGroup),
});

    const data = await res.json();
    if (res.ok) {
      setGroups([...groups, data.data]);
      setNewGroup({ name: "", description: "", schedule: {} });
      setModal({
        isOpen: true,
        title: "✅ Success",
        message: `✅ Group "${data.data.name}" created!`,
        onConfirm: () => setModal({ isOpen: false }),
      });
    } else {
      setModal({
        isOpen: true,
        title: "❌ Error",
        message: data.detail || "Failed to create group",
        onConfirm: () => setModal({ isOpen: false }),
      });
    }
  };

  // Delete group
  const deleteGroup = (g) => {
    setModal({
      isOpen: true,
      title: "Confirm Delete",
      message: `Are you sure you want to delete "${g.name}"?`,
      showCancel: true,
      onCancel: () => setModal({ isOpen: false }),
      onConfirm: async () => {
        const res = await fetch(`${API_BASE}/shift-groups/${g.id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setGroups(groups.filter((grp) => grp.id !== g.id));
          setModal({
            isOpen: true,
            title: "✅ Success",
            message: `✅ Group "${g.name}" deleted!`,
            onConfirm: () => setModal({ isOpen: false }),
          });
        } else {
          setModal({
            isOpen: true,
            title: "❌ Error",
            message: "Failed to delete group",
            onConfirm: () => setModal({ isOpen: false }),
          });
        }
      },
    });
  };

 // ✅ Save edited group
const saveEditGroup = async () => {
  // --- Safety check ---
  if (!editingGroup?.id) {
    console.error("❌ Missing group ID for update");
    setModal({
      isOpen: true,
      title: "❌ Error",
      message: "Cannot update — missing group ID.",
      onConfirm: () => setModal({ isOpen: false }),
    });
    return;
  }

  try {
    // --- Send PUT request ---
    const res = await fetch(`${API_BASE}/shift-groups/${editingGroup.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editingGroup.name,
        description: editingGroup.description,
        schedule: editingGroup.schedule,
      }),
    });

    const data = await res.json();

    // --- On success ---
    if (res.ok) {
      // Re-fetch all groups (ensures latest data + correct IDs)
      const refreshedGroups = await fetch(`${API_BASE}/shift-groups/`).then((r) => r.json());
      setGroups(refreshedGroups);
      setEditingGroup(null);

      setModal({
        isOpen: true,
        title: "✅ Success",
        message:
          "Group updated successfully!\n\nShifts for all assigned employees were automatically regenerated.",
        onConfirm: () => setModal({ isOpen: false }),
      });
    } else {
      // --- On backend validation error ---
      setModal({
        isOpen: true,
        title: "❌ Error",
        message: data.detail || "Failed to update group.",
        onConfirm: () => setModal({ isOpen: false }),
      });
    }
  } catch (err) {
    // --- On network or unexpected error ---
    console.error("❌ Update failed:", err);
    setModal({
      isOpen: true,
      title: "❌ Error",
      message: "Network or server error occurred while updating group.",
      onConfirm: () => setModal({ isOpen: false }),
    });
  }
};

  // Sort order
  const dayOrder = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7 };

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
            onClick={() => navigate("/shifts-management")}
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 
                       active:scale-95 transition-transform duration-200 text-white font-bold 
                       rounded-lg shadow flex items-center justify-center gap-2"
          >
            <ArrowUturnLeftIcon className="h-5 w-5 text-white" />
            <span>Back</span>
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="flex flex-col items-center py-6">
        <h2 className="text-4xl font-bold text-indigo-700 mb-4 flex items-center gap-3">
          <Cog6ToothIcon className="h-8 w-8 text-indigo-700 animate-spin-slow" />
          Groups Management
        </h2>
      </div>

      {/* Side by side layout */}
      <div className="max-w-6xl mx-auto flex gap-6 px-6 mb-6">
        {/* Create Group */}
        <div className="flex-1 bg-white shadow rounded-lg p-6 hover:shadow-xl transition">
          <h4 className="text-2xl font-semibold mb-3">Create New Group</h4>

          <input
            type="text"
            placeholder="Group name"
            value={newGroup.name}
            onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
            className="border p-2 rounded w-full mb-2 focus:ring-2 focus:ring-indigo-400 outline-none transition"
          />
          <input
            type="text"
            placeholder="Description"
            value={newGroup.description}
            onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
            className="border p-2 rounded w-full mb-4 focus:ring-2 focus:ring-indigo-400 outline-none transition"
          />

          {/* Day buttons */}
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
              <button
                key={day}
                type="button"
                className={`px-4 py-2 rounded-lg font-semibold border transition-all duration-200 ${
                  newGroup.schedule[day]
                    ? "bg-indigo-600 text-white shadow-md scale-105"
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
                onClick={() => {
                  const schedule = { ...newGroup.schedule };
                  if (schedule[day]) {
                    delete schedule[day];
                  } else {
                    schedule[day] = ["00:00", "00:00"];
                  }
                  setNewGroup({ ...newGroup, schedule });
                }}
              >
                {day.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Time pickers */}
          <div className="flex justify-center gap-8 mb-4">
            <div>
              <label className="block text-sm font-semibold text-center">Start Time</label>
              <input
                type="time"
                value={
                  Object.keys(newGroup.schedule).length
                    ? Object.values(newGroup.schedule)[0][0]
                    : "00:00"
                }
                className="border p-2 rounded text-center"
                onChange={(e) => {
                  const value = e.target.value;
                  const schedule = { ...newGroup.schedule };
                  Object.keys(schedule).forEach((day) => {
                    schedule[day] = [value, schedule[day][1]];
                  });
                  setNewGroup({ ...newGroup, schedule });
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-center">End Time</label>
              <input
                type="time"
                value={
                  Object.keys(newGroup.schedule).length
                    ? Object.values(newGroup.schedule)[0][1]
                    : "00:00"
                }
                className="border p-2 rounded text-center"
                onChange={(e) => {
                  const value = e.target.value;
                  const schedule = { ...newGroup.schedule };
                  Object.keys(schedule).forEach((day) => {
                    schedule[day] = [schedule[day][0], value];
                  });
                  setNewGroup({ ...newGroup, schedule });
                }}
              />
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={createGroup}
              className="px-6 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 hover:scale-105 active:scale-95 transition"
            >
              Create Group
            </button>
          </div>
        </div>

        {/* Existing Groups */}
        <div className="flex-1 bg-white shadow rounded-lg p-6">
          <h4 className="text-2xl font-semibold mb-3">Existing Groups</h4>
          <div className="space-y-4">
            {groups.map((g) => {
              const isEditing = editingGroup && editingGroup.id === g.id;

              const schedule = g.default_schedule || g.schedule || {};
              const grouped = {};
              Object.entries(schedule).forEach(([day, times]) => {
                const key = Array.isArray(times) ? `${times[0]} - ${times[1]}` : "-";
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(day.toUpperCase());
              });

              return (
                <div
                  key={g.id}
                  className="border p-4 rounded-lg flex flex-col bg-gray-50 shadow hover:shadow-lg hover:scale-[1.01] transition"
                >
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={editingGroup.name}
                        onChange={(e) =>
                          setEditingGroup({ ...editingGroup, name: e.target.value })
                        }
                        className="border p-2 rounded mb-2"
                      />
                      <input
                        type="text"
                        value={editingGroup.description}
                        onChange={(e) =>
                          setEditingGroup({ ...editingGroup, description: e.target.value })
                        }
                        className="border p-2 rounded mb-2"
                      />

                      {/* Editable days */}
                      <div className="flex flex-wrap gap-2 mb-2">
                        {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
  <button
    key={day}
    type="button"
    className={`px-4 py-2 rounded-lg font-semibold border ${
      editingGroup.schedule?.[day]
        ? "bg-indigo-600 text-white"
        : "bg-gray-200"
    }`}
    onClick={() => {
      const schedule = { ...(editingGroup.schedule || {}) };
if (schedule[day]) {
  // remove existing day
  delete schedule[day];
} else {
  // Copy timings from the first existing day
  const existingDay = Object.keys(schedule)[0];
  if (existingDay && Array.isArray(schedule[existingDay])) {
    schedule[day] = [...schedule[existingDay]]; // copy same times
  } else {
    schedule[day] = ["09:00", "18:00"]; // default fallback
  }
}
setEditingGroup({ ...editingGroup, schedule });
    }}
  >
    {day.toUpperCase()}
  </button>
))}
                      </div>

                      {/* Editable timings */}
                     <div className="flex gap-4 mb-2">
  {/* Start Time */}
  <input
    type="time"
    value={
      editingGroup.schedule && Object.keys(editingGroup.schedule).length
        ? Object.values(editingGroup.schedule)[0][0]
        : "00:00"
    }
    onChange={(e) => {
      const value = e.target.value;
      const schedule = { ...(editingGroup.schedule || {}) };
      Object.keys(schedule).forEach((day) => {
        schedule[day] = [value, schedule[day][1]];
      });
      setEditingGroup({ ...editingGroup, schedule });
    }}
    className="border p-2 rounded"
  />

  {/* End Time */}
  <input
    type="time"
    value={
      editingGroup.schedule && Object.keys(editingGroup.schedule).length
        ? Object.values(editingGroup.schedule)[0][1]
        : "00:00"
    }
    onChange={(e) => {
      const value = e.target.value;
      const schedule = { ...(editingGroup.schedule || {}) };
      Object.keys(schedule).forEach((day) => {
        schedule[day] = [schedule[day][0], value];
      });
      setEditingGroup({ ...editingGroup, schedule });
    }}
    className="border p-2 rounded"
  />
</div>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingGroup(null)}
                          className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEditGroup}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Save
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-bold text-lg text-indigo-700">{g.name}</h5>
                        <p className="text-sm text-gray-600 mb-2">{g.description}</p>

                        <ul className="list-disc pl-5 space-y-1">
                          {Object.entries(grouped).map(([time, days]) => {
                            const sortedDays = days.sort(
                              (a, b) => dayOrder[a] - dayOrder[b]
                            );
                            return (
                              <li key={time}>
                                <span className="font-semibold">
                                  {sortedDays.join(", ")}
                                </span>{" "}
                                → {time}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
  setEditingGroup({
    id: g.id, // ensure id always exists
    name: g.name || "",
    description: g.description || "",
    schedule: g.schedule || {},
  })
}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteGroup(g)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96 animate-scaleIn">
            <h3 className="text-xl font-bold mb-4">{modal.title}</h3>
            <p className="mb-6">{modal.message}</p>
            <div className="flex justify-end gap-3">
              {modal.showCancel && (
                <button
                  onClick={modal.onCancel}
                  className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={modal.onConfirm}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default GroupsManagement;