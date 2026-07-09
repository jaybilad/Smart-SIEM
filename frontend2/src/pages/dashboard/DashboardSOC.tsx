import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logoImage from '../../assets/logo.png';
import {
  LayoutDashboard, AlertTriangle, Search, BookOpen,
  Bell, RefreshCw, Activity, Lock, LogOut,
} from "lucide-react";
import { clearSession, getStoredUser } from "../../api/auth";
import { socApi } from "../../api/soc";
import SOCDashboardScreen from "../../components/soc-screens/SOCDashboardScreen";
import SOCIncidentsScreen from "../../components/soc-screens/SOCIncidentScreen";
import SOCSearchScreen from "../../components/soc-screens/SOCSearchScreen";
import SOCSOARScreen from "../../components/soc-screens/SOCSOARScreen";

type Screen = "dashboard" | "incidents" | "search" | "soar";

const SCREEN_META: Record<Screen, { title: string; sub: string }> = {
  dashboard: { title: "Vue d'ensemble",              sub: "Tableaux de bord temps réel" },
  incidents: { title: "Gestion des Incidents",       sub: "File d'alertes & investigation détaillée" },
  search:    { title: "Moteur de Recherche & Logs",  sub: "L'espace détective — Investigation forensique" },
  soar:      { title: "Catalogue SOAR",              sub: "Playbooks de réponse disponibles — Exécution auditée" },
};

export default function SOCDashboard() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [shellStats, setShellStats] = useState({ active: 0, critical: 0, ingestion: 0 });
  const { title, sub } = SCREEN_META[screen];
  const navigate = useNavigate();
  const user = getStoredUser();
  const initials = (user?.username ?? "SO")
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "SO";

  const handleLogout = () => {
    clearSession();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    socApi.dashboard()
      .then((data) => {
        setShellStats({
          active: data.stats.active_incidents,
          critical: data.stats.critical_incidents,
          ingestion: data.stats.ingestion_rate,
        });
      })
      .catch(() => setShellStats({ active: 0, critical: 0, ingestion: 0 }));
  }, []);

  const NAV = [
    { id: "dashboard" as Screen, label: "Vue d'ensemble",               icon: LayoutDashboard },
    { id: "incidents" as Screen, label: "Gestion des Incidents",        icon: AlertTriangle   },
    { id: "search"    as Screen, label: "Moteur de Recherche & Logs",   icon: Search          },
    { id: "soar"      as Screen, label: "Catalogue SOAR",               icon: BookOpen        },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── SIDEBAR ── */}
      <aside className="w-56 shrink-0 flex flex-col bg-[#080c18] border-r border-[#1a2540]">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-[#1a2540]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-900/40 overflow-hidden">
              <img 
                src={logoImage} 
                alt="Smart SIEM Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-sm font-bold text-white tracking-tight leading-tight">Smart SIEM</p>
              <p className="text-[9px] text-blue-400 font-mono">v4.2.1 — Production</p>
            </div>
          </div>
        </div>

        {/* Analyst identity */}
        <div className="px-3 py-2.5 border-b border-[#1a2540]">
          <div className="flex items-center gap-2.5 bg-blue-500/8 border border-blue-500/20 rounded-xl px-3 py-2.5">
            <div className="w-7 h-7 rounded-full bg-linear-to-br from-blue-600 to-blue-800 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-white leading-tight">{user?.username ?? "analyste"}</p>
              <p className="text-[9px] font-mono text-blue-400">{user?.role ?? "Analyste"} - {user?.scope ?? "SOC"}</p>
            </div>
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="En ligne" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5">
          {NAV.map(({ id, label, icon: Icon }) => {
            const isActive = screen === id;
            return (
              <button key={id} onClick={() => setScreen(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-blue-600/20 text-blue-300 border border-blue-500/20 shadow-inner"
                    : "text-slate-700 hover:text-white hover:bg-white/4"
                }`}>
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-blue-400" : ""}`} />
                <span className="text-[12px] font-medium">{label}</span>
                {id === "incidents" && (
                  <span className="ml-auto text-[9px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 rounded">
                    {shellStats.active}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Perimeter badge */}
        <div className="px-3 pb-2">
          <div className="bg-blue-500/8 border border-blue-500/15 rounded-xl px-3 py-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">Périmètre assigné</p>
            <p className="text-[11px] font-mono text-blue-300 font-semibold">{user?.scope ?? "SOC"}</p>
          </div>
        </div>

        {/* Status footer */}
        <div className="px-4 py-3 border-t border-[#1a2540] space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Système opérationnel
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-700">
            <Activity className="w-3 h-3" />
            {shellStats.ingestion} logs/s - Elasticsearch
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="m-2.5 px-3 py-2 border border-[#1a2540] rounded-lg text-muted-foreground hover:text-blue-300 text-xs font-mono flex items-center gap-2 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Déconnexion
        </button>
      </aside>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-13 shrink-0 flex items-center justify-between px-5 border-b border-[#1a2540] bg-[#080c18]/90 backdrop-blur">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">{title}</h1>
            <p className="text-[10px] text-slate-700 font-mono truncate">{sub}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <span className="text-[10px] font-mono text-slate-600 hidden xl:block">PostgreSQL local + Elasticsearch Docker</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg text-[10px] font-mono text-orange-400">
              <AlertTriangle className="w-3 h-3" />
              {shellStats.critical} CRITIQUE
            </div>
            <button className="relative p-1.5 text-slate-400 hover:text-white transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full text-[8px] flex items-center justify-center text-white font-bold">{shellStats.active}</span>
            </button>
            <button className="p-1.5 text-slate-600 hover:text-slate-400 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
        </header>

        {/* Screen content */}
        <main className="flex-1 overflow-y-auto">
          {screen === "dashboard" && <SOCDashboardScreen />}
          {screen === "incidents" && <SOCIncidentsScreen />}
          {screen === "search"    && <SOCSearchScreen />}
          {screen === "soar"      && <SOCSOARScreen />}
        </main>
      </div>

      {/* Audit trail notice */}
      <div className="fixed bottom-0 left-56 right-0 h-6 bg-[#060a12]/95 border-t border-[#1a2540] backdrop-blur-sm flex items-center px-4 z-30">
        <Lock className="w-2.5 h-2.5 text-slate-700 mr-2 shrink-0" />
        <span className="text-[9px] font-mono text-slate-700">
          Toutes vos actions sont journalisées de manière permanente dans l'audit log SIEM - {user?.username ?? "analyste"} - {user?.scope ?? "SOC"}
        </span>
      </div>
    </div>
  );
}
