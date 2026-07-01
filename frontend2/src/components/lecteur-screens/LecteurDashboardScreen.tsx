import { useState } from "react";
import {
  Check, MapPin, ChevronDown, FileText, Download, Lock,
  Database, AlertTriangle, Globe, Activity, BarChart2,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const HOURLY_LOGS = [
  { h: "00h", total: 8420, scope: 210 }, { h: "01h", total: 7230, scope: 181 },
  { h: "02h", total: 5810, scope: 145 }, { h: "03h", total: 4320, scope: 108 },
  { h: "04h", total: 3890, scope: 97 }, { h: "05h", total: 4210, scope: 105 },
  { h: "06h", total: 7650, scope: 191 }, { h: "07h", total: 12400, scope: 310 },
  { h: "08h", total: 18420, scope: 461 }, { h: "09h", total: 22100, scope: 553 },
  { h: "10h", total: 24300, scope: 608 }, { h: "11h", total: 23800, scope: 595 },
  { h: "12h", total: 21800, scope: 545 }, { h: "13h", total: 22400, scope: 560 },
  { h: "14h", total: 28900, scope: 723 }, { h: "15h", total: 19500, scope: 488 },
  { h: "16h", total: 22100, scope: 553 }, { h: "17h", total: 20300, scope: 508 },
  { h: "18h", total: 17500, scope: 438 }, { h: "19h", total: 14200, scope: 355 },
  { h: "20h", total: 11800, scope: 295 }, { h: "21h", total: 10200, scope: 255 },
  { h: "22h", total: 9100, scope: 228 }, { h: "23h", total: 8560, scope: 214 },
];

const TOP_ALERTS = [
  { type: "AUTH_FAILURE", count: 847, fill: "#ef4444" },
  { type: "FILE_DOWNLOAD", count: 523, fill: "#f97316" },
  { type: "PORT_SCAN", count: 234, fill: "#f97316" },
  { type: "ACCESS_DENIED", count: 189, fill: "#eab308" },
  { type: "DNS_TUNNEL", count: 67, fill: "#3b82f6" },
];

const COMPLIANCE = [
  { label: "Taux de résolution des incidents", value: 78, target: 85, unit: "%", up: true },
  { label: "Respect SLA P1 (< 4 h)", value: 91, target: 95, unit: "%", up: true },
  { label: "Respect SLA P2 (< 24 h)", value: 97, target: 95, unit: "%", up: true },
  { label: "Couverture SIEM des assets", value: 94, target: 90, unit: "%", up: true },
  { label: "Taux de faux positifs", value: 12, target: 10, unit: "%", up: false },
];

const TOP5_IPS = [
  { ip: "185.107.47.215", count: 3, country: "NL / TOR exit", sev: "HIGH" },
  { ip: "41.214.100.30", count: 2, country: "Nigeria", sev: "WARNING" },
  { ip: "192.168.10.33", count: 2, country: "Interne / EU", sev: "HIGH" },
  { ip: "185.220.101.47", count: 1, country: "RU / TOR exit", sev: "CRITICAL" },
  { ip: "192.168.50.14", count: 1, country: "Interne / EU", sev: "WARNING" },
];

const SEV_DOT: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  WARNING: "#eab308",
  INFO: "#3b82f6",
};

const SEV_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border border-red-500/30",
  HIGH: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  WARNING: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  INFO: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
};

function SevBadge({ s }: { s: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold tracking-widest ${SEV_BADGE[s] ?? SEV_BADGE.INFO}`}>
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

function ReadOnlyTag() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-600 border border-slate-800 rounded px-1.5 py-0.5 select-none">
      <Lock className="w-2.5 h-2.5" /> LECTURE SEULE
    </span>
  );
}

function WorldMap() {
  const threats = [
    { cx: 408, cy: 118, label: "185.107.47.215", country: "NL/TOR", sev: "HIGH" },
    { cx: 555, cy: 105, label: "185.220.101.47", country: "RU/TOR", sev: "CRITICAL" },
    { cx: 385, cy: 260, label: "41.214.100.30", country: "Nigeria", sev: "WARNING" },
    { cx: 652, cy: 168, label: "195.x.x.x", country: "China", sev: "INFO" },
  ];
  return (
    <svg viewBox="0 0 800 330" style={{ display: "block", width: "100%", height: "100%" }}>
      <defs>
        <pattern id="hexg3" x="0" y="0" width="20" height="23.1" patternUnits="userSpaceOnUse">
          <polygon points="10,1 19,6 19,17 10,22 1,17 1,6" fill="none" stroke="#1a2540" strokeWidth="0.4" opacity="0.5" />
        </pattern>
        <radialGradient id="scopeGlow3" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d97706" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
        </radialGradient>
        <filter id="dotGlow3" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="800" height="330" fill="#060a12" rx="8" />
      <rect width="800" height="330" fill="url(#hexg3)" rx="8" />
      <line x1="0" y1="165" x2="800" y2="165" stroke="#1a2540" strokeWidth="0.6" strokeDasharray="5 5" />
      <polygon points="52,72 195,66 216,102 210,192 175,216 132,205 80,183 53,147" fill="#0d1728" stroke="#1e2d4a" strokeWidth="0.8" />
      <polygon points="128,220 200,215 218,238 213,315 183,328 153,309 128,265" fill="#0d1728" stroke="#1e2d4a" strokeWidth="0.8" />
      <polygon points="327,68 432,62 449,104 438,152 413,165 373,160 338,137 327,98" fill="#0d1728" stroke="#1e2d4a" strokeWidth="0.8" />
      <polygon points="323,170 440,163 456,245 428,308 398,321 365,302 333,232" fill="#0d1728" stroke="#1e2d4a" strokeWidth="0.8" />
      <polygon points="443,150 524,146 536,182 493,196 448,184" fill="#0d1728" stroke="#1e2d4a" strokeWidth="0.8" />
      <polygon points="437,50 762,46 762,134 642,147 519,137 437,118" fill="#0d1728" stroke="#1e2d4a" strokeWidth="0.8" />
      <polygon points="441,121 762,135 762,230 694,252 605,255 518,228 441,190" fill="#0d1728" stroke="#1e2d4a" strokeWidth="0.8" />
      <polygon points="640,268 762,262 766,312 710,326 646,314" fill="#0d1728" stroke="#1e2d4a" strokeWidth="0.8" />
      <rect x="314" y="58" width="152" height="117" rx="6" fill="url(#scopeGlow3)" stroke="#92400e" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.5" />
      <text x="318" y="55" fill="#92400e" fontSize="7.5" fontFamily="monospace" opacity="0.8">
        PÉRIMÈTRE AUDIT &amp; CONFORMITÉ
      </text>
      <text x="112" y="143" fill="#1e2d4a" fontSize="8" fontFamily="monospace" textAnchor="middle">
        NORTH AMERICA
      </text>
      <text x="388" y="228" fill="#1e2d4a" fontSize="8" fontFamily="monospace" textAnchor="middle">
        AFRICA
      </text>
      <text x="598" y="94" fill="#1e2d4a" fontSize="8" fontFamily="monospace" textAnchor="middle">
        RUSSIA / CENTRAL ASIA
      </text>
      {threats.map((t, i) => (
        <g key={i}>
          <circle cx={t.cx} cy={t.cy} r="4" fill={SEV_DOT[t.sev] ?? "#64748b"} filter="url(#dotGlow3)" />
          <circle cx={t.cx} cy={t.cy} r="4" fill="none" stroke={SEV_DOT[t.sev] ?? "#64748b"} strokeWidth="0.8">
            <animate attributeName="r" values={`4;${12 + i};4`} dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0;0.7" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
          <text x={t.cx + 8} y={t.cy - 4} fill={SEV_DOT[t.sev] ?? "#64748b"} fontSize="7" fontFamily="monospace" opacity="0.85">
            {t.label}
          </text>
          <text x={t.cx + 8} y={t.cy + 4} fill="#4b5563" fontSize="6" fontFamily="monospace">
            {t.country}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function LecteurDashboardScreen() {
  const [view, setView] = useState<"tech" | "audit">("tech");
  const [viewOpen, setViewOpen] = useState(false);
  const [exportState, setExportState] = useState<"pdf" | "csv" | null>(null);
  const [exportDone, setExportDone] = useState<"pdf" | "csv" | null>(null);

  const handleExport = (type: "pdf" | "csv") => {
    setExportState(type);
    setTimeout(() => {
      setExportState(null);
      setExportDone(type);
      setTimeout(() => setExportDone(null), 3500);
    }, 2200);
  };

  const complianceOk = (m: typeof COMPLIANCE[0]) =>
    m.up ? m.value >= m.target : m.value <= m.target;

  return (
    <div className="p-5 space-y-4 pb-10">
      {/* Export toast */}
      {exportDone && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-sm">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-xs font-mono text-emerald-300">
            {exportDone === "pdf" ? "Rapport PDF" : "Export CSV"} — Téléchargement prêt
          </p>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2">
            <MapPin className="w-3 h-3 text-amber-400/80" />
            <span className="text-[11px] font-mono text-amber-300/80">
              Périmètre restreint : <strong>Audit &amp; Conformité</strong>
            </span>
          </div>
          <ReadOnlyTag />
        </div>
        <div className="relative">
          <button
            onClick={() => setViewOpen(!viewOpen)}
            className="flex items-center gap-2 px-3 py-2 bg-secondary/60 hover:bg-secondary border border-border rounded-xl text-xs font-mono text-foreground transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5 text-muted-foreground" />
            {view === "tech" ? "Vue Analyste (Technique)" : "Vue Auditeur (Conformité)"}
            <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${viewOpen ? "rotate-180" : ""}`} />
          </button>
          {viewOpen && (
            <div className="absolute right-0 top-full mt-1 bg-[#0d1423] border border-border rounded-xl shadow-2xl z-20 w-60 overflow-hidden">
              {[
                { key: "tech", label: "Vue Analyste (Technique)" },
                { key: "audit", label: "Vue Auditeur (Conformité)" },
              ].map((o) => (
                <button
                  key={o.key}
                  onClick={() => {
                    setView(o.key as "tech" | "audit");
                    setViewOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-colors flex items-center gap-2 ${
                    view === o.key
                      ? "bg-amber-600/20 text-amber-300"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  {view === o.key && <Check className="w-3 h-3 shrink-0" />}
                  {view !== o.key && <span className="w-3 shrink-0" />}
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {view === "tech" ? (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total logs (24h)", value: "312 840", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", icon: Database },
              { label: "Incidents actifs", value: "5", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", icon: AlertTriangle },
              { label: "IPs suspectes", value: "5", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: Globe },
              { label: "Assets surveillés", value: "1 247", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", icon: Activity },
            ].map((k) => (
              <div key={k.label} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
                <div className={`p-2 rounded-lg border shrink-0 ${k.bg}`}>
                  <k.icon className={`w-3.5 h-3.5 ${k.color}`} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider leading-none mb-1">{k.label}</p>
                  <p className={`text-2xl font-bold font-mono leading-none ${k.color}`}>{k.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 bg-card border border-border rounded-xl p-5">
              <p className="text-sm font-medium text-foreground mb-1">Volume de logs reçus par heure — 24h</p>
              <p className="text-[10px] text-muted-foreground font-mono mb-3">Widget non modifiable — Lecture seule</p>
              <ResponsiveContainer width="100%" height={178}>
                <AreaChart data={HOURLY_LOGS} margin={{ left: -12, right: 4, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gT3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gS3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
                  <XAxis dataKey="h" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="total" name="Total" stroke="#06b6d4" fill="url(#gT3)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="scope" name="Périmètre RH" stroke="#f59e0b" fill="url(#gS3)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-sm font-medium text-foreground mb-3">Top alertes par type</p>
              <ResponsiveContainer width="100%" height={178}>
                <BarChart data={TOP_ALERTS} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 0 }} barSize={9}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="type" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} width={88} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="count" name="Alertes" radius={[0, 3, 3, 0]}>
                    {TOP_ALERTS.map((e, i) => (
                      <Cell key={i} fill={e.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* World map + Top IPs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 bg-card border border-border rounded-xl p-4">
              <p className="text-sm font-medium text-foreground mb-3">Flux suspects — Carte géographique des sources</p>
              <div className="rounded-lg overflow-hidden" style={{ height: 270 }}>
                <WorldMap />
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-sm font-medium text-foreground mb-3">Top 5 IPs suspectes</p>
              <div className="space-y-2.5">
                {TOP5_IPS.map((ip, i) => (
                  <div key={ip.ip} className="flex items-center gap-2.5 pb-2.5 border-b border-border/40 last:border-0">
                    <span className="text-[10px] font-mono text-slate-600 w-3 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-mono text-orange-300 truncate">{ip.ip}</p>
                      <p className="text-[9px] font-mono text-muted-foreground">{ip.country}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <SevBadge s={ip.sev} />
                      <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{ip.count} inc.</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── CONFORMITY VIEW ── */
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Incidents tracés ce mois", value: "847", sub: "juin 2026", color: "text-foreground" },
              { label: "Résolus dans les délais", value: "661", sub: "78,1 %", color: "text-yellow-400" },
              { label: "Violations de politique", value: "34", sub: "actives", color: "text-orange-400" },
              { label: "Couverture audit SIEM", value: "94 %", sub: "vs cible 90 %", color: "text-emerald-400" },
            ].map((k) => (
              <div key={k.label} className="bg-card border border-border rounded-xl px-4 py-4">
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider leading-none mb-1.5">{k.label}</p>
                <p className={`text-2xl font-bold font-mono ${k.color}`}>{k.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Indicateurs de conformité — Cible vs Réel (juin 2026)</p>
            <div className="space-y-4">
              {COMPLIANCE.map((m) => {
                const ok = complianceOk(m);
                return (
                  <div key={m.label}>
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                      <span className="text-xs text-foreground/80">{m.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-muted-foreground">Cible : {m.target}{m.unit}</span>
                        <span className={`text-sm font-bold font-mono ${ok ? "text-emerald-400" : "text-yellow-400"}`}>{m.value}{m.unit}</span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${ok ? "bg-emerald-500/15 text-emerald-400" : "bg-yellow-500/15 text-yellow-400"}`}>
                          {ok ? "✓ CONFORME" : "⚠ SOUS-CIBLE"}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${ok ? "bg-emerald-500" : m.up ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min((m.value / (m.up ? 100 : 20)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm font-medium text-foreground mb-3">Volume de logs — tendance 24h</p>
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={HOURLY_LOGS} margin={{ left: -12, right: 4, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gConf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
                <XAxis dataKey="h" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="total" name="Total logs" stroke="#94a3b8" fill="url(#gConf)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Export block */}
      <div className="bg-card border border-amber-500/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4 text-amber-400" />
          <p className="text-sm font-semibold text-foreground">Génération de rapports</p>
          <span className="text-[10px] font-mono text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded ml-1">
            Seules actions disponibles pour ce rôle
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground font-mono mb-4">
          Exports limités au périmètre Audit &amp; Conformité — chaque téléchargement est journalisé dans l'audit log SIEM.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleExport("pdf")}
            disabled={!!exportState}
            className="flex items-center gap-3 p-4 bg-red-500/8 border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-60 disabled:cursor-wait text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
              {exportState === "pdf" ? (
                <div className="w-4 h-4 rounded-full border-2 border-red-500/30 border-t-red-400 animate-spin" />
              ) : (
                <FileText className="w-5 h-5 text-red-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Rapport PDF Périodique</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                {exportState === "pdf" ? "Génération en cours..." : "Rapport mensuel consolidé — juin 2026"}
              </p>
            </div>
          </button>

          <button
            onClick={() => handleExport("csv")}
            disabled={!!exportState}
            className="flex items-center gap-3 p-4 bg-emerald-500/8 border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/10 rounded-xl transition-all disabled:opacity-60 disabled:cursor-wait text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
              {exportState === "csv" ? (
                <div className="w-4 h-4 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
              ) : (
                <Download className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Exporter CSV / Excel</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                {exportState === "csv" ? "Préparation du fichier..." : "Données brutes filtrées — périmètre actuel"}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}