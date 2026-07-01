import { useEffect, useState } from "react";
import { Database, HardDrive, Check, Lock, Loader2 } from "lucide-react";
import { LineChart, Line, Tooltip, ResponsiveContainer } from "recharts";
import { adminApi, type InfraData } from "../../api/admin";

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

export default function InfraScreen() {
  const [data, setData] = useState<InfraData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.infra()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"));
  }, []);

  if (error) {
    return <div className="p-6 text-red-400 font-mono text-sm">Erreur : {error}</div>;
  }

  if (!data) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground font-mono text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Chargement infrastructure…
      </div>
    );
  }

  const clusterColor = data.cluster.status === "HEALTHY" ? "text-emerald-400" : "text-orange-400";
  const clusterBg = data.cluster.status === "HEALTHY" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-orange-500/15 text-orange-400 border-orange-500/25";
  const retention = data.retention.days;
  const retLabel = retention <= 30 ? "30 jours" : retention <= 180 ? "6 mois" : "1 an";
  const sealed = data.retention.sealed;
  const sealTs = data.retention.sealed_at;

  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-emerald-500/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Cluster Elasticsearch</p>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${clusterBg}`}>{data.cluster.status}</span>
          </div>
          <div className="flex items-center gap-3">
            <Database className={`w-7 h-7 ${clusterColor}`} />
            <div>
              <p className={`text-2xl font-bold font-mono ${clusterColor}`}>{data.cluster.active} / {data.cluster.total}</p>
              <p className="text-[10px] text-muted-foreground">nœuds actifs</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 text-[10px] font-mono text-muted-foreground space-y-0.5">
            {data.cluster.nodes.map((n) => (
              <p key={n.name}>
                <span className={n.status === "HEALTHY" ? "text-emerald-400" : "text-orange-400"}>●</span> {n.name} — {n.role}
              </p>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Espace Disque</p>
            <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-3 mb-3">
            <p className="text-3xl font-bold font-mono text-yellow-400">{data.storage.pct}%</p>
            <div className="text-[10px] text-muted-foreground font-mono">
              <p>{data.storage.used_tb} To utilisés</p>
              <p>sur {data.storage.total_tb} To total</p>
            </div>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-linear-to-r from-yellow-600 to-yellow-400 transition-all duration-700" style={{ width: `${data.storage.pct}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 font-mono">
            {data.storage.available_tb} To disponibles — Seuil alerte : {data.storage.alert_threshold_pct}%
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Débit d'ingestion (logs/s)</p>
          <ResponsiveContainer width="100%" height={72}>
            <LineChart data={data.ingestion.history.length ? data.ingestion.history : [{ t: "—", v: 0 }]} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
              <Line type="monotone" dataKey="v" stroke="#06b6d4" strokeWidth={2} dot={false} />
              <Tooltip content={<ChartTip />} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] font-mono text-muted-foreground mt-2">
            Actuel : <span className="text-cyan-400 font-bold">{data.ingestion.current.toLocaleString("fr-FR")} logs/s</span>
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-foreground">Politique de rétention des logs</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">Durée avant purge automatique de la base de données active</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <input type="range" min={30} max={365} step={1} value={retention} readOnly disabled
              className="w-full cursor-not-allowed accent-blue-500 h-1.5 opacity-70" />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1.5">
              <span>30 jours</span><span>6 mois</span><span>1 an</span>
            </div>
          </div>
          <div className="text-center min-w-22.5">
            <p className="text-xl font-bold font-mono text-blue-400">{retLabel}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{retention} jours</p>
          </div>
          <div
            className={`px-4 py-2.5 rounded-lg text-xs font-mono flex items-center gap-2 whitespace-nowrap ${
              sealed
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-secondary text-muted-foreground border border-border"
            }`}>
            {sealed
              ? <><Check className="w-3.5 h-3.5" /> Politique scellée</>
              : <><Lock className="w-3.5 h-3.5" /> Non scellée</>}
          </div>
        </div>
        {sealed && sealTs && (
          <div className="mt-4 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-lg flex items-start gap-2.5">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[10px] font-mono text-emerald-400/90 leading-relaxed">
              Politique scellée avec horodatage certifié{" "}
              <span className="text-emerald-300 font-bold">{sealTs}</span>
              {" "}— Durée de rétention configurée :{" "}
              <span className="font-bold">{retLabel} ({retention} jours)</span>
            </p>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">Journal d'Audit</p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              LECTURE SEULE ABSOLUE — Intégrité cryptographique garantie — Aucune modification ou suppression possible
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            IMMUTABLE LOG
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/10">
                {["Horodatage ISO 8601", "Utilisateur", "Action effectuée", "IP source"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] text-muted-foreground font-mono uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.audit_log.map((log, i) => (
                <tr key={i} className="border-b border-border/20 hover:bg-secondary/15 transition-colors">
                  <td className="px-5 py-3 text-[10px] font-mono text-slate-700 whitespace-nowrap">{log.ts}</td>
                  <td className="px-5 py-3 text-[11px] font-mono">
                    <span className={log.user === "SYSTEM" ? "text-violet-400" : "text-cyan-400"}>{log.user}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-foreground/75">{log.action}</td>
                  <td className="px-5 py-3 text-[10px] font-mono text-orange-300/60">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
