import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { XMarkIcon } from "@heroicons/react/24/solid";
import HeaderDateTime from "./HeaderDateTime"; 

function TermsAndConditions() {
  const [dateTime, setDateTime] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-800 leading-relaxed">
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
      </div>

      {/* Content */}
      <div className="flex-grow p-10 max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-indigo-700 mb-6 text-center">
          Terms & Conditions
        </h1>

        <p className="mb-4">
          These Terms and Conditions ("Terms") govern your use of the{" "}
          <strong>FaceTrack Attendance</strong> system. By accessing or using
          this system, you agree to abide by these Terms. Please read them
          carefully.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">1. Authorized Use</h2>
        <p className="mb-4">
          The FaceTrack Attendance system is intended solely for employee
          attendance tracking within authorized organizations. Unauthorized use,
          reproduction, or distribution of this system is strictly prohibited.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">2. User Responsibilities</h2>
        <ul className="list-disc pl-6 mb-4">
          <li>
            Users must provide accurate personal information (name, department,
            etc.) during registration.
          </li>
          <li>
            Users are responsible for maintaining the confidentiality of their
            login credentials.
          </li>
          <li>
            Misuse of the system, including attempts to tamper with or bypass
            security, is prohibited.
          </li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-2">3. Data Collection</h2>
        <p className="mb-4">
          Biometric data and attendance logs are collected exclusively for
          attendance management.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">4. Limitations</h2>
        <p className="mb-4">
          We do not guarantee uninterrupted or error-free operation of the
          system. The company is not liable for any damages caused by misuse,
          unauthorized access, or unforeseen technical issues.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">
          5. Intellectual Property
        </h2>
        <p className="mb-4">
          All content, code, and design elements of FaceTrack Attendance are the
          intellectual property of the developer and/or deploying organization.
          Copying or redistribution without prior consent is strictly illegal.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">6. Legal Disclaimer</h2>
        <p className="mb-4 text-red-600 font-semibold">
          Unauthorized reproduction, distribution, or modification of this
          system or its policies without prior written consent from FaceTrack is
          strictly prohibited and may result in legal action.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">7. Amendments</h2>
        <p className="mb-4">
          These Terms may be updated or revised periodically. Continued use of
          the system after changes indicates acceptance of the updated Terms.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">8. Governing Law</h2>
        <p className="mb-4">
          These Terms shall be governed by and construed in accordance with the
          applicable laws of the country where the system is deployed.
        </p>

        {/* Close Button */}
        <div className="flex justify-center mt-8">
          <button
            onClick={() => navigate(-1)}
            className="w-40 px-6 py-3 bg-red-500 hover:bg-red-600 hover:scale-105 active:scale-95 transition-transform duration-200 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2"
          >
            <XMarkIcon className="h-5 w-5 text-white" />
            Close
          </button>
        </div>

        {/* Footer */}
                {/* Footer */}
        <footer className="mt-6 text-sm text-gray-500 flex items-center justify-center relative">
          <div className="absolute left-0">
            Last updated: 14 Sept 2024
          </div>
          <div>
            © 2025 FaceTrack. All rights reserved - Kartikey Koli - IFNET
          </div>
        </footer>
      </div>
    </div>
  );
}

export default TermsAndConditions;