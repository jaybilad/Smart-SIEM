import { useState } from "react";
import { Database, HardDrive, Check, Lock} from "lucide-react";
import { LineChart, Line, Tooltip, ResponsiveContainer } from "recharts";

const INGEST_DATA = [
  { t: "14:50", v: 1240 }, { t: "14:51", v: 1890 }, { t: "14:52", v: 1560 },
  { t: "14:53", v: 2340 }, { t: "14:54", v: 1780 }, { t: "14:55", v: 2100 },
  { t: "14:56", v: 1650 }, { t: "14:57", v: 2890 }, { t: "14:58", v: 2200 },
  { t: "14:59", v: 1980 },
];

const AUDIT_LOG = [
  { ts: "2026-06-22T14:55:31.204Z", user: "l.santos", action: "Connexion réussie depuis session CLI",                     ip: "10.0.1.45"    },
  { ts: "2026-06-22T14:48:17.891Z", user: "j.martin", action: "Modification du rôle de k.ibrahim → Inactif",             ip: "10.0.1.12"    },
  { ts: "2026-06-22T14:33:02.445Z", user: "j.martin", action: "Connexion réussie",                                        ip: "10.0.1.12"    },
  { ts: "2026-06-22T13:22:58.103Z", user: "l.santos", action: "Clôture alerte INC-2847 (Force Brute — Résolu)",           ip: "10.0.1.45"    },
  { ts: "2026-06-22T12:10:44.778Z", user: "j.martin", action: "Création règle : \"Connexion Hors Horaires\"",             ip: "10.0.1.12"    },
  { ts: "2026-06-22T11:55:19.332Z", user: "a.dupont", action: "Consultation logs Filiale Europe (2 847 événements)",      ip: "192.168.10.33"},
  { ts: "2026-06-22T11:02:05.667Z", user: "j.martin", action: "Modification politique de rétention → 365 jours",         ip: "10.0.1.12"    },
  { ts: "2026-06-22T10:34:22.119Z", user: "l.santos", action: "Création utilisateur p.novak (Lecteur / Filiale Europe)",  ip: "10.0.1.45"    },
  { ts: "2026-06-22T09:45:08.902Z", user: "j.martin", action: "Désactivation règle ID-3 (Exfiltration DNS)",              ip: "10.0.1.12"    },
  { ts: "2026-06-22T08:30:00.000Z", user: "SYSTEM",   action: "Purge automatique des logs > 365j (148 Go libérés)",      ip: "127.0.0.1"    },
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

export default function InfraScreen() {
  const [retention, setRetention] = useState(365);
  const [sealed, setSealed] = useState(false);
  const [sealTs, setSealTs] = useState("");

  const retLabel = retention <= 30 ? "30 jours" : retention <= 180 ? "6 mois" : "1 an";

  const handleSeal = () => {
    setSealTs(new Date().toISOString());
    setSealed(true);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-emerald-500/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Cluster Elasticsearch</p>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">HEALTHY</span>
          </div>
          <div className="flex items-center gap-3">
            <Database className="w-7 h-7 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold font-mono text-emerald-400">3 / 3</p>
              <p className="text-[10px] text-muted-foreground">nœuds actifs</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 text-[10px] font-mono text-muted-foreground space-y-0.5">
            <p><span className="text-emerald-400">●</span> node-01 — data-master</p>
            <p><span className="text-emerald-400">●</span> node-02 — data</p>
            <p><span className="text-emerald-400">●</span> node-03 — data</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Espace Disque</p>
            <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-3 mb-3">
            <p className="text-3xl font-bold font-mono text-yellow-400">45%</p>
            <div className="text-[10px] text-muted-foreground font-mono">
              <p>4,5 To utilisés</p>
              <p>sur 10 To total</p>
            </div>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-linear-to-r from-yellow-600 to-yellow-400 transition-all duration-700" style={{ width: "45%" }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 font-mono">5,5 To disponibles — Seuil alerte : 80%</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Débit d'ingestion (logs/s)</p>
          <ResponsiveContainer width="100%" height={72}>
            <LineChart data={INGEST_DATA} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
              <Line type="monotone" dataKey="v" stroke="#06b6d4" strokeWidth={2} dot={false} />
              <Tooltip content={<ChartTip />} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] font-mono text-muted-foreground mt-2">
            Actuel : <span className="text-cyan-400 font-bold">1 980 logs/s</span>
            <span className="ml-2 text-emerald-400">↑ normal</span>
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
            <input type="range" min={30} max={365} step={1} value={retention}
              onChange={(e) => { setRetention(parseInt(e.target.value)); setSealed(false); }}
              className="w-full cursor-pointer accent-blue-500 h-1.5" />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1.5">
              <span>30 jours</span><span>6 mois</span><span>1 an</span>
            </div>
          </div>
          <div className="text-center min-w-22.5">
            <p className="text-xl font-bold font-mono text-blue-400">{retLabel}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{retention} jours</p>
          </div>
          <button onClick={handleSeal}
            className={`px-4 py-2.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-2 whitespace-nowrap ${
              sealed
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow"
            }`}>
            {sealed
              ? <><Check className="w-3.5 h-3.5" /> Politique scellée</>
              : <><Lock className="w-3.5 h-3.5" /> Appliquer &amp; Sceller</>}
          </button>
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
              {AUDIT_LOG.map((log, i) => (
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