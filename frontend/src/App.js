import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Home from "./Home";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";
import RegisterUser from "./RegisterUser";
import ManageAdmin from "./ManageAdmin";
import ManageUsers from "./ManageUsers";
import ChangePassword from "./ChangePassword";

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
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
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/register-user" element={<RegisterUser />} />
        <Route path="/manage-admin" element={<ManageAdmin />} />
        <Route path="/manage-users" element={<ManageUsers />} />
        <Route path="/change-password" element={<ChangePassword />} />
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
