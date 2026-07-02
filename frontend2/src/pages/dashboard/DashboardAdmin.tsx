import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, ChevronDown, ChevronRight, LogOut, Zap, BarChart3, AlertTriangle, Search, Activity, Users, Zap as ZapIcon, Server } from "lucide-react";
import { clearSession, getStoredUser } from "../../api/auth";
import { adminApi } from "../../api/admin";
import DashboardScreen from "../../components/admin-screens/AdminDashboardScreen";
import IncidentsScreen from "../../components/admin-screens/AdminIncidentScreen";
import SearchScreen from "../../components/admin-screens/AdminSearchScreen";
import UEBAScreen from "../../components/admin-screens/AdminUEBAScreen";
import UsersScreen from "../../components/admin-screens/AdminUsersScreen";
import RulesScreen from "../../components/admin-screens/AdminRulesScreen";
import InfraScreen from "../../components/admin-screens/AdminInfraScreen";
import "../../components/admin-screens/AdminDashboard.css";
import logoImage from '../../assets/logo.png';  


type Screen = "dashboard" | "incidents" | "search" | "ueba" | "users" | "rules" | "infra";

const NAV = [
  { id: "dashboard" as Screen, label: "Vue d'ensemble", icon: BarChart3 },
  { id: "incidents" as Screen, label: "Gestion des Incidents", icon: AlertTriangle },
  { id: "search" as Screen, label: "Moteur de Recherche", icon: Search },
  { id: "ueba" as Screen, label: "Analyse Comportementale", icon: Activity },
];

const SETTINGS_NAV = [
  { id: "users" as Screen, label: "Gestion des Utilisateurs", icon: Users },
  { id: "rules" as Screen, label: "Règles de Corrélation", icon: ZapIcon },
  { id: "infra" as Screen, label: "Infrastructure & Maintenance", icon: Server },
];

export default function AdminDashboard() {
  const [currentPage, setCurrentPage] = useState<Screen>("dashboard");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ingestionRate, setIngestionRate] = useState<number | null>(null);
  const navigate = useNavigate();
  const user = getStoredUser();
  const initials = (user?.username ?? "AD")
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AD";

  useEffect(() => {
    adminApi.dashboard()
      .then((d) => setIngestionRate(d.stats.ingestion_rate))
      .catch(() => setIngestionRate(null));
  }, []);

  const isSettings = ["users", "rules", "infra"].includes(currentPage);

  const handleLogout = () => {
    clearSession();
    navigate("/", { replace: true });
  };

  const renderPageContent = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardScreen />;
      case "incidents":
        return <IncidentsScreen />;
      case "search":
        return <SearchScreen />;
      case "ueba":
        return <UEBAScreen />;
      case "users":
        return <UsersScreen />;
      case "rules":
        return <RulesScreen />;
      case "infra":
        return <InfraScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0e18] overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-57 shrink-0 flex flex-col bg-[#080c18] border-r border-[#1a2540]">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-[#1a2540]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg">
              <img src={logoImage} alt="Smart SIEM Logo" className="w-full h-full object-cover"/>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">Smart SIEM</p>
              <p className="text-[9px] text-blue-400 font-mono">v4.2.1 — Production</p>
            </div>
          </div>
        </div>

        {/* Admin badge */}
        <div className="px-3 py-2.5 border-b border-[#1a2540]">
          <div className="flex items-center gap-2.5 bg-violet-500/8 border border-violet-500/20 rounded-xl px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-linear-to-br from-violet-600 to-violet-800 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-white leading-tight">{user?.username ?? "admin"}</p>
              <p className="text-[9px] font-mono text-violet-400">Administrateur - {user?.scope ?? "Global"}</p>
            </div>
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-2.5 space-y-0.5 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setCurrentPage(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all text-[12px] font-medium ${
                currentPage === id
                  ? "bg-blue-600/20 text-blue-300 border border-blue-500/20"
                  : "text-slate-700 hover:text-slate-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </button>
          ))}

          <div className="pt-1">
            <p className="px-3 py-1.5 text-[9px] font-mono text-slate-600 uppercase tracking-widest">Admin exclusif</p>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all text-[12px] font-medium ${
                isSettings
                  ? "bg-blue-600/20 text-blue-300 border border-blue-500/20"
                  : "text-slate-700 hover:text-slate-100"
              }`}
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">Paramètres Système</span>
              {settingsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>

            {settingsOpen && (
              <div className="ml-2.5 mt-0.5 pl-3 border-l border-[#1a2540] space-y-0.5">
                {SETTINGS_NAV.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setCurrentPage(id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all text-[11px] ${
                      currentPage === id
                        ? "bg-violet-600/20 text-violet-300 border border-violet-500/20"
                        : "text-slate-700 hover:text-slate-100"
                    }`}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#1a2540] space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Système opérationnel
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-700">
            <Zap className="w-3 h-3" />
            {ingestionRate !== null
              ? `${ingestionRate.toLocaleString("fr-FR")} logs/s — PostgreSQL`
              : "Débit ingestion indisponible"}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="m-2.5 px-3 py-2 border border-[#1a2540] rounded-lg text-muted-foreground hover:text-red-400 text-xs font-mono flex items-center gap-2 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Déconnexion
        </button>
      </aside>

      {/* CONTENU */}
      <main className="flex-1 overflow-y-auto">
        {renderPageContent()}
      </main>
    </div>
  );
}
