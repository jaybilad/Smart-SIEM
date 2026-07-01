import { useEffect, useState } from "react";
import { Play, ChevronRight } from "lucide-react";
import { socApi, type SocPlaybookRow } from "../../api/soc";

function SevBadge({ s }: { s: string }) {
  const colors: Record<string, string> = {
    CRITICAL: "bg-red-500/15 text-red-400 border border-red-500/30",
    HIGH: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
    WARNING: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
    INFO: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold tracking-widest ${colors[s] ?? colors.INFO}`}>
      {s === "CRITICAL" && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
      {s}
    </span>
  );
}

export default function SOCSOARScreen() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [playbooks, setPlaybooks] = useState<SocPlaybookRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    socApi.playbooks()
      .then((data) => setPlaybooks(data))
      .catch(() => setPlaybooks([]))
      .finally(() => setLoading(false));
  }, []);

  const SEV_CARD: Record<string, string> = {
    CRITICAL: "border-red-500/25 hover:border-red-500/50",
    HIGH: "border-orange-500/20 hover:border-orange-500/45",
    WARNING: "border-yellow-500/15 hover:border-yellow-500/40",
    INFO: "border-blue-500/15 hover:border-blue-500/40",
  };

  return (
    <div className="p-5 space-y-4 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Catalogue SOAR — Playbooks disponibles</p>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
            Données chargées depuis PostgreSQL local — règles liées aux playbooks incluses
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {loading ? "Chargement..." : `${playbooks.length} playbooks actifs`}
        </div>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm font-mono text-muted-foreground">
          Chargement des playbooks depuis PostgreSQL...
        </div>
      ) : playbooks.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm font-mono text-muted-foreground">
          Aucun playbook disponible dans la base locale.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {playbooks.map((pb) => (
            <div key={pb.id}
              className={`bg-card border rounded-xl p-5 transition-all cursor-default ${SEV_CARD[pb.sev] ?? "border-border"}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <SevBadge s={pb.sev} />
                    {pb.auto && (
                      <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">AUTO</span>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">{pb.name}</h4>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{pb.desc}</p>

              <button onClick={() => setExpanded(expanded === pb.id ? null : pb.id)}
                className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors mb-3">
                <ChevronRight className={`w-3 h-3 transition-transform ${expanded === pb.id ? "rotate-90" : ""}`} />
                {pb.rules.length} règle{pb.rules.length > 1 ? "s" : ""} liée{pb.rules.length > 1 ? "s" : ""}
              </button>

              {expanded === pb.id && (
                <div className="mb-3 space-y-1 pl-3 border-l border-border/60">
                  {pb.rules.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground">Aucune règle associée en base.</div>
                  ) : pb.rules.map((rule, i) => (
                    <div key={rule} className="flex items-start gap-2 text-[10px] text-muted-foreground">
                      <span className="text-[9px] font-mono text-slate-600 shrink-0">{String(i + 1).padStart(2, "0")}.</span>
                      {rule}
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-border/50 pt-3 flex items-center justify-between">
                <div className="text-[10px] font-mono text-muted-foreground space-y-0.5">
                  <p>{pb.triggers} déclenchements</p>
                  <p>Dernier run: {pb.lastRun}</p>
                </div>
                <button
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono rounded-lg transition-colors ${
                    pb.sev === "CRITICAL"
                      ? "bg-red-600/80 hover:bg-red-500 text-white"
                      : pb.sev === "HIGH"
                      ? "bg-orange-600/80 hover:bg-orange-500 text-white"
                      : "bg-blue-600/80 hover:bg-blue-500 text-white"
                  }`}>
                  <Play className="w-3.5 h-3.5" /> Déclencher
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
