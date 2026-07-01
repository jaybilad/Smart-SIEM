import { useState } from "react";
import { AlertTriangle, Activity, Globe, MapPin, ChevronDown, Check, Radio } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const REALTIME_LOGS = [
  { t: "14:30", v: 1120, eu: 280 }, { t: "14:31", v: 980,  eu: 245 },
  { t: "14:32", v: 1340, eu: 335 }, { t: "14:33", v: 1580, eu: 395 },
  { t: "14:34", v: 1230, eu: 308 }, { t: "14:35", v: 890,  eu: 223 },
  { t: "14:36", v: 2100, eu: 525 }, { t: "14:37", v: 1750, eu: 438 },
  { t: "14:38", v: 1430, eu: 358 }, { t: "14:39", v: 1890, eu: 473 },
  { t: "14:40", v: 2240, eu: 560 }, { t: "14:41", v: 1670, eu: 418 },
];

const TOP5_IPS = [
  { ip: "185.107.47.215", count: 3, country: "NL / TOR exit", sev: "HIGH" },
  { ip: "41.214.100.30",  count: 2, country: "Nigeria",        sev: "WARNING" },
  { ip: "192.168.10.33",  count: 2, country: "Interne / EU",   sev: "HIGH" },
  { ip: "185.220.101.47", count: 1, country: "RU / TOR exit",  sev: "CRITICAL" },
  { ip: "192.168.50.14",  count: 1, country: "Interne / EU",   sev: "WARNING" },
];

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

  return (
    <div className="p-5 space-y-4 pb-10">
      {/* Profile switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
            <MapPin className="w-3 h-3 text-blue-400" />
            <span className="text-[11px] font-mono text-blue-300">Périmètre assigné : <strong>Filiale Europe</strong></span>
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
            {[
              { label: "Incidents actifs",  value: "5",     sub: "Filiale Europe",   color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", icon: AlertTriangle },
              { label: "Logs/s (EU)",        value: "495",   sub: "flux actuel",      color: "text-cyan-400",   bg: "bg-cyan-500/10 border-cyan-500/20",     icon: Activity     },
              { label: "IPs suspectes",      value: "5",     sub: "détectées (24h)",  color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",       icon: Globe        },
              { label: "Menace critique",    value: "1",     sub: "UEBA score 94",    color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",       icon: AlertTriangle },
            ].map((k) => (
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
                <p className="text-sm font-medium text-foreground">Volume de logs — temps réel (30 min)</p>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-0.5 bg-cyan-500" /> Total</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-0.5 bg-blue-400" /> Filiale EU</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={REALTIME_LOGS} margin={{ left: -16, right: 4, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="geu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
                  <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="v"  name="Total (logs/s)"    stroke="#06b6d4" fill="url(#gv)"  strokeWidth={1.5} />
                  <Area type="monotone" dataKey="eu" name="Filiale EU (logs/s)" stroke="#3b82f6" fill="url(#geu)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Top 5 IPs */}
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-sm font-medium text-foreground mb-3">Top 5 IPs suspectes</p>
              <div className="space-y-2">
                {TOP5_IPS.map((ip, i) => (
                  <div key={ip.ip} className="flex items-center gap-2.5 py-1.5 border-b border-border/40 last:border-0">
                    <span className="text-[10px] font-mono text-slate-600 w-3">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-mono text-orange-300 truncate">{ip.ip}</p>
                      <p className="text-[9px] font-mono text-muted-foreground">{ip.country}</p>
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
            <p className="text-sm text-muted-foreground">Vue synthétique destinée à la cellule de crise — Filiale Europe — 22 juin 2026 14:59 UTC</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Incidents critiques ouverts", value: "1",  note: "INC-2852 — Exfiltration",     color: "text-red-400",    bg: "border-red-500/30 bg-red-500/5"    },
              { label: "Incidents HIGH non résolus",  value: "2",  note: "INC-2853, INC-2845",           color: "text-orange-400", bg: "border-orange-500/30 bg-orange-500/5" },
              { label: "Machines à risque élevé",     value: "2",  note: "WS-EU-088, WS-EU-047",         color: "text-orange-400", bg: "border-orange-500/20"              },
              { label: "Score UEBA maximum",          value: "94", note: "k.ibrahim — CRITIQUE",         color: "text-red-400",    bg: "border-red-500/20"                 },
            ].map((s) => (
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