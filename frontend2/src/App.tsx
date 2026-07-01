import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/login";
import AdminDashboard from './pages/dashboard/DashboardAdmin';
import SOCDashboard from './pages/dashboard/DashboardSOC';
import LecteurDashboard from './pages/dashboard/DashboardLecteur';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Page de connexion */}
        <Route path="/" element={<Login />} />
        <Route path="/dashboard-admin" element={<AdminDashboard />} />
        <Route path="/dashboard-soc" element={<SOCDashboard />} />
        <Route path="/dashboard-lecteur" element={<LecteurDashboard />} />
      </Routes>
    </Router>
  );
}