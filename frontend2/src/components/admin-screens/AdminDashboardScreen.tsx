import { AlertTriangle, Bell, Zap, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const TREND_DATA = [
  { t: "00h", c: 2, h: 5, m: 12 }, { t: "02h", c: 1, h: 3, m: 8 },
  { t: "04h", c: 0, h: 2, m: 6 },  { t: "06h", c: 3, h: 7, m: 15 },
  { t: "08h", c: 5, h: 12, m: 23 },{ t: "10h", c: 8, h: 18, m: 31 },
  { t: "12h", c: 6, h: 14, m: 28 },{ t: "14h", c: 9, h: 20, m: 35 },
  { t: "16h", c: 7, h: 16, m: 29 },{ t: "18h", c: 4, h: 11, m: 24 },
  { t: "20h", c: 5, h: 13, m: 27 },{ t: "22h", c: 3, h: 8, m: 19 },
];

const INCIDENTS = [
  { id: "INC-2851", title: "Force Brute sur compte admin_prod", sev: "CRITICAL", status: "Ouvert", src: "185.220.101.47", time: "14:58" },
  { id: "INC-2850", title: "Élévation de privilèges détectée", sev: "CRITICAL", status: "En cours", src: "10.10.5.23", time: "14:51" },
  { id: "INC-2849", title: "Scan de ports LAN interne", sev: "HIGH", status: "En cours", src: "10.10.8.102", time: "14:22" },
  { id: "INC-2848", title: "Connexion depuis nœud TOR", sev: "HIGH", status: "Ouvert", src: "185.107.47.215", time: "13:45" },
  { id: "INC-2847", title: "Exfiltration DNS suspecte", sev: "HIGH", status: "Résolu", src: "10.10.3.77", time: "13:12" },
];

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
};

function StatusPill({ s }: { s: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[s] ?? "bg-slate-500"}`} />
      <span className="text-[11px] font-mono text-muted-foreground">{s}</span>
    </span>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#090e1b] border border-[#1a2540] rounded-md px-3 py-2 text-[11px] font-mono shadow-xl">
      <p className="text-slate-700 mb-1 pb-1 border-b border-[#1a2540]">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.stroke ?? p.fill ?? p.color }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function DashboardScreen() {
  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Incidents Actifs", value: "14", sub: "dont 2 critiques", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "Alertes (24h)", value: "847", sub: "+12 % vs hier", icon: Bell, color: "text-orange-400", bg: "bg-orange-500/10" },
          { label: "Débit ingestion", value: "2 341", sub: "logs / seconde", icon: Zap, color: "text-cyan-400", bg: "bg-cyan-500/10" },
          { label: "MTTR moyen", value: "38 min", sub: "7 incidents résolus", icon: Clock, color: "text-violet-400", bg: "bg-violet-500/10" },
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
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-yellow-400" /> Medium</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={TREND_DATA} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
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
            {[
              { label: "CRITIQUE", count: 2, pct: 14, bar: "bg-red-500", text: "text-red-400" },
              { label: "HIGH", count: 5, pct: 36, bar: "bg-orange-500", text: "text-orange-400" },
              { label: "WARNING", count: 7, pct: 50, bar: "bg-yellow-500", text: "text-yellow-400" },
            ].map((r) => (
              <div key={r.label}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[10px] font-mono text-muted-foreground">{r.label}</span>
                  <span className={`text-sm font-bold font-mono ${r.text}`}>{r.count}</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${r.bar}`} style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <p className="text-sm font-medium">Incidents récents</p>
          <span className="text-[10px] font-mono text-muted-foreground">Mis à jour il y a 12 s</span>
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
            {INCIDENTS.map((inc, i) => (
              <tr key={inc.id} className={`border-b border-border/30 hover:bg-secondary/40 ${i === 0 ? "bg-red-500/5" : ""}`}>
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