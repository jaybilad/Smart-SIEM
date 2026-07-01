import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Filter, Eye, Edit2, Trash2, Loader2, X, Save } from "lucide-react";
import { adminApi, type CreateIncidentPayload, type IncidentRow, type RuleRow, type UserRow } from "../../api/admin";

const SEVERITIES = ["INFO", "WARNING", "HIGH", "CRITICAL"];

const INITIAL_FORM = {
  title: "",
  description: "",
  severity: "HIGH",
  attack_type: "",
  source_ip: "",
  target: "",
  assigned_to: "",
};

const SEV_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border border-red-500/30",
  HIGH:     "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  WARNING:  "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  INFO:     "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  LOW:      "bg-slate-500/15 text-slate-700 border border-slate-500/30",
};

function SevBadge({ s }: { s: string }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold tracking-widest ${SEV_STYLE[s] ?? SEV_STYLE.LOW}`}>
      {s}
    </span>
  );
}

const STATUS_DOT: Record<string, string> = {
  Actif:     "bg-emerald-400",
  Inactif:   "bg-slate-500",
  Ouvert:    "bg-red-400 animate-pulse",
  "En cours":"bg-orange-400 animate-pulse",
  Résolu:    "bg-emerald-400",
  Clôturé:   "bg-slate-500",
};
const STATUS_TEXT: Record<string, string> = {
  Actif:     "text-emerald-400",
  Inactif:   "text-slate-700",
  Ouvert:    "text-red-400",
  "En cours":"text-orange-400",
  Résolu:    "text-emerald-400",
  Clôturé:   "text-slate-500",
};

function StatusPill({ s }: { s: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[s] ?? "bg-slate-500"}`} />
      <span className={`text-[11px] font-mono ${STATUS_TEXT[s] ?? "text-slate-700"}`}>{s}</span>
    </span>
  );
}

function isClosedStatus(status: string) {
  return status === "Résolu" || status === "Resolu" || status.includes("solu") || status === "Clôturé" || status === "Cloture" || status.startsWith("Cl");
}

export default function IncidentsScreen() {
  const [filter, setFilter] = useState("Tous");
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refLoading, setRefLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const filters = ["Tous", "Ouvert", "En cours", "Résolu"];

  const attackTypes = useMemo(
    () => [...new Set(rules.map((rule) => rule.attack_type).filter(Boolean))],
    [rules],
  );

  const loadIncidents = (nextFilter = filter) => {
    setLoading(true);
    setError(null);
    return adminApi.incidents(nextFilter === "Tous" ? undefined : nextFilter)
      .then(setIncidents)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  };

  const loadReferences = () => {
    if (users.length && rules.length) return;
    setRefLoading(true);
    setModalError(null);
    Promise.all([adminApi.users(), adminApi.rules()])
      .then(([loadedUsers, loadedRules]) => {
        setUsers(loadedUsers);
        setRules(loadedRules);
        const firstAttackType = loadedRules.find((rule) => rule.attack_type)?.attack_type ?? "";
        setForm((current) => ({
          ...current,
          attack_type: current.attack_type || firstAttackType,
        }));
      })
      .catch((e) => setModalError(e instanceof Error ? e.message : "Erreur de chargement"))
      .finally(() => setRefLoading(false));
  };

  useEffect(() => {
    loadIncidents(filter);
  }, [filter]);

  const openCreateModal = () => {
    setCreateModalOpen(true);
    loadReferences();
  };

  const closeCreateModal = () => {
    if (submitting) return;
    setCreateModalOpen(false);
    setModalError(null);
  };

  const resetForm = () => {
    setForm({
      ...INITIAL_FORM,
      attack_type: attackTypes[0] ?? "",
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setModalError(null);

    const payload: CreateIncidentPayload = {
      title: form.title.trim(),
      description: form.description.trim(),
      severity: form.severity,
      attack_type: form.attack_type,
      source_ip: form.source_ip.trim(),
      target: form.target.trim(),
      assigned_to: form.assigned_to || null,
    };

    try {
      const created = await adminApi.createIncident(payload);
      resetForm();
      setCreateModalOpen(false);
      if (filter === "Tous" || filter === "Ouvert") {
        setIncidents((current) => [created, ...current.filter((inc) => inc.id !== created.id)]);
        await loadIncidents(filter);
      } else {
        setFilter("Tous");
      }
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Erreur API");
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !incidents.length) {
    return <div className="p-6 text-red-400 font-mono text-sm">Erreur : {error}</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-secondary/60 rounded-lg p-0.5 gap-0.5">
          {filters.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[11px] font-mono rounded-md transition-all ${filter === f ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-lg transition-colors border border-border">
          <Filter className="w-3 h-3" /> Filtres avancés
        </button>
        <button onClick={openCreateModal}
          className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-mono bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow">
          <Plus className="w-3.5 h-3.5" /> Créer un incident
        </button>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-500/10 text-red-300 rounded-lg px-3 py-2 text-xs font-mono">
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-muted-foreground font-mono text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                {["ID", "Titre", "Criticité", "Statut", "Source IP", "Cible", "Assigné", "Heure", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] text-muted-foreground font-mono uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs font-mono text-muted-foreground">Aucun incident pour ce filtre</td>
                </tr>
              ) : incidents.map((inc) => {
                const isResolved = isClosedStatus(inc.status);
                const borderLeft =
                  inc.sev === "CRITICAL" && !isResolved ? "border-l-2 border-l-red-500" :
                  inc.sev === "HIGH"     && !isResolved ? "border-l-2 border-l-orange-500" :
                  "border-l-2 border-l-transparent";
                return (
                  <tr key={inc.id} className={`border-b border-border/30 hover:bg-secondary/30 transition-colors ${borderLeft}`}>
                    <td className="px-4 py-3 text-[11px] font-mono text-blue-400 font-bold">{inc.id}</td>
                    <td className="px-4 py-3 text-xs text-foreground/90 max-w-50 truncate">{inc.title}</td>
                    <td className="px-4 py-3"><SevBadge s={inc.sev} /></td>
                    <td className="px-4 py-3"><StatusPill s={inc.status} /></td>
                    <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{inc.src}</td>
                    <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground max-w-30 truncate">{inc.target}</td>
                    <td className="px-4 py-3 text-[11px] font-mono">
                      {inc.assignee
                        ? <span className="text-cyan-400">{inc.assignee}</span>
                        : <span className="text-slate-700 italic">non assigné</span>}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{inc.time}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <button className="text-blue-400 hover:text-blue-300 transition-colors" title="Voir détail"><Eye className="w-3.5 h-3.5" /></button>
                        <button className="text-slate-500 hover:text-foreground transition-colors" title="Modifier"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button className="text-red-500/70 hover:text-red-400 transition-colors" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {createModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <form onSubmit={handleSubmit} className="bg-[#0d1423] border border-[#1e3058] rounded-2xl shadow-2xl w-full max-w-2xl p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-foreground">Créer un incident</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">Création manuelle - données PostgreSQL</p>
              </div>
              <button type="button" onClick={closeCreateModal} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 border border-red-500/30 bg-red-500/10 text-red-300 rounded-lg px-3 py-2 text-xs font-mono">
                {modalError}
              </div>
            )}

            {refLoading ? (
              <div className="p-8 flex items-center justify-center gap-2 text-muted-foreground font-mono text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement des listes...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Type de menace / attaque</label>
                    <select required
                      className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                      value={form.attack_type}
                      onChange={(e) => setForm((f) => ({ ...f, attack_type: e.target.value }))}>
                      <option value="" disabled>Selectionner</option>
                      {attackTypes.map((attackType) => <option key={attackType} value={attackType}>{attackType}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Niveau de criticité</label>
                    <select required
                      className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                      value={form.severity}
                      onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
                      {SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Adresse IP source</label>
                    <input required
                      className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                      placeholder="192.168.1.10"
                      value={form.source_ip}
                      onChange={(e) => setForm((f) => ({ ...f, source_ip: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Cible</label>
                    <input required
                      className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                      placeholder="WEB-01, compte utilisateur, ressource"
                      value={form.target}
                      onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Titre de l'incident</label>
                  <input required maxLength={150}
                    className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                    placeholder="Suspicion Brute Force sur WEB-01"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Description</label>
                  <textarea rows={3}
                    className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors resize-none"
                    placeholder="Decrire le contexte, les premiers indices et l'impact potentiel..."
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Assigné à</label>
                  <select
                    className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                    value={form.assigned_to}
                    onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}>
                    <option value="">Non assigné</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.username} - {user.role}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button type="button" onClick={closeCreateModal}
                className="flex-1 px-4 py-2 text-sm font-mono border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={submitting || refLoading || !attackTypes.length}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-mono bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Créer l'incident
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
