import { useState } from "react";
import { Terminal, RefreshCw, Filter } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const VOLUME_DATA = [
  { h: "00h", v: 8420 }, { h: "02h", v: 5230 }, { h: "04h", v: 3810 },
  { h: "06h", v: 7650 }, { h: "08h", v: 18420 },{ h: "10h", v: 24300 },
  { h: "12h", v: 21800 },{ h: "14h", v: 28900 },{ h: "16h", v: 22100 },
  { h: "18h", v: 19500 },{ h: "20h", v: 20300 },{ h: "22h", v: 14200 },
];

const SEARCH_ROWS = [
  { ts: "2026-06-22T14:58:01Z", src: "185.220.101.47", dst: "10.0.1.80",    event: "AUTH_FAILURE",   user: "admin_prod",  detail: "SSH — mot de passe invalide (tentative 8/8)",   sev: "CRITICAL" },
  { ts: "2026-06-22T14:58:00Z", src: "185.220.101.47", dst: "10.0.1.80",    event: "AUTH_FAILURE",   user: "admin_prod",  detail: "SSH — mot de passe invalide (tentative 7/8)",   sev: "CRITICAL" },
  { ts: "2026-06-22T14:57:59Z", src: "185.220.101.47", dst: "10.0.1.80",    event: "AUTH_FAILURE",   user: "admin_prod",  detail: "SSH — mot de passe invalide (tentative 6/8)",   sev: "CRITICAL" },
  { ts: "2026-06-22T14:51:23Z", src: "10.10.5.23",     dst: "10.0.1.1",     event: "PRIV_ESCALATION",user: "svc_backup",  detail: "sudo /bin/bash exécuté — UID 0 acquis",         sev: "CRITICAL" },
  { ts: "2026-06-22T14:22:15Z", src: "10.10.8.102",    dst: "10.10.0.0/24", event: "PORT_SCAN",      user: "N/A",         detail: "SYN scan — 1 024 ports / 30s détectés",         sev: "HIGH"     },
  { ts: "2026-06-22T13:45:08Z", src: "185.107.47.215", dst: "10.0.2.15",    event: "AUTH_SUCCESS",   user: "j.bernard",   detail: "Connexion réussie depuis nœud TOR sortant",     sev: "HIGH"     },
  { ts: "2026-06-22T13:12:44Z", src: "10.10.3.77",     dst: "45.33.32.156", event: "DNS_TUNNEL",     user: "N/A",         detail: "Requêtes DNS encodées — 200/5 min détectées",   sev: "HIGH"     },
];

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#090e1b] border border-[#1a2540] rounded-md px-3 py-2 text-[11px] font-mono shadow-xl">
      <p className="text-slate-700 mb-1 pb-1 border-b border-[#1a2540]">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.stroke ?? p.fill ?? p.color }}>
          {p.name ?? p.dataKey}:{" "}
          <span className="font-semibold">{typeof p.value === "number" ? p.value.toLocaleString("fr-FR") : p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function SearchScreen() {
  const [query, setQuery] = useState("event_type:AUTH_FAILURE src_ip:185.220.101.47");
  const [range, setRange] = useState("24h");

  return (
    <div className="p-6 space-y-4">
      <div className="bg-card border border-cyan-500 rounded-xl p-3.5 flex items-center gap-3 focus-within:border-cyan-400 transition-colors">
        <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />
        <input
            className="flex-1 bg-transparent text-sm font-mono text-cyan-400 outline-none placeholder:text-cyan-300 font-semibold"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='event_type:AUTH_FAILURE src_ip:10.0.0.0/8 user:* timerange:24h'
            />
        <div className="flex items-center gap-1 shrink-0">
          {["1h", "6h", "24h", "7j", "30j"].map((t) => (
            <button key={t} onClick={() => setRange(t)}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all ${range === t ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40" : "text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
          <button className="ml-2 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-mono rounded-lg transition-colors shadow">
            Rechercher
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Événements trouvés",  value: "28 441", color: "text-cyan-400"   },
          { label: "Sources uniques",      value: "142",    color: "text-blue-400"   },
          { label: "Utilisateurs",         value: "31",     color: "text-violet-400" },
          { label: "Règles déclenchées",   value: "8",      color: "text-orange-400" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{s.label}</p>
            <p className={`text-xl font-bold font-mono mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm font-medium text-foreground mb-3">Timeline — Volume d'événements (24h)</p>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={VOLUME_DATA} barSize={16} margin={{ left: -10, right: 4, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" vertical={false} />
            <XAxis dataKey="h" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} width={40}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<ChartTip />} />
            <Bar dataKey="v" name="Événements" fill="#06b6d4" opacity={0.75} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <p className="text-sm font-medium">
            Résultats <span className="text-muted-foreground text-[11px] font-mono">— 7 sur 28 441</span>
          </p>
          <button className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
            <RefreshCw className="w-3 h-3" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/10">
                {["Horodatage", "Source", "Destination", "Type d'événement", "Utilisateur", "Détail", "Sev."].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] text-muted-foreground font-mono uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SEARCH_ROWS.map((r, i) => (
                <tr key={i} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5 text-[10px] font-mono text-slate-700 whitespace-nowrap">{r.ts.replace("T", " ").replace("Z", "")}</td>
                  <td className="px-4 py-2.5 text-[10px] font-mono text-orange-300">{r.src}</td>
                  <td className="px-4 py-2.5 text-[10px] font-mono text-slate-700">{r.dst}</td>
                  <td className="px-4 py-2.5 text-[10px] font-mono text-cyan-400 font-bold">{r.event}</td>
                  <td className="px-4 py-2.5 text-[10px] font-mono text-blue-300">{r.user}</td>
                  <td className="px-4 py-2.5 text-[10px] text-muted-foreground max-w-50 truncate">{r.detail}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] font-mono ${r.sev === "CRITICAL" ? "text-red-400" : "text-orange-400"}`}>{r.sev}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}