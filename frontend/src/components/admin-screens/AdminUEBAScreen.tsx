import { Activity } from "lucide-react";

const UEBA_ROWS = [
  { user: "k.ibrahim", score: 94, anomalies: 7, last: "14:47", delta: "+18", detail: "Volume téléchargement ×12, accès hors périmètre ×3"  },
  { user: "svc_backup", score: 88, anomalies: 5, last: "14:51", delta: "+22", detail: "Élévation privilèges, exécution de commandes inhabituelles" },
  { user: "j.bernard",  score: 72, anomalies: 3, last: "13:45", delta: "+14", detail: "Connexion TOR, nouveau pays source référencé"         },
  { user: "p.muller",   score: 45, anomalies: 2, last: "02:34", delta: "+3",  detail: "Accès hors horaires, ressources inhabituelles"        },
  { user: "m.legrand",  score: 38, anomalies: 2, last: "11:07", delta: "+5",  detail: "Connexion depuis pays non référencé"                  },
  { user: "a.dupont",   score: 12, anomalies: 0, last: "11:15", delta: "0",   detail: "Aucune anomalie détectée — comportement nominal"      },
];

export default function UEBAScreen() {
  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Utilisateurs surveillés",    value: "156", color: "text-foreground"   },
          { label: "Scores critiques (score > 80)", value: "2", color: "text-red-400"    },
          { label: "Anomalies détectées (7j)",   value: "31",  color: "text-orange-400"  },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl px-5 py-4">
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{s.label}</p>
            <p className={`text-3xl font-bold font-mono mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Score de risque comportemental</p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Moteur ML — Modèle UEBA v3.1 — Rafraîchi il y a 3 min</p>
          </div>
          <Activity className="w-4 h-4 text-muted-foreground" />
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 bg-secondary/10">
              {["Utilisateur", "Score", "Jauge de risque", "Anomalies", "Δ 24h", "Dernière activité", "Résumé", "Actions"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] text-muted-foreground font-mono uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {UEBA_ROWS.map((u) => {
              const sc =
                u.score >= 80 ? "text-red-400" :
                u.score >= 50 ? "text-orange-400" :
                u.score >= 30 ? "text-yellow-400" : "text-emerald-400";
              const bar =
                u.score >= 80 ? "bg-gradient-to-r from-red-600 to-red-400" :
                u.score >= 50 ? "bg-gradient-to-r from-orange-600 to-orange-400" :
                u.score >= 30 ? "bg-gradient-to-r from-yellow-600 to-yellow-400" :
                                "bg-gradient-to-r from-emerald-600 to-emerald-400";
              return (
                <tr key={u.user} className="border-b border-border/30 hover:bg-secondary/25 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-blue-300 font-bold">{u.user}</td>
                  <td className="px-4 py-3">
                    <span className={`text-lg font-bold font-mono ${sc}`}>{u.score}</span>
                    <span className="text-slate-600 text-xs font-mono">/100</span>
                  </td>
                  <td className="px-4 py-3 w-32">
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${u.score}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${u.anomalies > 0 ? "bg-orange-500/15 text-orange-400" : "bg-secondary text-slate-500"}`}>
                      {u.anomalies}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono">
                    {u.delta === "0"
                      ? <span className="text-slate-600">—</span>
                      : <span className="text-red-400">{u.delta}</span>}
                  </td>
                  <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{u.last}</td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground max-w-55 truncate">{u.detail}</td>
                  <td className="px-4 py-3">
                    <button className="text-[11px] font-mono text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">
                      Enquêter →
                    </button>
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