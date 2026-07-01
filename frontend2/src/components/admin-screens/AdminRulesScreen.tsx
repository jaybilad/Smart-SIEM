import { useState } from "react";
import { Plus, Edit2, Trash2, X, Check } from "lucide-react";

const RULES_INIT = [
  { id: 1, name: "Détection Force Brute",    sev: "CRITICAL", on: true,  threshold: 5,   window: 60,  desc: "Plus de 5 échecs d'auth en 60s sur un même compte",           playbook: "Bloquer IP via Pare-feu"             },
  { id: 2, name: "Scan de Ports Interne",    sev: "HIGH",     on: true,  threshold: 100, window: 30,  desc: "Scan horizontal détecté sur le réseau interne LAN",           playbook: "Isoler l'hôte source"               },
  { id: 3, name: "Exfiltration DNS",         sev: "HIGH",     on: false, threshold: 200, window: 300, desc: "Volume de requêtes DNS anormal — tunnel DNS suspecté",        playbook: "Bloquer domaine DNS"                },
  { id: 4, name: "Élévation de Privilèges",  sev: "CRITICAL", on: true,  threshold: 1,   window: 10,  desc: "Toute tentative d'escalade de privilèges (sudo, runas)",      playbook: "Alerter RSSI + Bloquer session"     },
  { id: 5, name: "Connexion Hors Horaires",  sev: "WARNING",  on: true,  threshold: 1,   window: 1,   desc: "Auth réussie en dehors des plages définies (22h–06h)",        playbook: "Notifier manager + MFA challenge"   },
  { id: 6, name: "Nouveau Pays Source",      sev: "WARNING",  on: true,  threshold: 1,   window: 1,   desc: "Connexion depuis pays non référencé pour cet utilisateur",    playbook: "Bloquer + Notifier utilisateur"     },
];

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
};

function SevBadge({ s }: { s: string }) {
  return <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${SEV_BADGE[s] ?? "bg-slate-500/15 text-slate-400"}`}>{s}</span>;
}

export default function RulesScreen() {
  const [rules, setRules] = useState(RULES_INIT);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", sev: "HIGH", threshold: 5, window: 60, desc: "", playbook: "Bloquer IP via Pare-feu" });

  const toggle = (id: number) =>
    setRules((p) => p.map((r) => r.id === id ? { ...r, on: !r.on } : r));

  const handleAdd = () => {
    if (!form.name.trim()) return;
    setRules((p) => [...p, { ...form, id: p.length + 1, on: true }]);
    setOpen(false);
    setForm({ name: "", sev: "HIGH", threshold: 5, window: 60, desc: "", playbook: "Bloquer IP via Pare-feu" });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Règles de Corrélation</h2>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{rules.filter((r) => r.on).length} règles actives sur {rules.length}</p>
        </div>
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-mono rounded-lg transition-colors shadow">
          <Plus className="w-3.5 h-3.5" /> Créer une règle
        </button>
      </div>

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
              <button onClick={() => toggle(rule.id)}
                className={`relative w-9 h-5 rounded-full shrink-0 mt-1 transition-colors ${rule.on ? "bg-emerald-500/30 border border-emerald-500/50" : "bg-secondary border border-border"}`}>
                <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all duration-200 ${rule.on ? "left-4.5 bg-emerald-400 shadow shadow-emerald-500/50" : "left-0.5 bg-slate-500"}`} />
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

      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0d1423] border border-[#1e3058] rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-foreground">Nouvelle règle de corrélation</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">Moteur d'intelligence SIEM</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Nom de la règle</label>
                <input className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                  placeholder="Ex : Détection Mouvement Latéral"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Criticité</label>
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
                    {["Bloquer IP via Pare-feu", "Isoler l'hôte source", "Alerter RSSI + Bloquer session", "Notifier manager + MFA challenge", "Bloquer + Notifier utilisateur", "Bloquer domaine DNS"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">
                    Seuil d'événements
                  </label>
                  <input type="number" min={1}
                    className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                    value={form.threshold}
                    onChange={(e) => setForm((f) => ({ ...f, threshold: parseInt(e.target.value) || 1 }))} />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">
                    Fenêtre temporelle (s)
                  </label>
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
              <button onClick={handleAdd}
                className="flex-1 px-4 py-2 text-sm font-mono bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 shadow">
                <Check className="w-3.5 h-3.5" /> Créer la règle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}