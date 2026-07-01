import { useEffect, useState } from "react";
import { Terminal, RefreshCw, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { adminApi, type LogSearchData } from "../../api/admin";

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { stroke?: string; fill?: string; color?: string; name?: string; value?: number; dataKey?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#090e1b] border border-[#1a2540] rounded-md px-3 py-2 text-[11px] font-mono shadow-xl">
      <p className="text-slate-700 mb-1 pb-1 border-b border-[#1a2540]">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.stroke ?? p.fill ?? p.color }}>
          {p.name ?? p.dataKey}:{" "}
          <span className="font-semibold">{typeof p.value === "number" ? p.value.toLocaleString("fr-FR") : p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("24h");
  const [data, setData] = useState<LogSearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runSearch = (q: string, r: string) => {
    setLoading(true);
    setError(null);
    adminApi.searchLogs(q, r)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    runSearch("", "24h");
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="bg-card border border-cyan-500 rounded-xl p-3.5 flex items-center gap-3 focus-within:border-cyan-400 transition-colors">
        <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />
        <input
          className="flex-1 bg-transparent text-sm font-mono text-cyan-400 outline-none placeholder:text-cyan-300 font-semibold"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch(query, range)}
          placeholder='event_type:AUTH_FAILED src_ip:203.0.113.47 user:jeremy'
        />
        <div className="flex items-center gap-1 shrink-0">
          {["1h", "6h", "24h", "7j", "30j"].map((t) => (
            <button key={t} onClick={() => { setRange(t); runSearch(query, t); }}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all ${range === t ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40" : "text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
          <button onClick={() => runSearch(query, range)}
            className="ml-2 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-mono rounded-lg transition-colors shadow">
            Rechercher
          </button>
        </div>
      </div>

      {error && <div className="text-red-400 font-mono text-sm">{error}</div>}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement des logs…
        </div>
      ) : data && (
        <>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Événements trouvés", value: data.stats.total_events.toLocaleString("fr-FR"), color: "text-cyan-400" },
              { label: "Sources uniques", value: String(data.stats.unique_sources), color: "text-blue-400" },
              { label: "Utilisateurs", value: String(data.stats.unique_users), color: "text-violet-400" },
              { label: "Règles déclenchées", value: String(data.stats.triggered_rules), color: "text-orange-400" },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{s.label}</p>
                <p className={`text-xl font-bold font-mono mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm font-medium text-foreground mb-3">Timeline — Volume d'événements</p>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={data.volume.length ? data.volume : [{ h: "—", v: 0 }]} barSize={16} margin={{ left: -10, right: 4, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" vertical={false} />
                <XAxis dataKey="h" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} width={40}
                  tickFormatter={(v) => `${v}`} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="v" name="Événements" fill="#06b6d4" opacity={0.75} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <p className="text-sm font-medium">
                Résultats <span className="text-muted-foreground text-[11px] font-mono">— {data.results.length} sur {data.stats.total_events.toLocaleString("fr-FR")}</span>
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
                  {data.results.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-xs font-mono text-muted-foreground">Aucun log trouvé</td>
                    </tr>
                  ) : data.results.map((r, i) => (
                    <tr key={i} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-2.5 text-[10px] font-mono text-slate-700 whitespace-nowrap">{r.ts.replace("T", " ").slice(0, 19)}</td>
                      <td className="px-4 py-2.5 text-[10px] font-mono text-orange-300">{r.src}</td>
                      <td className="px-4 py-2.5 text-[10px] font-mono text-slate-700">{r.dst}</td>
                      <td className="px-4 py-2.5 text-[10px] font-mono text-cyan-400 font-bold">{r.event}</td>
                      <td className="px-4 py-2.5 text-[10px] font-mono text-blue-300">{r.user}</td>
                      <td className="px-4 py-2.5 text-[10px] text-muted-foreground max-w-50 truncate">{r.detail}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-mono ${r.sev === "CRITICAL" ? "text-red-400" : r.sev === "HIGH" ? "text-orange-400" : "text-yellow-400"}`}>{r.sev}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
