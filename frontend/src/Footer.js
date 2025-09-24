import { useNavigate } from "react-router-dom";

function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="w-full py-4 bg-blue-900 text-xl text-white mt-auto flex items-center justify-between px-10 relative">
      {/* Left side links */}
      <div className="flex gap-6">
        <div
          onClick={() => navigate("/privacy-policy")}
          className="underline cursor-pointer hover:text-gray-300 hover:scale-105 transition-transform duration-200"
        >
          Privacy Policy
        </div>
        <div
          onClick={() => navigate("/terms-and-conditions")}
          className="underline cursor-pointer hover:text-gray-300 hover:scale-105 transition-transform duration-200"
        >
          Terms & Conditions
        </div>
      </div>

      {/* Centered Copyright */}
      <div className="absolute left-1/2 transform -translate-x-1/2 text-center whitespace-nowrap">
        © 2025 FaceTrack. All rights reserved - Kartikey Koli - IFNET
      </div>

      {/* Right side link */}
      <div
        onClick={() => navigate("/about-us")}
        className="underline cursor-pointer hover:text-gray-300 hover:scale-105 transition-transform duration-200"
      >
        About Us
      </div>
    </footer>
  );
}

export default Footer;