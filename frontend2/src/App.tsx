import type { ReactElement } from "react";
import { BrowserRouter as Router, Navigate, Routes, Route } from "react-router-dom";
import Login from "./pages/login";
import AdminDashboard from './pages/dashboard/DashboardAdmin';
import SOCDashboard from './pages/dashboard/DashboardSOC';
import LecteurDashboard from './pages/dashboard/DashboardLecteur';
import { getDashboardPath, getStoredUser, isSessionValid, type UserRole } from "./api/auth";

function ProtectedRoute({ roles, children }: { roles: UserRole[]; children: ReactElement }) {
  const user = getStoredUser();

  if (!isSessionValid() || !user) {
    return <Navigate to="/" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return children;
}

function LoginRoute() {
  const user = getStoredUser();
  if (isSessionValid() && user) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }
  return <Login />;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginRoute />} />
        <Route path="/dashboard-admin" element={<ProtectedRoute roles={["Admin"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/dashboard-soc" element={<ProtectedRoute roles={["Admin", "Analyste"]}><SOCDashboard /></ProtectedRoute>} />
        <Route path="/dashboard-lecteur" element={<ProtectedRoute roles={["Admin", "Analyste", "Lecteur"]}><LecteurDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
