import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, RefreshCw, Eye, Lock, LayoutDashboard, AlertTriangle, Search, Brain } from "lucide-react";
import { clearSession, getStoredUser } from "../../api/auth";
import LecteurDashboardScreen from "../../components/lecteur-screens/LecteurDashboardScreen";
import LecteurIncidentScreen from "../../components/lecteur-screens/LecteurIncidentScreen";
import LecteurSearchScreen from "../../components/lecteur-screens/LecteurSearchScreen";
import LecteurUEBAScreen from "../../components/lecteur-screens/LecteurUEBAScreen";
import logoImage from '../../assets/logo.png';

type Screen = "dashboard" | "incidents" | "search" | "ueba";

const NAV = [
  { id: "dashboard" as Screen, label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: "incidents" as Screen, label: "Suivi des Incidents", icon: AlertTriangle },
  { id: "search" as Screen, label: "Moteur de Recherche", icon: Search },
  { id: "ueba" as Screen, label: "Analyse Comportementale", icon: Brain },
];

const SCREEN_META: Record<Screen, { title: string; sub: string }> = {
  dashboard: { title: "Vue d'ensemble & Reporting", sub: "Tableaux de bord analytiques — Audit & Conformité — Lecture seule" },
  incidents: { title: "Suivi des Incidents", sub: "File d'alertes en lecture seule — Aucune modification disponible (403)" },
  search: { title: "Moteur de Recherche", sub: "Consultation de l'historique des logs — Marquage désactivé (403)" },
  ueba: { title: "Analyse Comportementale — UEBA", sub: "Scoring de risque & anomalies détectées — Consultation uniquement" },
};

export default function LecteurDashboard() {
  const [currentPage, setCurrentPage] = useState<Screen>("dashboard");
  const navigate = useNavigate();
  const { title, sub } = SCREEN_META[currentPage];
  const user = getStoredUser();
  const initials = (user?.username ?? "LE")
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "LE";

  const handleLogout = () => {
    clearSession();
    navigate("/", { replace: true });
  };

  const renderPageContent = () => {
    switch (currentPage) {
      case "dashboard":
        return <LecteurDashboardScreen />;
      case "incidents":
        return <LecteurIncidentScreen />;
      case "search":
        return <LecteurSearchScreen />;
      case "ueba":
        return <LecteurUEBAScreen />;
      default:
        return <LecteurDashboardScreen />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── SIDEBAR ── */}
      <aside className="w-56 shrink-0 flex flex-col bg-[#080c18] border-r border-[#1a2540]">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-[#1a2540]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-lg">
              {logoImage ? <img src={logoImage} alt="Logo" className="w-full h-full object-cover" /> : null}
            </div>
            <div>
              <p className="text-sm font-bold text-white tracking-tight leading-tight">Smart SIEM</p>
              <p className="text-[9px] text-slate-700 font-mono">v4.2.1 — Production</p>
            </div>
          </div>
        </div>

        {/* User identity + audit notice */}
        <div className="px-3 py-2.5 border-b border-[#1a2540]">
          <div className="flex flex-col gap-2.5 bg-amber-500/6 border border-amber-500/15 rounded-xl px-3 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-linear-to-br from-amber-700 to-amber-900 flex items-center justify-center text-[10px] font-bold text-amber-200 shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-mono text-white leading-tight">{user?.username ?? "lecteur"}</p>
                <p className="text-[9px] font-mono text-amber-400/80">Lecteur - {user?.scope ?? "Audit"}</p>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="En ligne" />
            </div>
            <div className="border-t border-amber-500/10 pt-2">
              <p className="text-[8.5px] font-mono text-amber-600/70 leading-relaxed">
                Session auditée de manière transparente. Toutes vos actions de consultation d'alertes, requêtes de recherche et connexions/déconnexions sont enregistrées en temps réel dans le journal d'audit du SIEM.
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5">
          {NAV.map(({ id, label, icon: Icon }) => {
            const isActive = currentPage === id;
            return (
              <button
                key={id}
                onClick={() => setCurrentPage(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-amber-600/15 text-amber-200 border border-amber-500/20"
                    : "text-slate-700 hover:text-white hover:bg-white/4"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-amber-400" : ""}`} />
                <span className="text-[12px] font-medium">{label}</span>
              </button>
            );
          })}

          {/* Restricted section */}
          <div className="pt-2 mt-1 border-t border-[#1a2540]">
            <p className="px-3 py-1 text-[9px] font-mono text-slate-700 uppercase tracking-widest">Accès refusé (403)</p>
            {["Paramètres Système", "Règles de Corrélation", "Gestion des Utilisateurs"].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-700 cursor-not-allowed select-none"
                title={`403 — Droits insuffisants — "${item}" nécessite le rôle Administrateur`}
              >
                <Lock className="w-3 h-3 shrink-0 opacity-50" />
                <span className="text-[11px] line-through decoration-slate-700 opacity-50">{item}</span>
              </div>
            ))}
          </div>
        </nav>

        {/* Perimeter */}
        <div className="px-3 pb-2">
          <div className="bg-slate-500/6 border border-slate-700/30 rounded-xl px-3 py-2">
            <p className="text-[9px] font-mono text-slate-600 uppercase tracking-wider mb-0.5">Périmètre restreint</p>
            <p className="text-[11px] font-mono text-amber-300/70 font-semibold">{user?.scope ?? "Audit & Conformite"}</p>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[#1a2540] space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connexion sécurisée — TLS 1.3
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-700">
            <Eye className="w-3 h-3" />
            Session enregistrée en temps réel
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="m-2.5 px-3 py-2 border border-[#1a2540] rounded-lg text-muted-foreground hover:text-amber-400 text-xs font-mono flex items-center gap-2 transition-colors"
        >
          Déconnexion
        </button>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-13 shrink-0 flex items-center justify-between px-5 border-b border-[#1a2540] bg-[#080c18]/90 backdrop-blur">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-white truncate">{title}</h1>
              <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-600 border border-slate-800 rounded px-1.5 py-0.5 select-none shrink-0">
                <Lock className="w-2.5 h-2.5" /> LECTURE SEULE
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono truncate">{sub}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <span className="text-[10px] font-mono text-slate-600 hidden xl:block">PostgreSQL local + Elasticsearch Docker</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] font-mono text-amber-400">
              <Lock className="w-3 h-3" />
              LECTURE SEULE
            </div>
            <div className="relative p-1.5 text-slate-600 cursor-not-allowed" title="Notifications désactivées — Rôle Lecteur (403)">
              <Bell className="w-4 h-4" />
              <Lock className="w-2 h-2 text-slate-700 absolute -bottom-0.5 -right-0.5" />
            </div>
            <button className="p-1.5 text-slate-600 hover:text-slate-400 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {renderPageContent()}
        </main>
      </div>

      {/* Persistent audit compliance bar */}
      <div className="fixed bottom-0 left-56 right-0 h-7 bg-[#060a12]/95 border-t border-amber-500/15 backdrop-blur-sm flex items-center px-4 z-30 gap-2">
        <Eye className="w-3 h-3 text-amber-600/80 shrink-0" />
        <span className="text-[9px] font-mono text-amber-600/70 leading-none">
          Session auditée de manière transparente. Toutes vos actions de consultation d'alertes, requêtes de recherche et connexions/déconnexions sont enregistrées en temps réel dans le journal d'audit du SIEM.
        </span>
        <span className="ml-auto text-[9px] font-mono text-slate-700 shrink-0 hidden lg:block">
          {user?.username ?? "lecteur"} - Lecteur - {user?.scope ?? "Audit"}
        </span>
      </div>
    </div>
  );
}
