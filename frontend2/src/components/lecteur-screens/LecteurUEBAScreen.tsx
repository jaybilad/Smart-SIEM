import { useState } from "react";
import { Lock, Clock, TrendingUp, Globe, AlertCircle, Wifi, Download } from "lucide-react";

const UEBA_USERS = [
  { user: "k.ibrahim", score: 94, dept: "Filiale EU", machine: "WS-EU-088", last: "14:47", anomalies: ["download-massif", "acces-prod"] },
  { user: "j.bernard", score: 72, dept: "Filiale EU", machine: "WS-EU-047", last: "13:45", anomalies: ["nouveau-pays", "hors-horaires"] },
  { user: "t.werner", score: 61, dept: "Filiale EU", machine: "WS-EU-031", last: "09:30", anomalies: ["acces-prod"] },
  { user: "p.muller", score: 45, dept: "Filiale EU", machine: "WS-EU-023", last: "02:34", anomalies: ["hors-horaires"] },
  { user: "m.legrand", score: 38, dept: "RH", machine: "WS-RH-011", last: "11:07", anomalies: ["nouveau-pays"] },
  { user: "s.lemaire", score: 33, dept: "Filiale EU", machine: "cloud-O365-EU", last: "08:55", anomalies: ["auth-cloud"] },
  { user: "a.dupont", score: 12, dept: "Filiale EU", machine: "WS-EU-044", last: "11:15", anomalies: [] },
];

const ANOMALY_META: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  "hors-horaires": {
    label: "Connexion hors horaires habituels",
    icon: Clock,
    cls: "bg-yellow-500/12 text-yellow-400 border border-yellow-500/25",
  },
  "volume-transfert": {
    label: "Volume de transfert inhabituel",
    icon: TrendingUp,
    cls: "bg-orange-500/12 text-orange-400 border border-orange-500/25",
  },
  "nouveau-pays": {
    label: "Nouveau pays source",
    icon: Globe,
    cls: "bg-red-500/12 text-red-400 border border-red-500/25",
  },
  "acces-prod": {
    label: "Accès hors périmètre",
    icon: AlertCircle,
    cls: "bg-orange-500/12 text-orange-400 border border-orange-500/25",
  },
  "auth-cloud": {
    label: "Auth anomale Cloud",
    icon: Wifi,
    cls: "bg-blue-500/12 text-blue-400 border border-blue-500/25",
  },
  "download-massif": {
    label: "Téléchargement massif de fichiers",
    icon: Download,
    cls: "bg-red-500/12 text-red-400 border border-red-500/25",
  },
};

function ReadOnlyTag() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-600 border border-slate-800 rounded px-1.5 py-0.5 select-none">
      <Lock className="w-2.5 h-2.5" /> LECTURE SEULE
    </span>
  );
}

export default function LecteurUEBAScreen() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const sel = selectedUser ? UEBA_USERS.find((u) => u.user === selectedUser) ?? null : null;

  return (
    <div className="p-5 space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground font-mono">
          <span className="text-foreground font-semibold">{UEBA_USERS.length}</span> entités surveillées
          <span className="mx-2 text-border">·</span>
          <span className="text-red-400 font-semibold">{UEBA_USERS.filter((u) => u.score >= 80).length}</span> score critique
          <span className="mx-2 text-border">·</span>
          <span className="text-orange-400 font-semibold">{UEBA_USERS.filter((u) => u.anomalies.length > 0).length}</span> entités avec anomalies
        </p>
        <ReadOnlyTag />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Risk table */}
        <div className="col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/10 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Scoring de risque dynamique — Utilisateurs</p>
            <span className="text-[10px] font-mono text-muted-foreground">Modèle ML v3.1 — Consultation uniquement</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                {["Utilisateur", "Score", "Jauge de risque", "Département", "Dernière act.", "Anomalies"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] text-muted-foreground font-mono uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {UEBA_USERS.map((u) => {
                const sc = u.score >= 80 ? "text-red-400" : u.score >= 50 ? "text-orange-400" : u.score >= 30 ? "text-yellow-400" : "text-emerald-400";
                const bar =
                  u.score >= 80
                    ? "bg-gradient-to-r from-red-600 to-red-400"
                    : u.score >= 50
                      ? "bg-gradient-to-r from-orange-600 to-orange-400"
                      : u.score >= 30
                        ? "bg-gradient-to-r from-yellow-600 to-yellow-400"
                        : "bg-gradient-to-r from-emerald-600 to-emerald-400";
                const isSel = selectedUser === u.user;
                return (
                  <tr
                    key={u.user}
                    onClick={() => setSelectedUser(isSel ? null : u.user)}
                    className={`border-b border-border/30 transition-colors cursor-pointer ${
                      isSel ? "bg-amber-600/8 border-r-2 border-r-amber-500/40" : "hover:bg-secondary/25"
                    }`}
                  >
                    <td className="px-4 py-3 text-xs font-mono text-blue-300 font-bold">{u.user}</td>
                    <td className="px-4 py-3">
                      <span className={`text-lg font-bold font-mono ${sc}`}>{u.score}</span>
                      <span className="text-slate-600 text-xs font-mono">/100</span>
                    </td>
                    <td className="px-4 py-3 w-28">
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${u.score}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{u.dept}</td>
                    <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{u.last}</td>
                    <td className="px-4 py-3">
                      {u.anomalies.length > 0 ? (
                        <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded">
                          {u.anomalies.length} anomalie{u.anomalies.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-emerald-400">Aucune</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        <div className="space-y-3">
          {sel ? (
            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-mono text-blue-300 font-bold">{sel.user}</p>
                  <ReadOnlyTag />
                </div>
                <p className="text-[10px] font-mono text-muted-foreground">
                  {sel.machine} · {sel.dept}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Anomalies comportementales</p>
                {sel.anomalies.length === 0 ? (
                  <p className="text-xs font-mono text-emerald-400">Aucune anomalie — comportement nominal</p>
                ) : (
                  <div className="space-y-2">
                    {sel.anomalies.map((a) => {
                      const meta = ANOMALY_META[a];
                      if (!meta) return null;
                      return (
                        <div key={a} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono ${meta.cls}`}>
                          <meta.icon className="w-3.5 h-3.5 shrink-0" />
                          {meta.label}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600">
                  <Lock className="w-2.5 h-2.5" />
                  Investigation approfondie — Rôle Analyste requis
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border/50 rounded-xl p-4 flex items-center justify-center" style={{ minHeight: 180 }}>
              <p className="text-xs font-mono text-muted-foreground text-center leading-relaxed">
                Sélectionner un utilisateur
                <br />
                pour voir ses anomalies
              </p>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Machines à risque</p>
            <div className="space-y-2">
              {UEBA_USERS.filter((u) => u.score >= 50).map((u) => (
                <div key={u.user} className="flex items-center gap-2">
                  <div className={`w-1.5 h-5 rounded-full shrink-0 ${u.score >= 80 ? "bg-red-500" : "bg-orange-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono text-foreground/80 truncate">{u.machine}</p>
                    <p className="text-[9px] font-mono text-muted-foreground">{u.user}</p>
                  </div>
                  <span className={`text-xs font-bold font-mono ${u.score >= 80 ? "text-red-400" : "text-orange-400"}`}>{u.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Anomaly catalog */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-foreground">Catalogue des anomalies détectées — Consultation simple</p>
          <ReadOnlyTag />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {UEBA_USERS.flatMap((u) =>
            u.anomalies.map((a) => {
              const meta = ANOMALY_META[a];
              if (!meta) return null;
              return (
                <div key={`${u.user}-${a}`} className={`flex flex-col gap-1.5 px-3 py-2.5 rounded-xl border ${meta.cls}`}>
                  <div className="flex items-center gap-1.5">
                    <meta.icon className="w-3 h-3 shrink-0" />
                    <span className="text-[10px] font-mono font-semibold leading-tight">{meta.label}</span>
                  </div>
                  <span className="text-[9px] font-mono opacity-70">
                    {u.user} · {u.machine}
                  </span>
                </div>
              );
            })
          ).filter(Boolean)}
        </div>
      </div>
    </div>
  );
}