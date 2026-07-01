import { useState } from "react";
import { Plus, Filter, Eye, Edit2, Trash2 } from "lucide-react";

const INCIDENTS = [
  { id: "INC-2851", title: "Force Brute sur compte admin_prod", sev: "CRITICAL", status: "Ouvert",   src: "185.220.101.47",  target: "admin_prod@prod",  time: "14:58", assignee: "a.dupont" },
  { id: "INC-2850", title: "Élévation de privilèges détectée",  sev: "CRITICAL", status: "En cours", src: "10.10.5.23",       target: "svc_backup",        time: "14:51", assignee: "s.chen"   },
  { id: "INC-2849", title: "Scan de ports LAN interne",          sev: "HIGH",     status: "En cours", src: "10.10.8.102",      target: "Réseau 10.10/24",   time: "14:22", assignee: "a.dupont" },
  { id: "INC-2848", title: "Connexion depuis nœud TOR",          sev: "HIGH",     status: "Ouvert",   src: "185.107.47.215",   target: "j.bernard@rh",      time: "13:45", assignee: null        },
  { id: "INC-2847", title: "Exfiltration DNS suspecte",           sev: "HIGH",     status: "Résolu",   src: "10.10.3.77",       target: "dns.malc2.net",     time: "13:12", assignee: "l.santos"  },
  { id: "INC-2846", title: "Connexion hors horaires — Europe",    sev: "WARNING",  status: "Résolu",   src: "192.168.50.14",    target: "p.muller@eu",       time: "02:34", assignee: "s.chen"   },
  { id: "INC-2845", title: "Nouveau pays source — RH utilisateur",sev: "WARNING",  status: "Ouvert",   src: "41.214.100.30",    target: "m.legrand@rh",      time: "11:07", assignee: null        },
];

const SEV_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border border-red-500/30",
  HIGH:     "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  WARNING:  "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  INFO:     "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  LOW:      "bg-slate-500/15 text-slate-700 border border-slate-500/30",
};

function SevBadge({ s }: { s: string }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold tracking-widest ${SEV_STYLE[s] ?? SEV_STYLE.LOW}`}>
      {s}
    </span>
  );
}

const STATUS_DOT: Record<string, string> = {
  Actif:     "bg-emerald-400",
  Inactif:   "bg-slate-500",
  Ouvert:    "bg-red-400 animate-pulse",
  "En cours":"bg-orange-400 animate-pulse",
  Résolu:    "bg-emerald-400",
};
const STATUS_TEXT: Record<string, string> = {
  Actif:     "text-emerald-400",
  Inactif:   "text-slate-700",
  Ouvert:    "text-red-400",
  "En cours":"text-orange-400",
  Résolu:    "text-emerald-400",
};

function StatusPill({ s }: { s: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[s] ?? "bg-slate-500"}`} />
      <span className={`text-[11px] font-mono ${STATUS_TEXT[s] ?? "text-slate-700"}`}>{s}</span>
    </span>
  );
}

export default function IncidentsScreen() {
  const [filter, setFilter] = useState("Tous");
  const filters = ["Tous", "Ouvert", "En cours", "Résolu"];
  const rows = filter === "Tous" ? INCIDENTS : INCIDENTS.filter((i) => i.status === filter);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-secondary/60 rounded-lg p-0.5 gap-0.5">
          {filters.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[11px] font-mono rounded-md transition-all ${filter === f ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-lg transition-colors border border-border">
          <Filter className="w-3 h-3" /> Filtres avancés
        </button>
        <button className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-mono bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow">
          <Plus className="w-3.5 h-3.5" /> Créer un incident
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              {["ID", "Titre", "Criticité", "Statut", "Source IP", "Cible", "Assigné", "Heure", "Actions"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[10px] text-muted-foreground font-mono uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((inc) => {
              const borderLeft =
                inc.sev === "CRITICAL" && inc.status !== "Résolu" ? "border-l-2 border-l-red-500" :
                inc.sev === "HIGH"     && inc.status !== "Résolu" ? "border-l-2 border-l-orange-500" :
                "border-l-2 border-l-transparent";
              return (
                <tr key={inc.id} className={`border-b border-border/30 hover:bg-secondary/30 transition-colors ${borderLeft}`}>
                  <td className="px-4 py-3 text-[11px] font-mono text-blue-400 font-bold">{inc.id}</td>
                  <td className="px-4 py-3 text-xs text-foreground/90 max-w-50 truncate">{inc.title}</td>
                  <td className="px-4 py-3"><SevBadge s={inc.sev} /></td>
                  <td className="px-4 py-3"><StatusPill s={inc.status} /></td>
                  <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{inc.src}</td>
                  <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground max-w-30 truncate">{inc.target}</td>
                  <td className="px-4 py-3 text-[11px] font-mono">
                    {inc.assignee
                      ? <span className="text-cyan-400">{inc.assignee}</span>
                      : <span className="text-slate-700 italic">non assigné</span>}
                  </td>
                  <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{inc.time}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <button className="text-blue-400 hover:text-blue-300 transition-colors" title="Voir détail"><Eye className="w-3.5 h-3.5" /></button>
                      <button className="text-slate-500 hover:text-foreground transition-colors" title="Modifier"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button className="text-red-500/70 hover:text-red-400 transition-colors" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}