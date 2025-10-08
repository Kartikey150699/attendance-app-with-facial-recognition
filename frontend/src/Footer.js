import { useNavigate } from "react-router-dom";

function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="w-full bg-blue-900 text-white mt-auto py-2 sm:py-3 px-3 sm:px-6 flex flex-col items-center gap-1.5 text-center">
      {/* Links */}
      <div className="flex flex-wrap justify-center gap-3 text-xs sm:text-sm">
        <div
          onClick={() => navigate("/privacy-policy")}
          className="underline cursor-pointer hover:text-gray-300 transition-transform duration-200"
        >
          Privacy Policy
        </div>
        <div
          onClick={() => navigate("/terms-and-conditions")}
          className="underline cursor-pointer hover:text-gray-300 transition-transform duration-200"
        >
          Terms & Conditions
        </div>
        <div
          onClick={() => navigate("/about-us")}
          className="underline cursor-pointer hover:text-gray-300 transition-transform duration-200"
        >
          About Us
        </div>
      </div>

      {/* Copyright */}
      <div className="text-[11px] sm:text-xs md:text-sm text-gray-200">
        © 2025 FaceTrack. All rights reserved — IFNET
      </div>
    </footer>
  );
}

export default Footer;