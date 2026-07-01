import { useEffect, useState } from "react";
import type { ElementType } from "react";
import { AlertCircle, AlertTriangle, Clock, Lock, RefreshCw, TrendingUp } from "lucide-react";
import { lecteurApi, type LecteurUebaData } from "../../api/lecteur";

function ReadOnlyTag() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-600 border border-slate-800 rounded px-1.5 py-0.5 select-none">
      <Lock className="w-2.5 h-2.5" /> LECTURE SEULE
    </span>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="m-5 bg-red-500/10 border border-red-500/30 rounded-xl p-5">
      <div className="flex items-center gap-2 text-red-300 font-mono text-sm">
        <AlertTriangle className="w-4 h-4" />
        Impossible de charger les donnees UEBA depuis PostgreSQL.
      </div>
      <p className="text-xs text-red-200/70 font-mono mt-2">{message}</p>
      <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 text-xs font-mono text-red-200 hover:bg-red-500/10">
        <RefreshCw className="w-3 h-3" /> Reessayer
      </button>
    </div>
  );
}

export default function LecteurUEBAScreen() {
  const [data, setData] = useState<LecteurUebaData | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    lecteurApi.ueba()
      .then((payload) => {
        setData(payload);
        setSelectedUser((current) => current && payload.rows.some((row) => row.user === current) ? current : payload.rows[0]?.user ?? null);
      })
      .catch((err: unknown) => {
        setData(null);
        setSelectedUser(null);
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div className="p-5 text-xs font-mono text-muted-foreground">Chargement UEBA depuis PostgreSQL...</div>;
  }

  if (error || !data) {
    return <ErrorPanel message={error ?? "Reponse vide de l'API lecteur."} onRetry={load} />;
  }

  const rows = data.rows;
  const selected = selectedUser ? rows.find((u) => u.user === selectedUser) ?? null : null;
  const riskyRows = rows.filter((u) => u.score >= 50);
  const modelVersions = Array.from(new Set(rows.map((r) => r.model_version).filter(Boolean)));

  const scoreClass = (score: number) =>
    score >= 80 ? "text-red-400" : score >= 50 ? "text-orange-400" : score >= 30 ? "text-yellow-400" : "text-emerald-400";

  const barClass = (score: number) =>
    score >= 80
      ? "bg-gradient-to-r from-red-600 to-red-400"
      : score >= 50
        ? "bg-gradient-to-r from-orange-600 to-orange-400"
        : score >= 30
          ? "bg-gradient-to-r from-yellow-600 to-yellow-400"
          : "bg-gradient-to-r from-emerald-600 to-emerald-400";

  return (
    <div className="p-5 space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground font-mono">
          <span className="text-foreground font-semibold">{data.stats.monitored}</span> entites surveillees
          <span className="mx-2 text-border">.</span>
          <span className="text-red-400 font-semibold">{data.stats.critical}</span> score critique
          <span className="mx-2 text-border">.</span>
          <span className="text-orange-400 font-semibold">{data.stats.anomalies_7d}</span> anomalies 7j
        </p>
        <ReadOnlyTag />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/10 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Scoring de risque dynamique - Utilisateurs</p>
            <span className="text-[10px] font-mono text-muted-foreground">
              {modelVersions.length ? modelVersions.join(", ") : "Version modele non renseignee"} - PostgreSQL
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                {["Utilisateur", "Score", "Jauge de risque", "Derniere act.", "Delta 24h", "Anomalies"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] text-muted-foreground font-mono uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const isSelected = selectedUser === u.user;
                return (
                  <tr
                    key={u.user}
                    onClick={() => setSelectedUser(isSelected ? null : u.user)}
                    className={`border-b border-border/30 transition-colors cursor-pointer ${isSelected ? "bg-amber-600/8 border-r-2 border-r-amber-500/40" : "hover:bg-secondary/25"}`}
                  >
                    <td className="px-4 py-3 text-xs font-mono text-blue-300 font-bold">{u.user}</td>
                    <td className="px-4 py-3">
                      <span className={`text-lg font-bold font-mono ${scoreClass(u.score)}`}>{u.score}</span>
                      <span className="text-slate-600 text-xs font-mono">/100</span>
                    </td>
                    <td className="px-4 py-3 w-28">
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full ${barClass(u.score)} rounded-full transition-all`} style={{ width: `${u.score}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{u.last}</td>
                    <td className={`px-4 py-3 text-[11px] font-mono ${u.delta.startsWith("+") ? "text-orange-400" : "text-muted-foreground"}`}>{u.delta}</td>
                    <td className="px-4 py-3">
                      {u.anomalies > 0 ? (
                        <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded">
                          {u.anomalies} anomalie{u.anomalies > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-emerald-400">Aucune</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs font-mono text-muted-foreground">
                    Aucun score UEBA retourne par PostgreSQL.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3">
          {selected ? (
            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-mono text-blue-300 font-bold">{selected.user}</p>
                  <ReadOnlyTag />
                </div>
                <p className="text-[10px] font-mono text-muted-foreground">
                  Score {selected.score}/100 - {selected.model_version || "Version modele non renseignee"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Metric icon={Clock} label="Derniere activite" value={selected.last} />
                <Metric icon={TrendingUp} label="Delta 24h" value={selected.delta} />
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Synthese comportementale</p>
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/20 text-xs font-mono text-foreground/80">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-orange-400 mt-0.5" />
                  <span>{selected.detail}</span>
                </div>
              </div>
              <div className="pt-3 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600">
                  <Lock className="w-2.5 h-2.5" />
                  Investigation approfondie - Role Analyste requis
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border/50 rounded-xl p-4 flex items-center justify-center" style={{ minHeight: 180 }}>
              <p className="text-xs font-mono text-muted-foreground text-center leading-relaxed">
                Selectionner un utilisateur
                <br />
                pour voir les donnees UEBA PostgreSQL
              </p>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Entites a risque</p>
            <div className="space-y-2">
              {riskyRows.map((u) => (
                <button key={u.user} onClick={() => setSelectedUser(u.user)} className="w-full flex items-center gap-2 text-left">
                  <div className={`w-1.5 h-5 rounded-full shrink-0 ${u.score >= 80 ? "bg-red-500" : "bg-orange-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono text-foreground/80 truncate">{u.user}</p>
                    <p className="text-[9px] font-mono text-muted-foreground">{u.anomalies} anomalie{u.anomalies > 1 ? "s" : ""}</p>
                  </div>
                  <span className={`text-xs font-bold font-mono ${scoreClass(u.score)}`}>{u.score}</span>
                </button>
              ))}
              {riskyRows.length === 0 && (
                <p className="text-xs font-mono text-muted-foreground">Aucune entite a risque retournee par PostgreSQL.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-foreground">Syntheses UEBA - Consultation simple</p>
          <ReadOnlyTag />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {rows.map((u) => (
            <button
              key={u.user}
              onClick={() => setSelectedUser(u.user)}
              className="flex flex-col gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-secondary/10 text-left hover:bg-secondary/25 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <AlertCircle className={`w-3 h-3 shrink-0 ${scoreClass(u.score)}`} />
                <span className="text-[10px] font-mono font-semibold leading-tight text-foreground/80">{u.user}</span>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground line-clamp-2">{u.detail}</span>
            </button>
          ))}
          {rows.length === 0 && (
            <p className="col-span-3 text-xs font-mono text-muted-foreground">Aucune synthese UEBA retournee par PostgreSQL.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="border border-border/50 rounded-lg px-3 py-2 bg-secondary/10">
      <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <p className="mt-1 text-xs font-mono text-foreground/80">{value}</p>
    </div>
  );
}
