import { useState } from "react";
import { UserCheck, Check, Send,AlertTriangle } from "lucide-react";

interface Incident {
  id: string; title: string; sev: string; rule: string;
  src: string; target: string; machine: string; ueba: number;
  time: string; date: string;
}

const INCIDENTS: Incident[] = [
  { id: "INC-2853", title: "Connexion depuis pays non référencé — TOR",   sev: "HIGH",     rule: "Nouveau Pays Source",      src: "185.107.47.215",  target: "j.bernard@eu.local",  machine: "WS-EU-047",     ueba: 72, time: "14:58", date: "2026-06-22" },
  { id: "INC-2852", title: "Téléchargement massif SharePoint Filiale EU", sev: "CRITICAL", rule: "Exfiltration Données",      src: "192.168.10.33",   target: "k.ibrahim@eu.local",  machine: "WS-EU-088",     ueba: 94, time: "14:47", date: "2026-06-22" },
  { id: "INC-2845", title: "Accès hors périmètre — serveurs Prod",        sev: "HIGH",     rule: "Accès Hors Périmètre",     src: "192.168.10.55",   target: "t.werner@eu.local",   machine: "WS-EU-031",     ueba: 61, time: "09:30", date: "2026-06-22" },
  { id: "INC-2844", title: "Auth anomale Office 365 EU",                  sev: "WARNING",  rule: "Auth Anomale Cloud",        src: "40.99.12.200",    target: "s.lemaire@eu.local",  machine: "cloud-O365-EU", ueba: 33, time: "08:55", date: "2026-06-22" },
  { id: "INC-2838", title: "Nouveau pays source — utilisateur RH",        sev: "WARNING",  rule: "Nouveau Pays Source",      src: "41.214.100.30",   target: "m.legrand@rh.local",  machine: "WS-RH-EU-011",  ueba: 38, time: "11:07", date: "2026-06-22" },
  { id: "INC-2831", title: "Connexion hors horaires définis (02h34)",     sev: "WARNING",  rule: "Connexion Hors Horaires",  src: "192.168.50.14",   target: "p.muller@eu.local",   machine: "WS-EU-023",     ueba: 45, time: "02:34", date: "2026-06-22" },
];

const INIT_STATUSES: Record<string, string> = {
  "INC-2853": "Nouvelle", "INC-2852": "En cours", "INC-2845": "En cours",
  "INC-2844": "Nouvelle", "INC-2838": "Nouvelle", "INC-2831": "Résolue",
};

function SevBadge({ s }: { s: string }) {
  const colors: Record<string, string> = {
    CRITICAL: "bg-red-500/15 text-red-400 border border-red-500/30",
    HIGH:     "bg-orange-500/15 text-orange-400 border border-orange-500/30",
    WARNING:  "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
    INFO:     "bg-blue-500/15 text-blue-400 border border-blue-500/30",
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
    Nouvelle:   "bg-blue-500/15 text-blue-400 border border-blue-500/25",
    "En cours": "bg-orange-500/15 text-orange-400 border border-orange-500/25",
    Résolue:    "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
    "Faux positif": "bg-slate-500/15 text-slate-400 border border-slate-500/25",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono ${colors[s] ?? "text-slate-400"}`}>{s}</span>
  );
}

export default function SOCIncidentsScreen() {
  const [statuses, setStatuses] = useState<Record<string, string>>(INIT_STATUSES);
  const [selectedId, setSelectedId] = useState<string | null>(INCIDENTS[0].id);
  const [filter, setFilter] = useState("Tous");
  const [noteInput, setNoteInput] = useState("");
  const [notes, setNotes] = useState<Record<string, { ts: string; text: string }[]>>({});

  const filterOpts = ["Tous", "Nouvelle", "En cours", "Résolue"];
  const sorted = [...INCIDENTS].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, WARNING: 2, INFO: 3 };
    return (order[a.sev as keyof typeof order] ?? 4) - (order[b.sev as keyof typeof order] ?? 4);
  });
  const displayed = filter === "Tous" ? sorted : sorted.filter((i) => statuses[i.id] === filter);
  const selected = selectedId ? INCIDENTS.find((i) => i.id === selectedId) ?? null : null;
  const selectedStatus = selected ? (statuses[selected.id] ?? "Nouvelle") : null;

  const takeCharge = () => {
    if (!selected) return;
    setStatuses((p) => ({ ...p, [selected.id]: "En cours" }));
  };
  const closeResolved = () => {
    if (!selected) return;
    setStatuses((p) => ({ ...p, [selected.id]: "Résolue" }));
  };
  const addNote = () => {
    if (!selected || !noteInput.trim()) return;
    setNotes((p) => ({
      ...p,
      [selected.id]: [...(p[selected.id] ?? []), { ts: new Date().toISOString(), text: noteInput.trim() }],
    }));
    setNoteInput("");
  };

  return (
    <div className="flex h-full overflow-hidden pb-6">
      {/* LEFT PANEL */}
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
          {displayed.map((inc) => {
            const st = statuses[inc.id] ?? "Nouvelle";
            const isSelected = selectedId === inc.id;
            const borderL =
              inc.sev === "CRITICAL" ? "border-l-red-500" :
              inc.sev === "HIGH"     ? "border-l-orange-500" :
              inc.sev === "WARNING"  ? "border-l-yellow-500" : "border-l-border";
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

      {/* RIGHT PANEL */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-mono text-blue-400 font-bold">{selected.id}</span>
                  <SevBadge s={selected.sev} />
                  <StatusChip s={selectedStatus ?? "Nouvelle"} />
                </div>
                <h2 className="text-base font-semibold text-foreground">{selected.title}</h2>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">{selected.date} {selected.time}</span>
            </div>

            {/* Metadata */}
            <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
              {[
                ["Règle déclenchée",   selected.rule],
                ["IP source",          selected.src],
                ["Utilisateur cible",  selected.target],
                ["Machine concernée",  selected.machine],
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
                    <div className={`h-full rounded-full transition-all ${selected.ueba >= 80 ? "bg-linear-to-r from-red-600 to-red-400" : selected.ueba >= 50 ? "bg-linear-to-r from-orange-600 to-orange-400" : "bg-linear-to-r from-yellow-600 to-yellow-400"}`}
                      style={{ width: `${selected.ueba}%` }} />
                  </div>
                  <span className={`text-sm font-bold font-mono ${selected.ueba >= 80 ? "text-red-400" : selected.ueba >= 50 ? "text-orange-400" : "text-yellow-400"}`}>{selected.ueba}<span className="text-slate-600 text-xs">/100</span></span>
                </div>
              </div>
            </div>

            {/* Status actions */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Actions de statut</p>
              <div className="flex flex-wrap gap-2">
                {(selectedStatus === "Nouvelle" || selectedStatus === "Ouvert") && (
                  <button onClick={takeCharge}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow">
                    <UserCheck className="w-3.5 h-3.5" /> Prendre en charge
                  </button>
                )}
                {selectedStatus !== "Résolue" && selectedStatus !== "Faux positif" && (
                  <button onClick={closeResolved}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg transition-colors">
                    <Check className="w-3.5 h-3.5" /> Clôturer (Résolu)
                  </button>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Journal d'investigation</p>
              <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                {(notes[selected.id] ?? []).length === 0 ? (
                  <p className="text-xs text-slate-600 font-mono italic">Aucune note d'investigation pour l'instant.</p>
                ) : (
                  (notes[selected.id] ?? []).map((n, i) => (
                    <div key={i} className="bg-secondary/40 rounded-lg p-2.5 border border-border/50">
                      <p className="text-[9px] font-mono text-muted-foreground mb-1">a.dupont — {n.ts.slice(0, 16).replace("T", " ")} UTC</p>
                      <p className="text-xs text-foreground/80">{n.text}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  className="flex-1 bg-secondary/40 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-blue-500/50 transition-colors resize-none placeholder:text-slate-600"
                  placeholder="Ajouter une note d'investigation..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                />
                <button onClick={addNote}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center shrink-0">
                  <Send className="w-3.5 h-3.5" />
                </button>
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