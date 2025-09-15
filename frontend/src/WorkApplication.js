import { useLocation, useNavigate } from "react-router-dom";

function WorkApplication() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = location.state?.user || "Guest";

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <div className="w-full flex items-center justify-between px-10 py-4 bg-indigo-300 shadow-md">
        <h1 className="text-3xl font-bold text-blue-900">Work Application</h1>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg shadow"
        >
          Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-grow flex flex-col items-center justify-center">
        <h2 className="text-4xl font-bold text-indigo-700 mb-4">
          Welcome {user}
        </h2>
        <p className="text-lg text-gray-600">
          You are now logged in to the Work Application module.
        </p>
      </div>

      {/* Footer */}
      <footer className="mt-6 text-sm text-gray-500 text-center">
        © 2025 FaceTrack. All rights reserved - Kartikey Koli - IFNET
      </footer>
    </div>
  );
}

export default WorkApplication;