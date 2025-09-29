import { useNavigate } from "react-router-dom";
import { XMarkIcon } from "@heroicons/react/24/solid";
import HeaderDateTime from "./HeaderDateTime"; 

function PrivacyPolicy() {

  const navigate = useNavigate();


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

export default PrivacyPolicy;