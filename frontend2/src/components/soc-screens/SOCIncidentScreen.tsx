import { useEffect, useState } from "react";
import { AlertTriangle, Check, Send, UserCheck } from "lucide-react";
import { socApi, type SocIncidentActionRow, type SocIncidentRow, type SocUserRow } from "../../api/soc";

const INIT_STATUSES: Record<string, string> = {};

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

function StatusChip({ s }: { s: string }) {
  const colors: Record<string, string> = {
    Ouvert: "bg-blue-500/15 text-blue-400 border border-blue-500/25",
    Nouvelle: "bg-blue-500/15 text-blue-400 border border-blue-500/25",
    "En cours": "bg-orange-500/15 text-orange-400 border border-orange-500/25",
    "Résolu": "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
    "Clôturé": "bg-slate-500/15 text-slate-400 border border-slate-500/25",
    "Faux positif": "bg-slate-500/15 text-slate-400 border border-slate-500/25",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono ${colors[s] ?? "text-slate-400"}`}>{s}</span>
  );
}

function storedUserHint() {
  const raw = localStorage.getItem("user");
  if (!raw) return { username: "a.dupont" };
  try {
    const parsed = JSON.parse(raw) as { id?: string; username?: string; name?: string };
    return { id: parsed.id, username: parsed.username ?? parsed.name ?? "a.dupont" };
  } catch {
    return { username: raw || "a.dupont" };
  }
}

function formatActionTime(value: string) {
  if (!value) return "En attente";
  return value.slice(0, 16).replace("T", " ");
}

export default function SOCIncidentsScreen() {
  const [incidents, setIncidents] = useState<SocIncidentRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>(INIT_STATUSES);
  const [currentAnalyst, setCurrentAnalyst] = useState<SocUserRow | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("Tous");
  const [actions, setActions] = useState<SocIncidentActionRow[]>([]);
  const [actionNote, setActionNote] = useState("");
  const [executionStatus, setExecutionStatus] = useState("Succès");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([socApi.incidents(), socApi.users()])
      .then(([incidentData, userData]) => {
        setIncidents(incidentData);
        setStatuses(Object.fromEntries(incidentData.map((item) => [item.id, item.status])) as Record<string, string>);
        setSelectedId((current) => current ?? incidentData[0]?.id ?? null);

        const hint = storedUserHint();
        const analyst = userData.find((user) => user.id === hint.id)
          ?? userData.find((user) => user.username === hint.username)
          ?? userData.find((user) => user.username === "a.dupont")
          ?? null;
        setCurrentAnalyst(analyst);
        setError(null);
      })
      .catch((err: Error) => {
        setIncidents([]);
        setCurrentAnalyst(null);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const filterOpts = ["Tous", "Ouvert", "En cours", "Résolu", "Clôturé"];
  const sorted = [...incidents].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, WARNING: 2, INFO: 3 };
    return (order[a.sev as keyof typeof order] ?? 4) - (order[b.sev as keyof typeof order] ?? 4);
  });
  const displayed = filter === "Tous" ? sorted : sorted.filter((i) => (statuses[i.id] ?? i.status) === filter);
  const selected = selectedId ? incidents.find((i) => i.id === selectedId) ?? null : null;
  const selectedStatus = selected ? (statuses[selected.id] ?? selected.status) : null;
  const selectedDate = selected?.created_at ? selected.created_at.split("T")[0] : "-";
  const selectedUeba = selected?.ueba ?? 0;
  const canAddActions = selectedStatus === "En cours";

  useEffect(() => {
    if (!selected?.uuid) {
      setActions([]);
      return;
    }
    setActionLoading(true);
    socApi.incidentActions(selected.uuid)
      .then((data) => {
        setActions(data);
        setError(null);
      })
      .catch((err: Error) => {
        setActions([]);
        setError(err.message);
      })
      .finally(() => setActionLoading(false));
  }, [selected?.uuid]);

  const persistStatus = async (status: string) => {
    if (!selected) return;
    setSavingStatus(true);
    try {
      const updated = await socApi.updateIncidentStatus(selected.uuid, status);
      setIncidents((items) => items.map((item) => item.id === selected.id ? updated : item));
      setStatuses((p) => ({ ...p, [selected.id]: updated.status }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur API");
    } finally {
      setSavingStatus(false);
    }
  };

  const takeCharge = async () => {
    if (!selected || !currentAnalyst) {
      setError("Analyste connecté introuvable.");
      return;
    }
    setSavingStatus(true);
    try {
      const response = await socApi.takeIncident(selected.uuid, currentAnalyst.id);
      setIncidents((items) => items.map((item) => item.id === selected.id
        ? { ...item, status: response.incident.status, assignee: response.incident.assigned_to }
        : item
      ));
      setStatuses((p) => ({ ...p, [selected.id]: response.incident.status }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur API");
    } finally {
      setSavingStatus(false);
    }
  };

  const closeResolved = () => {
    void persistStatus("Résolu");
  };

  const addAction = async () => {
    if (!selected || !currentAnalyst || !actionNote.trim()) return;
    setSavingAction(true);
    try {
      await socApi.addIncidentAction(selected.uuid, {
        analyst_id: currentAnalyst.id,
        action_note: actionNote.trim(),
        execution_status: executionStatus,
      });
      setActionNote("");
      setExecutionStatus("Succès");
      const history = await socApi.incidentActions(selected.uuid);
      setActions(history);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur API");
    } finally {
      setSavingAction(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden pb-6">
      <div className="w-85 shrink-0 flex flex-col border-r border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary/10 shrink-0">
          <div className="flex items-center gap-1.5">
            {filterOpts.map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-[10px] font-mono rounded-md transition-all ${filter === f ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground font-mono text-sm">Chargement des incidents...</div>
          ) : displayed.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground font-mono text-sm">Aucun incident disponible.</div>
          ) : displayed.map((inc) => {
            const st = statuses[inc.id] ?? inc.status;
            const isSelected = selectedId === inc.id;
            const borderL =
              inc.sev === "CRITICAL" ? "border-l-red-500" :
              inc.sev === "HIGH" ? "border-l-orange-500" :
              inc.sev === "WARNING" ? "border-l-yellow-500" : "border-l-border";
            return (
              <button key={inc.id} onClick={() => setSelectedId(inc.id)}
                className={`w-full text-left px-4 py-3.5 border-b border-border/50 border-l-2 transition-all ${borderL} ${isSelected ? "bg-blue-600/10 border-r-2 border-r-blue-500" : "hover:bg-secondary/30"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono text-blue-400 font-bold">{inc.id}</span>
                  <div className="flex items-center gap-1.5">
                    <SevBadge s={inc.sev} />
                    <StatusChip s={st} />
                  </div>
                </div>
                <p className="text-xs text-foreground/90 font-medium leading-tight mb-1.5">{inc.title}</p>
                <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                  <span>{inc.src}</span>
                  <span className="text-border">·</span>
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
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-mono text-blue-400 font-bold">{selected.id}</span>
                  <SevBadge s={selected.sev} />
                  <StatusChip s={selectedStatus ?? "Ouvert"} />
                </div>
                <h2 className="text-base font-semibold text-foreground">{selected.title}</h2>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">{selectedDate} {selected.time}</span>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/25 text-red-300 rounded-lg px-3 py-2 text-xs font-mono">
                {error}
              </div>
            )}

            <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
              {[
                ["Règle déclenchée", selected.rule],
                ["IP source", selected.src],
                ["Cible", selected.target],
                ["Machine concernée", selected.machine ?? "-"],
                ["Statut", selectedStatus ?? "-"],
                ["Analyste assigné", selected.assignee ?? "-"],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{k}</p>
                  <p className="font-mono text-foreground/90">{v}</p>
                </div>
              ))}
              <div className="col-span-2">
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Score UEBA comportemental</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${selectedUeba >= 80 ? "bg-linear-to-r from-red-600 to-red-400" : selectedUeba >= 50 ? "bg-linear-to-r from-orange-600 to-orange-400" : "bg-linear-to-r from-yellow-600 to-yellow-400"}`}
                      style={{ width: `${selectedUeba}%` }} />
                  </div>
                  <span className={`text-sm font-bold font-mono ${selectedUeba >= 80 ? "text-red-400" : selectedUeba >= 50 ? "text-orange-400" : "text-yellow-400"}`}>{selectedUeba > 0 ? selectedUeba : "N/A"}<span className="text-slate-600 text-xs">{selectedUeba > 0 ? "/100" : ""}</span></span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Actions de statut</p>
              <div className="flex flex-wrap gap-2">
                {(selectedStatus === "Ouvert" || selectedStatus === "En cours") && (
                  <button onClick={takeCharge} disabled={savingStatus || !currentAnalyst}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg transition-colors shadow">
                    <UserCheck className="w-3.5 h-3.5" /> Prendre en charge
                  </button>
                )}
                {selectedStatus !== "Résolu" && selectedStatus !== "Clôturé" && (
                  <button onClick={closeResolved} disabled={savingStatus}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg transition-colors">
                    <Check className="w-3.5 h-3.5" /> Clôturer (Résolu)
                  </button>
                )}
              </div>
              <p className="mt-3 text-[10px] font-mono text-muted-foreground">
                Analyste connecté : <span className="text-blue-300">{currentAnalyst?.username ?? "inconnu"}</span>
              </p>
            </div>

            {canAddActions && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Ajouter une action réalisée</p>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_150px_auto] gap-2 items-start">
                  <textarea
                    rows={3}
                    className="bg-secondary/40 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-blue-500/50 transition-colors resize-none placeholder:text-slate-600"
                    placeholder="Décrire l'action réalisée..."
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                  />
                  <select
                    value={executionStatus}
                    onChange={(e) => setExecutionStatus(e.target.value)}
                    className="bg-secondary/40 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-blue-500/50"
                  >
                    <option>En attente</option>
                    <option>Succès</option>
                    <option>Échec</option>
                  </select>
                  <button onClick={addAction} disabled={savingAction || !actionNote.trim() || !currentAnalyst}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs font-mono">
                    <Send className="w-3.5 h-3.5" /> Enregistrer
                  </button>
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Actions réalisées</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {actionLoading ? (
                  <p className="text-xs text-slate-600 font-mono italic">Chargement de l'historique...</p>
                ) : actions.length === 0 ? (
                  <p className="text-xs text-slate-600 font-mono italic">Aucune action enregistrée pour cet incident.</p>
                ) : actions.map((action) => (
                  <div key={action.id} className="relative bg-secondary/40 rounded-lg p-3 border border-border/50">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div>
                        <p className="text-[10px] font-mono text-blue-300 font-bold">{action.action_name}</p>
                        <p className="text-[9px] font-mono text-muted-foreground">
                          {action.executed_by} · {formatActionTime(action.execution_time)}
                        </p>
                      </div>
                      <StatusChip s={action.execution_status} />
                    </div>
                    <p className="text-xs text-foreground/80">{action.action_note || "Aucune note renseignée."}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm font-mono">Sélectionnez un incident</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
