import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Home from "./Home";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";
import RegisterUser from "./RegisterUser";
import ManageAdmin from "./ManageAdmin";
import ManageUsers from "./ManageUsers";
import ChangePassword from "./ChangePassword";
import PrivacyPolicy from "./PrivacyPolicy";
import TermsAndConditions from "./TermsAndConditions";
import WorkApplication from "./WorkApplication";
import WorkApplicationLogin from "./WorkApplicationLogin";
import AttendanceLogs from "./AttendanceLogs";

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Home */}
        <Route
          path="/"
          element={
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.4 }}
            >
              <Home />
            </motion.div>
          }
        />

        {/* Admin Login */}
        <Route
          path="/admin-login"
          element={
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4 }}
            >
              <AdminLogin />
            </motion.div>
          }
        />

        {/* Admin Dashboard */}
        <Route
          path="/admin-dashboard"
          element={
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
            >
              <AdminDashboard />
            </motion.div>
          }
        />

        {/* Register User */}
        <Route
          path="/register-user"
          element={
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.4 }}
            >
              <RegisterUser />
            </motion.div>
          }
        />

        {/* Manage Admin */}
        <Route
          path="/manage-admin"
          element={
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.4 }}
            >
              <ManageAdmin />
            </motion.div>
          }
        />

        {/* Manage Users */}
        <Route
          path="/manage-users"
          element={
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ duration: 0.4 }}
            >
              <ManageUsers />
            </motion.div>
          }
        />

        {/* Change Password */}
        <Route
          path="/change-password"
          element={
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              <ChangePassword />
            </motion.div>
          }
        />

        {/* Privacy Policy */}
        <Route
          path="/privacy-policy"
          element={
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4 }}
            >
              <PrivacyPolicy />
            </motion.div>
          }
        />

        {/* Terms & Conditions */}
        <Route
          path="/terms-and-conditions"
          element={
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.4 }}
            >
              <TermsAndConditions />
            </motion.div>
          }
        />

        {/* Work Application */}
        <Route
          path="/work-application"
          element={
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.4 }}
            >
              <WorkApplication />
            </motion.div>
          }
        />

        {/* Work Application Login */}
        <Route
          path="/work-application-login"
          element={
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.4 }}
            >
              <WorkApplicationLogin />
            </motion.div>
          }
        />

        {/* Attendance Logs */}
        <Route
          path="/attendance-logs"
          element={
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.4 }}
            >
              <AttendanceLogs />
            </motion.div>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <Router>
      <AnimatedRoutes />
    </Router>
  );
}

export default App;