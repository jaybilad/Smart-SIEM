import { useEffect, useState } from "react";
import { AlertTriangle, Filter, Lock, RefreshCw } from "lucide-react";
import { lecteurApi, type LecteurIncidentRow } from "../../api/lecteur";

const SEV_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border border-red-500/30",
  HIGH: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  WARNING: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  INFO: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
};

const STATUS_CHIP: Record<string, string> = {
  Ouvert: "bg-blue-500/12 text-blue-400 border border-blue-500/25",
  "En cours": "bg-orange-500/12 text-orange-400 border border-orange-500/25",
  Resolu: "bg-emerald-500/12 text-emerald-400 border border-emerald-500/25",
  "Cloture": "bg-emerald-500/12 text-emerald-400 border border-emerald-500/25",
};

function SevBadge({ s }: { s: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold tracking-widest ${SEV_BADGE[s] ?? SEV_BADGE.INFO}`}>
      {s === "CRITICAL" && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
      {s}
    </span>
  );
}

function StatusChip({ s }: { s: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono ${STATUS_CHIP[s] ?? "text-slate-400 border border-slate-700"}`}>{s}</span>;
}

function ReadOnlyTag() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-600 border border-slate-800 rounded px-1.5 py-0.5 select-none">
      <Lock className="w-2.5 h-2.5" /> LECTURE SEULE
    </span>
  );
}

function DisabledBtn({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono opacity-35 cursor-not-allowed bg-secondary/20 border border-border/40 text-slate-500 rounded-lg select-none" title="403 - Acces refuse">
      <Lock className="w-3 h-3 shrink-0" />
      {label}
    </div>
  );
}

export default function LecteurIncidentScreen() {
  const [incidents, setIncidents] = useState<LecteurIncidentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortBySev, setSortBySev] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    lecteurApi.incidents()
      .then((rows) => {
        setIncidents(rows);
        setSelectedId(rows[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        setIncidents([]);
        setSelectedId(null);
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const sorted = sortBySev
    ? [...incidents].sort((a, b) => {
        const order = { CRITICAL: 0, HIGH: 1, WARNING: 2, INFO: 3 };
        return (order[a.sev as keyof typeof order] ?? 4) - (order[b.sev as keyof typeof order] ?? 4);
      })
    : incidents;

  const selected = selectedId ? incidents.find((i) => i.id === selectedId) ?? null : null;

  if (loading) {
    return <div className="p-5 text-xs font-mono text-muted-foreground">Chargement des incidents depuis PostgreSQL...</div>;
  }

  if (error) {
    return (
      <div className="m-5 bg-red-500/10 border border-red-500/30 rounded-xl p-5">
        <div className="flex items-center gap-2 text-red-300 font-mono text-sm">
          <AlertTriangle className="w-4 h-4" /> Impossible de charger les incidents depuis PostgreSQL.
        </div>
        <p className="text-xs text-red-200/70 font-mono mt-2">{error}</p>
        <button onClick={load} className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 text-xs font-mono text-red-200 hover:bg-red-500/10">
          <RefreshCw className="w-3 h-3" /> Reessayer
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden pb-6">
      <div className="w-85 shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary/10 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ReadOnlyTag />
            <span className="text-[10px] font-mono text-muted-foreground">{incidents.length} incidents</span>
          </div>
          <button onClick={() => setSortBySev(!sortBySev)} className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <Filter className="w-2.5 h-2.5" /> {sortBySev ? "Severite" : "Date"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sorted.map((inc) => {
            const isSelected = selectedId === inc.id;
            const border = inc.sev === "CRITICAL" ? "border-l-red-500" : inc.sev === "HIGH" ? "border-l-orange-500" : inc.sev === "WARNING" ? "border-l-yellow-500" : "border-l-blue-500/40";
            return (
              <button key={inc.id} onClick={() => setSelectedId(inc.id)} className={`w-full text-left px-4 py-3.5 border-b border-border/50 border-l-2 transition-all ${border} ${isSelected ? "bg-amber-600/8 border-r-2 border-r-amber-500/40" : "hover:bg-secondary/30"}`}>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <span className="text-[10px] font-mono text-blue-400 font-bold shrink-0">{inc.id}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <SevBadge s={inc.sev} />
                    <StatusChip s={inc.status} />
                  </div>
                </div>
                <p className="text-xs text-foreground/90 font-medium leading-tight mb-1.5 line-clamp-2">{inc.title}</p>
                <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                  <span>{inc.src}</span>
                  <span className="text-border">.</span>
                  <span>{inc.time}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center flex-wrap gap-2 mb-1.5">
                  <span className="text-[11px] font-mono text-blue-400 font-bold">{selected.id}</span>
                  <SevBadge s={selected.sev} />
                  <StatusChip s={selected.status} />
                  <ReadOnlyTag />
                </div>
                <h2 className="text-base font-semibold text-foreground">{selected.title}</h2>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">{selected.created_at ? selected.created_at.replace("T", " ").slice(0, 16) : selected.time}</span>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
              {[
                ["Regle declenchee", selected.rule],
                ["IP source", selected.src],
                ["Cible", selected.target],
                ["Analyste assigne", selected.assignee ?? "Non assigne"],
                ["Description", selected.description],
              ].map(([k, v]) => (
                <div key={k} className={k === "Description" ? "col-span-2" : ""}>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{k}</p>
                  <p className="font-mono text-foreground/80">{v}</p>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-3.5 h-3.5 text-slate-600" />
                <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">Actions de statut - 403 Acces refuse</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <DisabledBtn label="Prendre en charge" />
                <DisabledBtn label="Changer le statut" />
                <DisabledBtn label="Cloturer" />
                <DisabledBtn label="Faux positif" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm font-mono">Aucun incident retourne par PostgreSQL</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
