import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowUturnLeftIcon, ClipboardDocumentListIcon } from "@heroicons/react/24/solid";
import Footer from "./Footer";
import HeaderDateTime from "./HeaderDateTime"; 

function WorkApplication() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = location.state?.user || "Guest";

  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-gray-100 via-indigo-100 to-blue-200">
      {/* Header */}
      <div className="w-full flex items-center justify-center px-10 py-4 bg-indigo-300 shadow-md relative">
        {/* Date & Time */}
        <div className="absolute left-10 text-blue-800 text-xl font-bold">
          <HeaderDateTime />
        </div>

        {/* Title */}
        <h1
          onClick={() => navigate("/")}
          className="text-5xl font-bold text-blue-900 cursor-pointer hover:text-blue-700 transition-colors"
        >
          FaceTrack Attendance
        </h1>

        {/* Back Button */}
        <div className="absolute right-10">
          <button
            onClick={() => navigate(-1)}
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 
                       transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <ArrowUturnLeftIcon className="h-5 w-5 text-white" />
            Back
          </button>
        </div>
      </div>

      {/* Page Title Below Header */}
      <div className="flex flex-col items-center py-10">
        <h2 className="text-3xl font-bold text-indigo-700 mb-10 flex items-center gap-2">
          <ClipboardDocumentListIcon className="h-8 w-8 text-indigo-700" />
          Work Application
        </h2>
      </div>

      {/* Centered Content */}
      <div className="flex-grow flex flex-col items-center justify-center text-center px-6">
        <h2 className="text-4xl font-bold text-indigo-700 mb-4 -mt-40">
          Welcome {user}
        </h2>
        <p className="text-lg text-gray-600">
          You are now logged in to the Work Application module.
        </p>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default WorkApplication;