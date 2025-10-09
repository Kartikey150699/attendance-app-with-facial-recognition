import { useNavigate } from "react-router-dom";
import { XMarkIcon } from "@heroicons/react/24/solid";
import HeaderDateTime from "./HeaderDateTime"; 

function PrivacyPolicy() {

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
<div className="text-center text-sm sm:text-base md:text-lg font-semibold text-white tracking-wide drop-shadow-md mt-3 sm:mt-0 flex-shrink-0">
  <HeaderDateTime />
</div>
  </div>
</header>

      {/* Content */}
      <div className="flex-grow p-6 sm:p-10 max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-indigo-700 mb-6 text-center">
          Privacy Policy
        </h1>

        <p className="mb-4">
          At <strong>FaceTrack Attendance</strong>, we respect your privacy and
          are committed to protecting your personal data. This Privacy Policy
          outlines how we collect, use, and safeguard information when you use
          our services. By using our system, you agree to the practices
          described in this policy.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">1. Information We Collect</h2>
        <ul className="list-disc pl-6 mb-4 text-left">
          <li>Biometric data (face recognition images and embeddings)</li>
          <li>Basic information: Name, Department, Employee ID</li>
          <li>Attendance logs (Check-in, Breaks, Check-out timestamps)</li>
          <li>Device and technical information (IP, browser type, OS)</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-2">2. How We Use Your Information</h2>
        <ul className="list-disc pl-6 mb-4 text-left">
          <li>Accurately marking employee attendance</li>
          <li>Generating attendance reports and analytics</li>
          <li>Ensuring compliance with company HR policies</li>
          <li>Enhancing security by preventing unauthorized access</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-2">3. Data Storage & Retention</h2>
        <p className="mb-4">
          All biometric and personal data is stored securely in encrypted
          databases. Attendance logs are retained for as long as necessary for
          HR compliance and legal requirements.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">4. Data Security</h2>
        <ul className="list-disc pl-6 mb-4 text-left">
          <li>Encryption of biometric templates and logs</li>
          <li>Restricted access for authorized administrators only</li>
          <li>Regular audits and monitoring for unusual activity</li>
          <li>Secure network protocols for communication</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-2">5. Sharing of Data</h2>
        <p className="mb-4">
          We do <strong>not</strong> sell or share personal data with third
          parties. Data may only be shared under the following conditions:
        </p>
        <ul className="list-disc pl-6 mb-4 text-left">
          <li>When required by law or government authorities</li>
          <li>With HR/Admins for internal workforce management</li>
          <li>
            With trusted service providers (e.g., cloud hosting) under strict
            agreements
          </li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-2">6. Employee Rights</h2>
        <ul className="list-disc pl-6 mb-4 text-left">
          <li>Access their attendance records</li>
          <li>Request correction of inaccurate personal data</li>
          <li>Request deletion of data (where legally possible)</li>
          <li>Opt-out of non-essential data collection</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-2">7. Cookies & Tracking</h2>
        <p className="mb-4">
          Our system may use cookies or similar technologies to improve user
          experience and security. These are not used for marketing or
          third-party advertising.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">8. International Compliance</h2>
        <p className="mb-4">
          FaceTrack Attendance follows applicable privacy regulations including
          GDPR, CCPA, and local employment laws.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">9. Changes to Policy</h2>
        <p className="mb-4">
          We may update this Privacy Policy from time to time. Updates will be
          posted here with a revised date.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">10. Contact Us</h2>
        <p className="mb-4">
          For questions or requests regarding this Privacy Policy, please
          contact the HR/Admin team.
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

export default PrivacyPolicy;