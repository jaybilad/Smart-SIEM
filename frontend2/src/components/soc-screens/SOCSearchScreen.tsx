import { useEffect, useMemo, useRef, useState } from "react";
import { Terminal, RefreshCw, Crosshair, X, ExternalLink, Link2, ChevronDown, Eye, Flag } from "lucide-react";
import { socApi, type SocAlertRow, type SocIncidentRow, type SocLogRow, type SocLogSearchData } from "../../api/soc";

// ==============================================================================
// TYPES
// ==============================================================================
type PivotField = "src" | "dst" | "user";
type Pivot = { field: PivotField; value: string } | null;

// ==============================================================================
// HELPERS D'AFFICHAGE
// ==============================================================================

const SEV_DOT: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  WARNING: "#eab308",
  INFO: "#3b82f6",
};

function SevBadge({ s }: { s: string }) {
  const colors: Record<string, string> = {
    CRITICAL: "text-red-400",
    HIGH: "text-orange-400",
    WARNING: "text-yellow-400",
    INFO: "text-blue-400",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold ${colors[s] ?? colors.INFO}`}>
      {s === "CRITICAL" && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
      {s}
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Ouvert",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolu",
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: "text-red-400 border-red-500/40 bg-red-500/10",
  IN_PROGRESS: "text-orange-400 border-orange-500/40 bg-orange-500/10",
  RESOLVED: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
};

/** Champ de l'événement API vers lequel un pivot se traduit dans la syntaxe de requête */
const PIVOT_QUERY_FIELD: Record<PivotField, string> = {
  src: "src_ip",
  dst: "dst_ip",
  user: "user",
};

/** Petit bouton de pivot réutilisable, à côté d'une valeur de log (source, destination, utilisateur) */
function PivotButton({
  field,
  value,
  active,
  onToggle,
}: {
  field: PivotField;
  value: string;
  active: boolean;
  onToggle: (field: PivotField, value: string) => void;
}) {
  if (!value || value === "—") return <span>{value}</span>;
  return (
    <button
      onClick={() => onToggle(field, value)}
      title={active ? "Retirer le pivot" : "Pivoter sur cette valeur"}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
        active
          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50"
          : "hover:bg-secondary/40 border border-transparent"
      }`}
    >
      <span>{value}</span>
      <Crosshair className={`w-2.5 h-2.5 shrink-0 ${active ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`} />
    </button>
  );
}

// ==============================================================================
// COMPOSANT PRINCIPAL
// ==============================================================================

export default function SOCSearchScreen() {
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("24h");
  const [pivot, setPivot] = useState<Pivot>(null);

  // --- Données réelles (API) ---
  const [events, setEvents] = useState<SocLogRow[]>([]);
  const [stats, setStats] = useState<SocLogSearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  const [alerts, setAlerts] = useState<SocAlertRow[]>([]);
  const [incidents, setIncidents] = useState<SocIncidentRow[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [assigningAlert, setAssigningAlert] = useState<string | null>(null);

  const [timelineSel, setTimelineSel] = useState<string | null>(null);
  const [inspectEvent, setInspectEvent] = useState<SocLogRow | null>(null);

  const logsSectionRef = useRef<HTMLDivElement | null>(null);

  // La requête envoyée à l'API combine le texte libre tapé par l'analyste
  // et le pivot actif (ex: clic sur une IP source dans la table ou dans une alerte).
  const effectiveQuery = useMemo(() => {
    const parts = [query.trim()];
    if (pivot) parts.push(`${PIVOT_QUERY_FIELD[pivot.field]}:${pivot.value}`);
    return parts.filter(Boolean).join(" ");
  }, [query, pivot]);

  useEffect(() => {
    setLoading(true);
    socApi.searchLogs(effectiveQuery, range)
      .then((data) => {
        setEvents(data.results);
        setStats(data);
      })
      .catch(() => {
        setEvents([]);
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, [effectiveQuery, range]);

  const refreshAlerts = () => {
    setAlertsLoading(true);
    Promise.all([socApi.alerts(), socApi.incidents()])
      .then(([alertData, incidentData]) => {
        setAlerts(alertData);
        setIncidents(incidentData);
        setAlertsError(null);
      })
      .catch((err: Error) => {
        setAlerts([]);
        setIncidents([]);
        setAlertsError(err.message);
      })
      .finally(() => setAlertsLoading(false));
  };

  useEffect(() => {
    refreshAlerts();
  }, []);

  const togglePivot = (field: PivotField, value: string) => {
    setPivot((current) => (current && current.field === field && current.value === value ? null : { field, value }));
  };

  const scrollToLogs = () => {
    logsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const viewAlertLogs = (alert: SocAlertRow) => {
    setPivot({ field: "src", value: alert.sourceIp });
    scrollToLogs();
  };

  const assignIncident = async (alertId: string, incidentId: string) => {
    try {
      const updated = await socApi.assignAlertIncident(alertId, incidentId);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
      setAssigningAlert(null);
      setAlertsError(null);
    } catch (err) {
      setAlertsError(err instanceof Error ? err.message : "Erreur API");
    }
  };

  const toggleFlag = (id: string) => {
    setFlagged((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const openInspector = (row: SocLogRow) => {
    setTimelineSel(row.id);
    setInspectEvent(row);
  };

  // Alertes : donnees API PostgreSQL, filtrees cote client selon le pivot actif.
  const filteredAlerts = useMemo(() => {
    if (!pivot) return alerts;
    if (pivot.field === "src") return alerts.filter((a) => a.sourceIp === pivot.value);
    if (pivot.field === "user") return alerts.filter((a) => a.user === pivot.value);
    return alerts; // pas de champ "destination" côté alertes
  }, [alerts, pivot]);

  // Stats calculées à partir des vraies données renvoyées par l'API
  const uniqueSources = useMemo(() => new Set(events.map((e) => e.src)).size, [events]);
  const uniqueUsers = useMemo(() => new Set(events.map((e) => e.user)).size, [events]);
  const openAlertsCount = useMemo(() => alerts.filter((a) => a.status === "OPEN").length, [alerts]);

  return (
    <div className="p-6 space-y-6">
      {/* ============================================================== */}
      {/* BARRE DE RECHERCHE */}
      {/* ============================================================== */}
      <div className="space-y-2">
        <div className="bg-card border border-cyan-500 rounded-xl p-3.5 flex items-center gap-3 focus-within:border-cyan-400 transition-colors">
          <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />
          <input
            className="flex-1 bg-transparent text-sm font-mono text-cyan-400 outline-none placeholder:text-cyan-300 font-semibold"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="event_type:AUTH_FAILED src_ip:203.0.113.47 user:jeremy"
          />
          <div className="flex items-center gap-1 shrink-0">
            {["1h", "6h", "24h", "7j", "30j"].map((t) => (
              <button
                key={t}
                onClick={() => setRange(t)}
                className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all ${
                  range === t
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
            <button
              onClick={() => { setLoading(true); socApi.searchLogs(effectiveQuery, range).then((data) => { setEvents(data.results); setStats(data); }).finally(() => setLoading(false)); }}
              className="ml-2 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-mono rounded-lg transition-colors shadow"
            >
              Rechercher
            </button>
          </div>
        </div>

        {/* Filtre pivot actif */}
        {pivot && (
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-muted-foreground">Pivot actif :</span>
            <span className="inline-flex items-center gap-1.5 bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 rounded-full px-2.5 py-1">
              {pivot.field === "src" ? "Source" : pivot.field === "dst" ? "Destination" : "Utilisateur"} = {pivot.value}
              <button onClick={() => setPivot(null)} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* STATS */}
      {/* ============================================================== */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Événements trouvés", value: loading ? "…" : String(stats?.stats.total_events ?? events.length), color: "text-cyan-400" },
          { label: "Sources uniques", value: loading ? "…" : String(uniqueSources), color: "text-blue-400" },
          { label: "Utilisateurs", value: loading ? "…" : String(uniqueUsers), color: "text-violet-400" },
          { label: "Alertes ouvertes", value: String(openAlertsCount), color: "text-orange-400" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{s.label}</p>
            <p className={`text-xl font-bold font-mono mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ============================================================== */}
      {/* TIMELINE EN BULLES — clic = ouvre l'inspecteur JSON */}
      {/* ============================================================== */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-foreground">Timeline interactive des événements</p>
          <p className="text-[10px] font-mono text-muted-foreground">Cliquer sur un point pour lire le document normalisé</p>
        </div>
        <div className="overflow-x-auto">
          <div className="relative" style={{ height: 80, minWidth: 560 }}>
            <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
            {events.map((e, i) => {
              const pct = (i / Math.max(events.length - 1, 1)) * 94 + 2;
              const isSel = timelineSel === e.id;
              return (
                <button
                  key={e.id}
                  onClick={() => openInspector(e)}
                  className={`absolute top-1/2 -translate-y-1/2 rounded-full transition-all hover:scale-150 focus:outline-none ${isSel ? "scale-150 ring-2 ring-white/40" : ""}`}
                  style={{
                    left: `${pct}%`,
                    width: 10,
                    height: 10,
                    backgroundColor: SEV_DOT[e.sev] ?? "#64748b",
                    boxShadow: `0 0 6px ${SEV_DOT[e.sev] ?? "#64748b"}`,
                  }}
                  title={`${e.event} — ${e.user}`}
                />
              );
            })}
            {events.length > 0 && (
              <>
                <span className="absolute bottom-0 left-0 text-[9px] font-mono text-muted-foreground">
                  {events[events.length - 1]?.ts.slice(11, 16)}
                </span>
                <span className="absolute bottom-0 right-0 text-[9px] font-mono text-muted-foreground">
                  {events[0]?.ts.slice(11, 16)}
                </span>
              </>
            )}
            {!loading && events.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-muted-foreground">
                Aucun événement pour ces critères
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[9px] font-mono text-muted-foreground">
          {Object.entries(SEV_DOT).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* ============================================================== */}
      {/* RÉSULTATS — LOGS (API réelle, avec pivots + flag + inspecteur JSON) */}
      {/* ============================================================== */}
      <div ref={logsSectionRef} className="bg-card border border-border rounded-xl overflow-hidden scroll-mt-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <p className="text-sm font-medium">
            Résultats{" "}
            <span className="text-muted-foreground text-[11px] font-mono">
              — {loading ? "…" : events.length} événement{events.length > 1 ? "s" : ""}
            </span>
            {flagged.size > 0 && (
              <span className="ml-2 text-[10px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded">
                {flagged.size} marqué{flagged.size > 1 ? "s" : ""}
              </span>
            )}
          </p>
          <button className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
            <RefreshCw className="w-3 h-3" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/10">
                {["", "Horodatage", "Source", "Destination", "Type d'événement", "Utilisateur", "Détail", "Sev.", "JSON"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] text-muted-foreground font-mono uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs font-mono text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs font-mono text-muted-foreground">
                    Aucun log trouvé
                  </td>
                </tr>
              ) : (
                events.map((r) => {
                  const isFlagged = flagged.has(r.id);
                  return (
                    <tr key={r.id} className={`group border-b border-border/20 hover:bg-secondary/20 transition-colors ${isFlagged ? "bg-orange-500/5 border-l-2 border-l-orange-500" : ""}`}>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => toggleFlag(r.id)}
                          className={`transition-colors ${isFlagged ? "text-orange-400" : "text-slate-700 hover:text-slate-400"}`}
                          title="Marquer"
                        >
                          <Flag className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-[10px] font-mono text-slate-500 whitespace-nowrap">
                        {r.ts.replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] font-mono text-orange-300">
                        <PivotButton field="src" value={r.src} active={pivot?.field === "src" && pivot.value === r.src} onToggle={togglePivot} />
                      </td>
                      <td className="px-4 py-2.5 text-[10px] font-mono text-slate-500">
                        <PivotButton field="dst" value={r.dst} active={pivot?.field === "dst" && pivot.value === r.dst} onToggle={togglePivot} />
                      </td>
                      <td className="px-4 py-2.5 text-[10px] font-mono text-cyan-400 font-bold">{r.event}</td>
                      <td className="px-4 py-2.5 text-[10px] font-mono text-blue-300">
                        <PivotButton field="user" value={r.user} active={pivot?.field === "user" && pivot.value === r.user} onToggle={togglePivot} />
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-muted-foreground max-w-50 truncate">{r.detail}</td>
                      <td className="px-4 py-2.5">
                        <SevBadge s={r.sev} />
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => openInspector(r)}
                          className="text-[10px] font-mono text-slate-500 hover:text-cyan-400 flex items-center gap-1 transition-colors whitespace-nowrap"
                        >
                          <Eye className="w-3 h-3" /> Lire
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================== */}
      {/* ALERTES */}
      {/* ============================================================== */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <p className="text-sm font-medium">
            Alertes{" "}
            <span className="text-muted-foreground text-[11px] font-mono">
              — {alertsLoading ? "…" : `${filteredAlerts.length} sur ${alerts.length}`}
            </span>
          </p>
          <button
            onClick={refreshAlerts}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Rafraichir
          </button>
        </div>
        {alertsError && (
          <div className="mx-5 mt-3 bg-red-500/10 border border-red-500/25 text-red-300 rounded-lg px-3 py-2 text-xs font-mono">
            {alertsError}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/10">
                {["ID", "Titre", "Type", "Sév.", "Confiance", "Statut", "Créée le", "Incident", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] text-muted-foreground font-mono uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alertsLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs font-mono text-muted-foreground">
                    Chargement des alertes…
                  </td>
                </tr>
              ) : filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs font-mono text-muted-foreground">
                    Aucune alerte trouvée
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((a) => (
                  <tr key={a.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors align-top">
                    <td className="px-4 py-2.5 text-[10px] font-mono text-slate-500 whitespace-nowrap">{a.id}</td>
                    <td className="px-4 py-2.5 text-[11px] text-foreground max-w-56">{a.title}</td>
                    <td className="px-4 py-2.5 text-[10px] font-mono text-cyan-400">{a.attackType}</td>
                    <td className="px-4 py-2.5">
                      <SevBadge s={a.sev} />
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-mono text-slate-500">{a.confidence}%</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_COLOR[a.status]}`}>
                        {STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-mono text-slate-500 whitespace-nowrap">
                      {a.createdAt.replace("T", " ").slice(0, 16)}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-mono whitespace-nowrap">
                      {a.incidentId ? (
                        <span className="text-emerald-400">{a.incidentId}</span>
                      ) : assigningAlert === a.id ? (
                        <div className="relative inline-block">
                          <select
                            autoFocus
                            defaultValue=""
                            onChange={(e) => e.target.value && assignIncident(a.id, e.target.value)}
                            onBlur={() => setAssigningAlert(null)}
                            className="bg-[#090e1b] border border-cyan-500/40 text-cyan-300 text-[10px] font-mono rounded px-1.5 py-1 outline-none appearance-none pr-5"
                          >
                            <option value="" disabled>
                              Choisir…
                            </option>
                            {incidents.map((inc) => (
                              <option key={inc.uuid} value={inc.uuid}>
                                {inc.id}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none" />
                        </div>
                      ) : (
                        <button
                          onClick={() => setAssigningAlert(a.id)}
                          className="inline-flex items-center gap-1 text-amber-400 border border-amber-500/40 bg-amber-500/10 rounded-full px-2 py-0.5 hover:bg-amber-500/20 transition-colors"
                        >
                          <Link2 className="w-2.5 h-2.5" /> Orpheline — Assigner
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <button
                        onClick={() => viewAlertLogs(a)}
                        className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 rounded-lg px-2 py-1 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> Voir les logs
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODALE INSPECTEUR JSON */}
      {/* ============================================================== */}
      {inspectEvent && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0d1423] border border-[#1e3058] rounded-2xl shadow-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-foreground font-mono">Document normalisé</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {inspectEvent.id} — {inspectEvent.event}
                  </span>
                  <SevBadge s={inspectEvent.sev} />
                </div>
              </div>
              <button onClick={() => setInspectEvent(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="text-[11px] font-mono text-emerald-400/90 bg-black/50 border border-border/50 rounded-xl p-4 overflow-auto max-h-96 leading-relaxed">
              {JSON.stringify(
                {
                  "@timestamp": inspectEvent.ts,
                  "event.type": inspectEvent.event,
                  "event.severity": inspectEvent.sev,
                  "source.ip": inspectEvent.src,
                  "destination.ip": inspectEvent.dst,
                  "user.name": inspectEvent.user,
                  "host.hostname": inspectEvent.machine,
                  message: inspectEvent.detail,
                  "analyst.flagged": flagged.has(inspectEvent.id),
                },
                null,
                2
              )}
            </pre>
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => togglePivot("src", inspectEvent.src)}
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors"
              >
                <Crosshair className="w-2.5 h-2.5" /> Pivoter sur cette source
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFlag(inspectEvent.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-[11px] font-mono rounded-lg transition-colors ${
                    flagged.has(inspectEvent.id)
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                      : "bg-secondary/60 text-foreground border border-border hover:bg-secondary"
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  {flagged.has(inspectEvent.id) ? "Démarquer" : "Marquer"}
                </button>
                <button
                  onClick={() => setInspectEvent(null)}
                  className="px-4 py-2 text-xs font-mono border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
