import { useEffect, useState } from "react";
import { AlertTriangle, Bell, Zap, Clock, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { adminApi, type DashboardData } from "../../api/admin";

const SEV_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border border-red-500/30",
  HIGH: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  WARNING: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
};

function SevBadge({ s }: { s: string }) {
  return <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold tracking-widest ${SEV_STYLE[s] ?? SEV_STYLE.HIGH}`}>{s}</span>;
}

const STATUS_DOT: Record<string, string> = {
  Actif: "bg-emerald-400",
  Ouvert: "bg-red-400 animate-pulse",
  "En cours": "bg-orange-400 animate-pulse",
  Résolu: "bg-emerald-400",
  Clôturé: "bg-slate-500",
};

function StatusPill({ s }: { s: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[s] ?? "bg-slate-500"}`} />
      <span className="text-[11px] font-mono text-muted-foreground">{s}</span>
    </span>
  );
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { stroke?: string; fill?: string; color?: string; name?: string; value?: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#090e1b] border border-[#1a2540] rounded-md px-3 py-2 text-[11px] font-mono shadow-xl">
      <p className="text-slate-700 mb-1 pb-1 border-b border-[#1a2540]">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.stroke ?? p.fill ?? p.color }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.dashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur de chargement"));
  }, []);

  if (error) {
    return (
      <div className="p-6 text-red-400 font-mono text-sm">
        Impossible de charger le tableau de bord : {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground font-mono text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Chargement des données…
      </div>
    );
  }

  const { stats, trend, severity_distribution, recent_incidents } = data;

  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Incidents Actifs",
            value: String(stats.active_incidents),
            sub: stats.critical_incidents > 0 ? `dont ${stats.critical_incidents} critiques` : "aucun critique",
            icon: AlertTriangle,
            color: "text-red-400",
            bg: "bg-red-500/10",
          },
          {
            label: "Alertes (24h)",
            value: String(stats.alerts_24h),
            sub: "depuis PostgreSQL",
            icon: Bell,
            color: "text-orange-400",
            bg: "bg-orange-500/10",
          },
          {
            label: "Débit ingestion",
            value: stats.ingestion_rate.toLocaleString("fr-FR"),
            sub: "logs / seconde",
            icon: Zap,
            color: "text-cyan-400",
            bg: "bg-cyan-500/10",
          },
          {
            label: "MTTR moyen",
            value: stats.mttr_minutes > 0 ? `${stats.mttr_minutes} min` : "—",
            sub: `${stats.resolved_count} incident${stats.resolved_count > 1 ? "s" : ""} résolu${stats.resolved_count > 1 ? "s" : ""}`,
            icon: Clock,
            color: "text-violet-400",
            bg: "bg-violet-500/10",
          },
        ].map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
            <div className={`p-2.5 rounded-lg border ${k.bg}`}>
              <k.icon className={`w-4 h-4 ${k.color}`} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">{k.label}</p>
              <p className={`text-2xl font-bold font-mono ${k.color}`}>{k.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium">Tendance des incidents — 24h</p>
            <div className="flex items-center gap-4 text-[10px] font-mono">
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-red-400" /> Critique</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-orange-400" /> High</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-yellow-400" /> Warning</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={trend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
              <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 10 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={24} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="c" stroke="#ef4444" fill="url(#gc)" strokeWidth={2} />
              <Area type="monotone" dataKey="h" stroke="#f97316" fill="url(#gh)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="m" stroke="#eab308" fill="none" strokeWidth={1} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
          <p className="text-sm font-medium mb-4">Répartition criticité</p>
          <div className="flex-1 space-y-3">
            {severity_distribution.map((r) => (
              <div key={r.label}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[10px] font-mono text-muted-foreground">{r.label}</span>
                  <span className={`text-sm font-bold font-mono ${r.label === "CRITIQUE" ? "text-red-400" : r.label === "HIGH" ? "text-orange-400" : "text-yellow-400"}`}>{r.count}</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${r.label === "CRITIQUE" ? "bg-red-500" : r.label === "HIGH" ? "bg-orange-500" : "bg-yellow-500"}`} style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <p className="text-sm font-medium">Incidents récents</p>
          <span className="text-[10px] font-mono text-muted-foreground">Données PostgreSQL</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/60">
              {["ID", "Titre", "Criticité", "Statut", "Source", "Heure"].map((h) => (
                <th key={h} className="text-left px-5 py-2.5 text-[10px] text-muted-foreground font-mono uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent_incidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-xs font-mono text-muted-foreground">Aucun incident</td>
              </tr>
            ) : recent_incidents.map((inc, i) => (
              <tr key={inc.id} className={`border-b border-border/30 hover:bg-secondary/40 ${i === 0 && inc.sev === "CRITICAL" ? "bg-red-500/5" : ""}`}>
                <td className="px-5 py-3 text-xs font-mono text-blue-400">{inc.id}</td>
                <td className="px-5 py-3 text-xs text-foreground/90 max-w-65 truncate">{inc.title}</td>
                <td className="px-5 py-3"><SevBadge s={inc.sev} /></td>
                <td className="px-5 py-3"><StatusPill s={inc.status} /></td>
                <td className="px-5 py-3 text-[11px] font-mono text-muted-foreground">{inc.src}</td>
                <td className="px-5 py-3 text-[11px] font-mono text-muted-foreground">{inc.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
