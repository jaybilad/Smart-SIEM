import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, X, Loader2 } from "lucide-react";
import { adminApi, type RuleRow } from "../../api/admin";

const SEV_STYLE: Record<string, string> = {
  CRITICAL: "border-red-500/30 hover:border-red-500/50",
  HIGH:     "border-orange-500/25 hover:border-orange-500/50",
  WARNING:  "border-yellow-500/20 hover:border-yellow-500/40",
  INFO:     "border-blue-500/20 hover:border-blue-500/40",
};

const SEV_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400",
  HIGH:     "bg-orange-500/15 text-orange-400",
  WARNING:  "bg-yellow-500/15 text-yellow-400",
  INFO:     "bg-blue-500/15 text-blue-400",
};

const MITRE_TEMPLATES = {
  "T1110": {
    name: "T1110 - Brute Force",
    type: "THRESHOLD",
    focus: "IP Source (Réseau)",
    desc: "Détection d'échecs de connexion en masse sur un intervalle court.",
    playbook: "Bloquer IP via Pare-feu",
    threshold: 5,
    window: 60,
    sev: "WARNING"
  },
  "T1046": {
    name: "T1046 - Network Service Scanning",
    type: "THRESHOLD",
    focus: "IP Source (Réseau)",
    desc: "Détection de scans horizontaux ou verticaux sur les ports du réseau.",
    playbook: "Isoler la Machine du Réseau",
    threshold: 20,
    window: 10,
    sev: "WARNING"
  },
  "T1021": {
    name: "T1021 - Lateral Movement",
    type: "PATTERN",
    focus: "Utilisateur Ciblé (AD)",
    desc: "Séquence suspecte de rebonds d'authentification inter-systèmes.",
    playbook: "Isoler la Machine du Réseau",
    threshold: 1,
    window: 30,
    sev: "HIGH"
  },
  "T1020": {
    name: "T1020 - Automated Exfiltration",
    type: "UEBA",
    focus: "IP Source (Flux Proxy)",
    desc: "Volume de données sortantes dépassant le seuil de la baseline réseau.",
    playbook: "Verrouiller le Compte Utilisateur",
    threshold: 10,
    window: 900,
    sev: "HIGH"
  },
  "T1078": {
    name: "T1078 - Anomalous Connection Hours",
    type: "UEBA",
    focus: "Utilisateur Ciblé (AD)",
    desc: "Tentative d'accès en dehors de la jauge horaire habituelle calculée par l'UEBA.",
    playbook: "Déclencher Challenge MFA",
    threshold: 1,
    window: 1,
    sev: "INFO"
  }
};

function SevBadge({ s }: { s: string }) {
  return <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${SEV_BADGE[s] ?? "bg-slate-500/15 text-slate-400"}`}>{s}</span>;
}

export default function RulesScreen() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [playbookOptions, setPlaybookOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [selectedMitre, setSelectedMitre] = useState<keyof typeof MITRE_TEMPLATES>("T1110");
  const [form, setForm] = useState({ name: "", sev: "WARNING", threshold: 5, window: 60, desc: "", playbook: "Bloquer IP via Pare-feu" });

  useEffect(() => {
    const template = MITRE_TEMPLATES[selectedMitre];
    setForm({
      name: template.name,
      sev: template.sev,
      threshold: template.threshold,
      window: template.window,
      desc: template.desc,
      playbook: template.playbook
    });
  }, [selectedMitre]);

  const refreshRules = () => {
    setLoading(true);
    Promise.all([adminApi.rules(), adminApi.playbooks()])
      .then(([ruleData, playbookData]) => {
        setRules(ruleData);
        const names = playbookData.map((playbook) => playbook.name);
        setPlaybookOptions(names);
        setForm((current) => names.length > 0 && !names.includes(current.playbook)
          ? { ...current, playbook: names[0] }
          : current
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refreshRules();
  }, []);

  const handleSave = () => {
    // Le backend intercepte la requête et génère la structure JSON à partir de selectedMitre et du formulaire
    adminApi.createRule({ ...form, mitre_technique: selectedMitre })
      .then(() => {
        setOpen(false);
        refreshRules();
      })
      .catch((e: any) => alert(e instanceof Error ? e.message : "Erreur lors de la sauvegarde"));
  };

  if (error && !rules.length) {
    return <div className="p-6 text-red-400 font-mono text-sm">Erreur : {error}</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Règles de Corrélation</h2>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{rules.filter((r) => r.on).length} règles actives sur {rules.length} — PostgreSQL</p>
        </div>
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-mono rounded-lg transition-colors shadow">
          <Plus className="w-3.5 h-3.5" /> Créer une règle
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement des règles…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {rules.map((rule) => (
            <div key={rule.id}
              className={`bg-card border rounded-xl p-4 transition-all ${SEV_STYLE[rule.sev] ?? "border-border"} ${!rule.on ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <SevBadge s={rule.sev} />
                    <span className={`text-[10px] font-mono ${rule.on ? "text-emerald-400" : "text-slate-600"}`}>
                      {rule.on ? "● ACTIVE" : "○ INACTIVE"}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground truncate">{rule.name}</h4>
                </div>
                <button
                  disabled
                  title="Lecture seule — état depuis PostgreSQL"
                  className={`relative w-9 h-5 rounded-full shrink-0 mt-1 cursor-not-allowed ${rule.on ? "bg-emerald-500/30 border border-emerald-500/50" : "bg-secondary border border-border"}`}>
                  <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full ${rule.on ? "left-4.5 bg-emerald-400 shadow shadow-emerald-500/50" : "left-0.5 bg-slate-500"}`} />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{rule.desc}</p>
              <div className="border-t border-border/50 pt-3 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider mb-0.5">Seuil</p>
                  <p className="text-xs font-bold font-mono text-cyan-400">{rule.threshold} events</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider mb-0.5">Fenêtre</p>
                  <p className="text-xs font-bold font-mono text-blue-400">{rule.window}s</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider mb-0.5">Playbook</p>
                  <p className="text-[10px] font-mono text-violet-400 truncate">{rule.playbook}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-md transition-colors">
                  <Edit2 className="w-2.5 h-2.5" /> Modifier
                </button>
                <button className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono text-red-400/70 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors">
                  <Trash2 className="w-2.5 h-2.5" /> Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0d1423] border border-[#1e3058] rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-foreground">Nouvelle règle de corrélation</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">Moteur d'intelligence SIEM — lecture seule PostgreSQL</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Technique MITRE ATT&CK</label>
                <select className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                  value={selectedMitre}
                  onChange={(e) => setSelectedMitre(e.target.value as keyof typeof MITRE_TEMPLATES)}>
                  <option value="T1110">T1110 - Brute Force</option>
                  <option value="T1046">T1046 - Network Service Scanning</option>
                  <option value="T1021">T1021 - Lateral Movement</option>
                  <option value="T1020">T1020 - Automated Exfiltration</option>
                  <option value="T1078">T1078 - Anomalous Connection Hours</option>
                </select>
              </div>

              {/* ENCADRÉ AVEC LE TYPE LOGIQUE EN SURBRILLANCE */}
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Type de moteur analytique bloqué</label>
                <div className="flex gap-2 bg-secondary/30 p-2 rounded-lg border border-border">
                  {["THRESHOLD", "PATTERN", "UEBA"].map((t) => {
                    const isActive = MITRE_TEMPLATES[selectedMitre].type === t;
                    return (
                      <span key={t} className={`flex-1 text-center py-1 text-xs font-mono rounded border transition-all ${isActive ? 'bg-blue-600/20 border-blue-500 text-blue-400 font-bold opacity-100 shadow-sm' : 'bg-transparent border-transparent text-slate-600 opacity-20'}`}>
                        {t}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* AFFICHAGE DE L'AXE DE REGROUPEMENT CONCERNÉ */}
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">Axe de focalisation de l'entité</label>
                <div className="text-xs font-mono text-cyan-400 bg-cyan-500/5 border border-cyan-500/10 rounded-lg px-3 py-2">
                  Agrégation native basée sur : <span className="underline font-bold">{MITRE_TEMPLATES[selectedMitre].focus}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Nom de la règle</label>
                <input className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                  placeholder="Ex : Détection Mouvement Latéral"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Criticité conseillée</label>
                  <select className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                    value={form.sev}
                    onChange={(e) => setForm((f) => ({ ...f, sev: e.target.value }))}>
                    {["INFO", "WARNING", "HIGH", "CRITICAL"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Playbook SOAR</label>
                  <select className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                    value={form.playbook}
                    onChange={(e) => setForm((f) => ({ ...f, playbook: e.target.value }))}>
                    {playbookOptions.length > 0 ? (
                      playbookOptions.map((p) => <option key={p}>{p}</option>)
                    ) : (
                      // Fallback si aucune règle n'existe encore en base pour dériver la liste
                      <option value={form.playbook}>{form.playbook}</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Seuil d'événements / Anomalie</label>
                  <input type="number" min={1}
                    className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                    value={form.threshold}
                    onChange={(e) => setForm((f) => ({ ...f, threshold: parseInt(e.target.value) || 1 }))} />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Fenêtre temporelle (s)</label>
                  <input type="number" min={1}
                    className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                    value={form.window}
                    onChange={(e) => setForm((f) => ({ ...f, window: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Description</label>
                <textarea rows={2}
                  className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors resize-none"
                  placeholder="Décrire le comportement détecté par cette règle..."
                  value={form.desc}
                  onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-mono border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
                Annuler
              </button>
              <button onClick={handleSave}
                className="flex-1 px-4 py-2 text-sm font-mono bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow font-bold">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
