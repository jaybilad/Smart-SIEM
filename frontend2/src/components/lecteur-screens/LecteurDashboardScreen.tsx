import { useEffect, useState } from "react";
import { Check, ChevronDown, Database, AlertTriangle, Globe, Activity, BarChart2, Lock,RefreshCw } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { lecteurApi, type LecteurDashboardData } from "../../api/lecteur";

const SEV_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border border-red-500/30",
  HIGH: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  WARNING: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  INFO: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
};

const ALERT_COLORS = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#14b8a6"];

function SevBadge({ s }: { s: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold tracking-widest ${SEV_BADGE[s] ?? SEV_BADGE.INFO}`}>
      {s === "CRITICAL" && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
      {s}
    </span>
  );
}

function ReadOnlyTag() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-600 border border-slate-800 rounded px-1.5 py-0.5 select-none">
      <Lock className="w-2.5 h-2.5" /> LECTURE SEULE
    </span>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#090e1b] border border-[#1a2540] rounded-md px-3 py-2 text-[11px] font-mono shadow-xl">
      <p className="text-slate-400 mb-1 pb-1 border-b border-[#1a2540]">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.stroke ?? p.fill }}>
          {p.name}: <span className="font-semibold">{typeof p.value === "number" ? p.value.toLocaleString("fr-FR") : p.value}</span>
        </p>
      ))}
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="m-5 bg-red-500/10 border border-red-500/30 rounded-xl p-5">
      <div className="flex items-center gap-2 text-red-300 font-mono text-sm">
        <AlertTriangle className="w-4 h-4" />
        Impossible de charger les donnees lecteur depuis PostgreSQL.
      </div>
      <p className="text-xs text-red-200/70 font-mono mt-2">{message}</p>
      <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 text-xs font-mono text-red-200 hover:bg-red-500/10">
        <RefreshCw className="w-3 h-3" /> Reessayer
      </button>
    </div>
  );
}

export default function LecteurDashboardScreen() {
  const [view, setView] = useState<"tech" | "audit">("tech");
  const [viewOpen, setViewOpen] = useState(false);
  const [data, setData] = useState<LecteurDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    lecteurApi.dashboard()
      .then(setData)
      .catch((err: unknown) => {
        setData(null);
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  /*const handleExport = (type: "pdf" | "csv") => {
    setExportState(type);
    setTimeout(() => {
      setExportState(null);
      setExportDone(type);
      setTimeout(() => setExportDone(null), 3500);
    }, 800);
  };*/

  if (loading) {
    return <div className="p-5 text-xs font-mono text-muted-foreground">Chargement depuis PostgreSQL...</div>;
  }

  if (error || !data) {
    return <ErrorPanel message={error ?? "Reponse vide de l'API lecteur."} onRetry={load} />;
  }

  const complianceOk = (m: LecteurDashboardData["compliance"][number]) => (m.up ? m.value >= m.target : m.value <= m.target);
  const auditKpis = [
    { label: "Incidents traces ce mois", value: data.audit_kpis.incidents_month.toLocaleString("fr-FR"), sub: "PostgreSQL", color: "text-foreground" },
    { label: "Resolus dans les delais", value: data.audit_kpis.resolved_month.toLocaleString("fr-FR"), sub: `${data.audit_kpis.resolution_rate} %`, color: "text-yellow-400" },
    { label: "Anomalies detectees", value: data.audit_kpis.anomalies_month.toLocaleString("fr-FR"), sub: "mois courant", color: "text-orange-400" },
    { label: "Couverture audit SIEM", value: `${data.audit_kpis.coverage} %`, sub: "assets actifs", color: "text-emerald-400" },
  ];

  return (
    <div className="p-5 space-y-4 pb-10">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2">
            <Database className="w-3 h-3 text-amber-400/80" />
            <span className="text-[11px] font-mono text-amber-300/80">Sources: <strong>PostgreSQL + Elasticsearch</strong></span>
          </div>
          <ReadOnlyTag />
        </div>
        <div className="relative">
          <button onClick={() => setViewOpen(!viewOpen)} className="flex items-center gap-2 px-3 py-2 bg-secondary/60 hover:bg-secondary border border-border rounded-xl text-xs font-mono text-foreground transition-colors">
            <BarChart2 className="w-3.5 h-3.5 text-muted-foreground" />
            {view === "tech" ? "Vue Analyste (Technique)" : "Vue Auditeur (Conformite)"}
            <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${viewOpen ? "rotate-180" : ""}`} />
          </button>
          {viewOpen && (
            <div className="absolute right-0 top-full mt-1 bg-[#0d1423] border border-border rounded-xl shadow-2xl z-20 w-60 overflow-hidden">
              {[
                { key: "tech", label: "Vue Analyste (Technique)" },
                { key: "audit", label: "Vue Auditeur (Conformite)" },
              ].map((o) => (
                <button key={o.key} onClick={() => { setView(o.key as "tech" | "audit"); setViewOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-colors flex items-center gap-2 ${view === o.key ? "bg-amber-600/20 text-amber-300" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}>
                  {view === o.key ? <Check className="w-3 h-3 shrink-0" /> : <span className="w-3 shrink-0" />}
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {view === "tech" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total logs (24h)", value: data.kpis.total_logs.toLocaleString("fr-FR"), color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", icon: Database },
              { label: "Incidents actifs", value: String(data.kpis.active_incidents), color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", icon: AlertTriangle },
              { label: "IPs suspectes", value: String(data.kpis.suspect_ips), color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: Globe },
              { label: "Assets surveilles", value: String(data.kpis.assets), color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", icon: Activity },
            ].map((k) => (
              <div key={k.label} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
                <div className={`p-2 rounded-lg border shrink-0 ${k.bg}`}><k.icon className={`w-3.5 h-3.5 ${k.color}`} /></div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider leading-none mb-1">{k.label}</p>
                  <p className={`text-2xl font-bold font-mono leading-none ${k.color}`}>{k.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 bg-card border border-border rounded-xl p-5">
              <p className="text-sm font-medium text-foreground mb-1">Volume de logs recus par heure - 24h</p>
              <p className="text-[10px] text-muted-foreground font-mono mb-3">Donnees Elasticsearch - Lecture seule</p>
              <ResponsiveContainer width="100%" height={178}>
                <AreaChart data={data.hourly} margin={{ left: -12, right: 4, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
                  <XAxis dataKey="h" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="total" name="Total" stroke="#06b6d4" fill="#06b6d433" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="scope" name="Authentifications" stroke="#f59e0b" fill="#f59e0b33" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-sm font-medium text-foreground mb-3">Top alertes par type</p>
              <ResponsiveContainer width="100%" height={178}>
                <BarChart data={data.top_alerts} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 0 }} barSize={9}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="type" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} width={88} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="count" name="Alertes" radius={[0, 3, 3, 0]}>
                    {data.top_alerts.map((e, i) => <Cell key={e.type} fill={ALERT_COLORS[i % ALERT_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm font-medium text-foreground mb-3">Top 5 IPs suspectes</p>
            <div className="grid grid-cols-5 gap-3">
              {data.top_ips.map((ip, i) => (
                <div key={ip.ip} className="border border-border/60 rounded-lg p-3 bg-secondary/10">
                  <span className="text-[10px] font-mono text-slate-600">{i + 1}</span>
                  <p className="text-[11px] font-mono text-orange-300 truncate mt-1">{ip.ip}</p>
                  <div className="flex items-center justify-between mt-2">
                    <SevBadge s={ip.sev} />
                    <span className="text-[9px] font-mono text-muted-foreground">{ip.count} logs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {auditKpis.map((k) => (
              <div key={k.label} className="bg-card border border-border rounded-xl px-4 py-4">
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider leading-none mb-1.5">{k.label}</p>
                <p className={`text-2xl font-bold font-mono ${k.color}`}>{k.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Indicateurs de conformite - Cible vs Reel</p>
            <div className="space-y-4">
              {data.compliance.map((m) => {
                const ok = complianceOk(m);
                return (
                  <div key={m.label}>
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                      <span className="text-xs text-foreground/80">{m.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-muted-foreground">Cible : {m.target}{m.unit}</span>
                        <span className={`text-sm font-bold font-mono ${ok ? "text-emerald-400" : "text-yellow-400"}`}>{m.value}{m.unit}</span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${ok ? "bg-emerald-500/15 text-emerald-400" : "bg-yellow-500/15 text-yellow-400"}`}>
                          {ok ? "CONFORME" : "SOUS-CIBLE"}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${ok ? "bg-emerald-500" : "bg-yellow-500"}`} style={{ width: `${Math.min(m.value, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
