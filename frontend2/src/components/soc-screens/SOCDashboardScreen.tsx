import { useEffect, useState } from "react";
import { AlertTriangle, Activity, Globe, MapPin, ChevronDown, Check, Radio } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getStoredUser } from "../../api/auth";
import { socApi, type SocDashboardData } from "../../api/soc";

function SevBadge({ s }: { s: string }) {
  const colors: Record<string, string> = {
    CRITICAL: "bg-red-500/15 text-red-400 border border-red-500/30",
    HIGH:     "bg-orange-500/15 text-orange-400 border border-orange-500/30",
    WARNING:  "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
    INFO:     "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold tracking-widest ${colors[s] ?? colors.INFO}`}>
      {s === "CRITICAL" && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
      {s}
    </span>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#090e1b] border border-[#1a2540] rounded-md px-3 py-2 text-[11px] font-mono shadow-xl">
      <p className="text-slate-400 mb-1 pb-1 border-b border-[#1a2540]">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.stroke ?? p.fill }}>
          {p.name}: <span className="font-semibold">{typeof p.value === "number" ? p.value.toLocaleString("fr-FR") : p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function SOCDashboardScreen() {
  const [profile, setProfile] = useState<"technique" | "crise">("technique");
  const [profileOpen, setProfileOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<SocDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const user = getStoredUser();

  useEffect(() => {
    setLoading(true);
    socApi.dashboard()
      .then((data) => setDashboardData(data))
      .catch(() => setDashboardData(null))
      .finally(() => setLoading(false));
  }, []);

  const topIps = dashboardData?.soc?.top_ips ?? [];
  const volumeData = dashboardData?.soc?.log_volume ?? [];
  const criticalOpenIncidents = dashboardData?.stats.critical_incidents ?? 0;
  const highOpenIncidents = dashboardData?.soc?.high_open_incidents ?? 0;
  const highRiskHosts = dashboardData?.soc?.high_risk_hosts ?? 0;
  const maxUeba = dashboardData?.soc?.ueba_max_score ?? 0;
  const recentHighIds = dashboardData?.recent_incidents
    ?.filter((inc) => ["CRITICAL", "HIGH"].includes(inc.sev))
    .map((inc) => inc.id)
    .slice(0, 3)
    .join(", ") || "Aucun incident ouvert";

  const kpiItems = [
    {
      label: "Incidents actifs",
      value: loading ? "..." : dashboardData ? String(dashboardData.stats.active_incidents) : "0",
      sub: "PostgreSQL",
      color: "text-orange-400",
      bg: "bg-orange-500/10 border-orange-500/20",
      icon: AlertTriangle,
    },
    {
      label: "Logs/s (EU)",
      value: loading ? "..." : dashboardData ? String(dashboardData.stats.ingestion_rate) : "0",
      sub: "flux actuel",
      color: "text-cyan-400",
      bg: "bg-cyan-500/10 border-cyan-500/20",
      icon: Activity,
    },
    {
      label: "IPs suspectes",
      value: loading ? "..." : String(topIps.length),
      sub: "détectées (24h)",
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/20",
      icon: Globe,
    },
    {
      label: "Menace critique",
      value: loading ? "..." : String(maxUeba),
      sub: "UEBA score max",
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/20",
      icon: AlertTriangle,
    },
  ];

  const crisisStats = [
    {
      label: "Incidents critiques ouverts",
      value: String(criticalOpenIncidents),
      note: recentHighIds,
      color: "text-red-400",
      bg: "border-red-500/30 bg-red-500/5",
    },
    {
      label: "Incidents HIGH non résolus",
      value: String(highOpenIncidents),
      note: recentHighIds,
      color: "text-orange-400",
      bg: "border-orange-500/30 bg-orange-500/5",
    },
    {
      label: "Machines à risque élevé",
      value: String(highRiskHosts),
      note: "Hôtes distincts avec logs HIGH/CRITICAL",
      color: "text-orange-400",
      bg: "border-orange-500/20",
    },
    {
      label: "Score UEBA maximum",
      value: String(maxUeba),
      note: dashboardData?.soc.ueba_top_user ?? "Aucun score UEBA",
      color: "text-red-400",
      bg: "border-red-500/20",
    },
  ];

  return (
    <div className="p-5 space-y-4 pb-10">
      {/* Profile switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
            <MapPin className="w-3 h-3 text-blue-400" />
            <span className="text-[11px] font-mono text-blue-300">Périmètre assigné : <strong>{user?.scope ?? "SOC"}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Flux temps réel actif
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 px-3 py-2 bg-secondary/60 hover:bg-secondary border border-border rounded-xl text-xs font-mono text-foreground transition-colors">
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            {profile === "technique" ? "Vue Technique Réseau" : "Vue Synthétique Gestion de crise"}
            <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-1 bg-[#0d1423] border border-border rounded-xl shadow-xl z-20 w-56 overflow-hidden">
              {[
                { key: "technique", label: "Vue Technique Réseau" },
                { key: "crise",     label: "Vue Synthétique Gestion de crise" },
              ].map((o) => (
                <button key={o.key} onClick={() => { setProfile(o.key as "technique" | "crise"); setProfileOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-colors flex items-center gap-2 ${profile === o.key ? "bg-blue-600/20 text-blue-300" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}>
                  {profile === o.key && <Check className="w-3 h-3 shrink-0" />}
                  {profile !== o.key && <span className="w-3 h-3 shrink-0" />}
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {profile === "technique" ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3">
            {kpiItems.map((k) => (
              <div key={k.label} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
                <div className={`p-2 rounded-lg border shrink-0 ${k.bg}`}>
                  <k.icon className={`w-3.5 h-3.5 ${k.color}`} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider leading-none mb-1">{k.label}</p>
                  <p className={`text-2xl font-bold font-mono leading-none ${k.color}`}>{k.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{k.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-foreground">Volume de logs — 24 heures</p>
                </div>
                {volumeData.length === 0 ? (
                  <div className="h-[180px] flex items-center justify-center text-xs font-mono text-muted-foreground">
                    {loading ? "Chargement des logs..." : "Aucun volume de logs en base sur 24h."}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={volumeData} margin={{ left: -16, right: 4, top: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
                      <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="v" name="Total logs" stroke="#06b6d4" fill="url(#gv)" strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-sm font-medium text-foreground mb-3">Top 5 IPs suspectes</p>
              <div className="space-y-2">
                {topIps.length === 0 ? (
                  <div className="py-8 text-center text-xs font-mono text-muted-foreground">
                    {loading ? "Chargement..." : "Aucune IP suspecte en base sur 24h."}
                  </div>
                ) : topIps.map((ip, i) => (
                  <div key={`${ip.ip}-${i}`} className="flex items-center gap-2.5 py-1.5 border-b border-border/40 last:border-0">
                    <span className="text-[10px] font-mono text-slate-600 w-3">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-mono text-orange-300 truncate">{ip.ip}</p>
                      <p className="text-[9px] font-mono text-muted-foreground">Elasticsearch logs</p>
                    </div>
                    <div className="text-right">
                      <SevBadge s={ip.sev} />
                      <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{ip.count} inc.</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ── CRISIS VIEW ── */
        <div className="space-y-4">
          <div className="bg-red-500/8 border border-red-500/25 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Radio className="w-5 h-5 text-red-400 animate-pulse" />
              <p className="text-base font-bold text-red-400">MODE GESTION DE CRISE ACTIVÉ</p>
            </div>
            <p className="text-sm text-muted-foreground">Vue synthétique alimentée par PostgreSQL local et Elasticsearch Docker</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {crisisStats.map((s) => (
              <div key={s.label} className={`bg-card border rounded-xl p-5 ${s.bg}`}>
                <p className="text-[11px] text-muted-foreground font-mono mb-1">{s.label}</p>
                <p className={`text-4xl font-bold font-mono ${s.color}`}>{s.value}</p>
                <p className="text-xs font-mono text-muted-foreground mt-2">{s.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
