import { useState } from "react";
import { Filter, Lock, AlertTriangle} from "lucide-react";

const INCIDENTS = [
  { id: "INC-2853", title: "Connexion depuis pays non référencé — TOR", sev: "HIGH", status: "Nouvelle", src: "185.107.47.215", target: "j.bernard@eu.local", rule: "Nouveau Pays Source", ueba: 72, time: "14:58", assignee: "non assigné" },
  { id: "INC-2852", title: "Téléchargement massif SharePoint Filiale EU", sev: "CRITICAL", status: "En cours", src: "192.168.10.33", target: "k.ibrahim@eu.local", rule: "Exfiltration Données", ueba: 94, time: "14:47", assignee: "a.dupont" },
  { id: "INC-2845", title: "Accès hors périmètre — serveurs Prod", sev: "HIGH", status: "En cours", src: "192.168.10.55", target: "t.werner@eu.local", rule: "Accès Hors Périmètre", ueba: 61, time: "09:30", assignee: "s.chen" },
  { id: "INC-2844", title: "Auth anomale Office 365 EU", sev: "WARNING", status: "Nouvelle", src: "40.99.12.200", target: "s.lemaire@eu.local", rule: "Auth Anomale Cloud", ueba: 33, time: "08:55", assignee: "non assigné" },
  { id: "INC-2838", title: "Nouveau pays source — utilisateur RH", sev: "WARNING", status: "Nouvelle", src: "41.214.100.30", target: "m.legrand@rh.local", rule: "Nouveau Pays Source", ueba: 38, time: "11:07", assignee: "non assigné" },
  { id: "INC-2831", title: "Connexion hors horaires définis (02h34)", sev: "WARNING", status: "Résolue", src: "192.168.50.14", target: "p.muller@eu.local", rule: "Connexion Hors Horaires", ueba: 45, time: "02:34", assignee: "s.chen" },
  { id: "INC-2819", title: "Scan réseau interne non autorisé", sev: "INFO", status: "Résolue", src: "10.0.1.100", target: "Réseau 10.0.0.0/24", rule: "Scan Réseau Interne", ueba: 8, time: "23:12", assignee: "a.dupont" },
];

const SEV_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border border-red-500/30",
  HIGH: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  WARNING: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  INFO: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
};

const STATUS_CHIP: Record<string, string> = {
  Nouvelle: "bg-blue-500/12 text-blue-400 border border-blue-500/25",
  "En cours": "bg-orange-500/12 text-orange-400 border border-orange-500/25",
  Résolue: "bg-emerald-500/12 text-emerald-400 border border-emerald-500/25",
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
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono ${STATUS_CHIP[s] ?? "text-slate-400"}`}>{s}</span>;
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
    <div
      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono opacity-35 cursor-not-allowed bg-secondary/20 border border-border/40 text-slate-500 rounded-lg select-none"
      title="403 — Accès refusé — Rôle Analyste ou Administrateur requis"
      aria-disabled="true"
    >
      <Lock className="w-3 h-3 shrink-0" />
      {label}
    </div>
  );
}

function ForbiddenZone() {
  return (
    <div className="border border-slate-800/60 rounded-xl p-4 bg-secondary/8">
      <div className="flex items-center gap-2 mb-3">
        <Lock className="w-3.5 h-3.5 text-slate-600" />
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">Zone SOAR — Réponse automatisée</p>
      </div>
      <div className="flex items-start gap-3 p-3.5 bg-red-500/5 border border-red-500/12 rounded-lg">
        <div className="w-6 h-6 rounded bg-red-500/15 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[8px] font-mono font-bold text-red-400/80">403</span>
        </div>
        <div>
          <p className="text-[11px] font-mono text-slate-500 leading-relaxed">
            Droits insuffisants pour exécuter des réponses automatisées.
          </p>
          <p className="text-[10px] font-mono text-slate-600 mt-0.5">
            Contactez un Analyste SOC ou un Administrateur.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LecteurIncidentScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(INCIDENTS[0].id);
  const [sortBySev, setSortBySev] = useState(true);

  const sorted = sortBySev
    ? [...INCIDENTS].sort((a, b) => {
        const o = { CRITICAL: 0, HIGH: 1, WARNING: 2, INFO: 3 };
        return (o[a.sev as keyof typeof o] ?? 4) - (o[b.sev as keyof typeof o] ?? 4);
      })
    : INCIDENTS;

  const selected = selectedId ? INCIDENTS.find((i) => i.id === selectedId) ?? null : null;

  return (
    <div className="flex h-full overflow-hidden pb-6">
      {/* Left list */}
      <div className="w-85 shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary/10 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ReadOnlyTag />
            <span className="text-[10px] font-mono text-muted-foreground">{INCIDENTS.length} incidents</span>
          </div>
          <button
            onClick={() => setSortBySev(!sortBySev)}
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Filter className="w-2.5 h-2.5" /> {sortBySev ? "Sévérité" : "Date"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sorted.map((inc) => {
            const isSelected = selectedId === inc.id;
            const bl =
              inc.sev === "CRITICAL"
                ? "border-l-red-500"
                : inc.sev === "HIGH"
                  ? "border-l-orange-500"
                  : inc.sev === "WARNING"
                    ? "border-l-yellow-500"
                    : "border-l-blue-500/40";
            return (
              <button
                key={inc.id}
                onClick={() => setSelectedId(inc.id)}
                className={`w-full text-left px-4 py-3.5 border-b border-border/50 border-l-2 transition-all ${bl} ${isSelected ? "bg-amber-600/8 border-r-2 border-r-amber-500/40" : "hover:bg-secondary/30"}`}
              >
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
                  <span className="text-border">·</span>
                  <span>{inc.time}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right detail */}
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
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">22/06/2026 {selected.time}</span>
            </div>

            {/* Metadata — readable */}
            <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
              {[
                ["Règle déclenchée", selected.rule],
                ["IP source", selected.src],
                ["Utilisateur cible", selected.target],
                ["Analyste assigné", selected.assignee],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{k}</p>
                  <p className="font-mono text-foreground/80">{v}</p>
                </div>
              ))}
              <div className="col-span-2">
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Score UEBA comportemental</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        selected.ueba >= 80
                          ? "bg-linear-to-r from-red-600 to-red-400"
                          : selected.ueba >= 50
                            ? "bg-linear-to-r from-orange-600 to-orange-400"
                            : "bg-linear-to-r from-yellow-600 to-yellow-400"
                      }`}
                      style={{ width: `${selected.ueba}%` }}
                    />
                  </div>
                  <span
                    className={`text-sm font-bold font-mono ${
                      selected.ueba >= 80 ? "text-red-400" : selected.ueba >= 50 ? "text-orange-400" : "text-yellow-400"
                    }`}
                  >
                    {selected.ueba}
                    <span className="text-slate-600 text-xs">/100</span>
                  </span>
                </div>
              </div>
            </div>

            {/* DISABLED status actions */}
            <div className="bg-card border border-border/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-3.5 h-3.5 text-slate-600" />
                <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">Actions de statut — 403 Accès refusé</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <DisabledBtn label="Prendre en charge" />
                <DisabledBtn label="Changer le statut" />
                <DisabledBtn label="Clôturer (Résolu)" />
                <DisabledBtn label="Faux positif" />
              </div>
              <p className="text-[10px] font-mono text-slate-600 mt-2.5 italic">
                Rôle Analyste SOC ou Administrateur requis pour modifier l'état d'un incident.
              </p>
            </div>

            {/* DISABLED comment textarea */}
            <div className="bg-card border border-border/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-3.5 h-3.5 text-slate-600" />
                <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">Journal d'investigation — 403 Accès refusé</p>
              </div>
              <div className="relative">
                <textarea
                  disabled
                  rows={3}
                  className="w-full bg-secondary/15 border border-border/20 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 resize-none cursor-not-allowed select-none opacity-50 placeholder:text-slate-700"
                  placeholder="Zone de commentaire désactivée — Rôle Lecteur (403 FORBIDDEN)"
                  aria-disabled="true"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg">
                  <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-lg">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-mono text-slate-500">Accès lecture seule</span>
                  </div>
                </div>
              </div>
            </div>

            {/* FORBIDDEN SOAR zone */}
            <ForbiddenZone />
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