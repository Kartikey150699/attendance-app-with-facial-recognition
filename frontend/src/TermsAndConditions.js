import { useNavigate } from "react-router-dom";
import { XMarkIcon } from "@heroicons/react/24/solid";
import HeaderDateTime from "./HeaderDateTime"; 

function TermsAndConditions() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-800 leading-relaxed">
      {/* Header */}
{/* Midnight Glass Header */}
<header className="relative w-full bg-gradient-to-r from-slate-800 via-gray-800 to-slate-900 text-white shadow-xl overflow-hidden border-b border-gray-700/30">
  {/* Frosted glass overlay */}
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

    {/* Right: Date & Time */}
    <div className="text-center text-sm sm:text-base md:text-lg font-semibold text-white tracking-wide drop-shadow-md mt-3 sm:mt-0">
      <HeaderDateTime />
    </div>
  </div>
</header>

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

 {/* Copyright */}
<footer className="mt-6 text-sm text-gray-500 flex items-center justify-center relative px-4">
  {/* Desktop (Mac/laptop) version */}
  <div className="hidden sm:block absolute left-0 text-gray-400">
    Last updated: 28 Sept 2024
  </div>
  <div className="hidden sm:block">
    © 2025 FaceTrack. All rights reserved - Kartikey Koli - IFNET
  </div>

  {/* Mobile & iPad version */}
  <div className="flex flex-col sm:hidden items-center text-center gap-1">
    <div className="text-gray-400">Last updated: 28 Sept 2024</div>
    <div>© 2025 FaceTrack. All rights reserved - IFNET</div>
  </div>
</footer>
      </div>
    </div>
  );
}

export default TermsAndConditions;