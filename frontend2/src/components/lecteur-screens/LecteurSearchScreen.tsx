import { useState } from "react";
import { Terminal, Lock, Flag, Eye, X } from "lucide-react";

const LOG_EVENTS = [
  { id: "e01", ts: "2026-06-22T14:58:01Z", src: "185.107.47.215", dst: "10.0.2.15", event: "AUTH_SUCCESS", user: "j.bernard", detail: "Connexion réussie depuis nœud TOR sortant", sev: "CRITICAL", machine: "WS-EU-047" },
  { id: "e02", ts: "2026-06-22T14:57:55Z", src: "185.107.47.215", dst: "10.0.2.15", event: "AUTH_FAILURE", user: "j.bernard", detail: "Tentative auth refusée — MFA non validé", sev: "HIGH", machine: "WS-EU-047" },
  { id: "e03", ts: "2026-06-22T14:47:30Z", src: "192.168.10.33", dst: "sharepoint.eu.local", event: "FILE_DOWNLOAD", user: "k.ibrahim", detail: "Téléchargement 2,4 Go en 8 minutes — 340 fichiers", sev: "CRITICAL", machine: "WS-EU-088" },
  { id: "e04", ts: "2026-06-22T14:40:12Z", src: "192.168.10.33", dst: "sharepoint.eu.local", event: "FILE_ACCESS", user: "k.ibrahim", detail: "Accès à 340 fichiers confidentiels en parcours", sev: "HIGH", machine: "WS-EU-088" },
  { id: "e05", ts: "2026-06-22T11:07:44Z", src: "41.214.100.30", dst: "10.0.3.21", event: "AUTH_SUCCESS", user: "m.legrand", detail: "Connexion depuis Nigeria — pays non référencé", sev: "WARNING", machine: "WS-RH-EU-011" },
  { id: "e06", ts: "2026-06-22T09:30:10Z", src: "192.168.10.55", dst: "10.0.5.100", event: "ACCESS_DENIED", user: "t.werner", detail: "Accès aux serveurs Prod refusé — hors périmètre", sev: "WARNING", machine: "WS-EU-031" },
  { id: "e07", ts: "2026-06-22T08:55:42Z", src: "40.99.12.200", dst: "login.microsoft365", event: "AUTH_ANOMALY", user: "s.lemaire", detail: "Token Office 365 généré depuis IP inconnue", sev: "WARNING", machine: "cloud-O365-EU" },
  { id: "e08", ts: "2026-06-22T02:34:18Z", src: "192.168.50.14", dst: "10.0.2.30", event: "AUTH_SUCCESS", user: "p.muller", detail: "Connexion à 02h34 — hors plages horaires", sev: "WARNING", machine: "WS-EU-023" },
  { id: "e09", ts: "2026-06-21T23:12:04Z", src: "10.0.1.100", dst: "10.0.2.45", event: "SCAN_INTERNAL", user: "N/A", detail: "Scan réseau interne depuis poste non identifié", sev: "INFO", machine: "UNKNOWN" },
];

const SEV_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border border-red-500/30",
  HIGH: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  WARNING: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  INFO: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
};

const SEV_DOT: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  WARNING: "#eab308",
  INFO: "#3b82f6",
};

function SevBadge({ s }: { s: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold tracking-widest ${SEV_BADGE[s] ?? SEV_BADGE.INFO}`}>
      {s === "CRITICAL" && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
      {s}
    </span>
  );
}

function ReadOnlyTag() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-600 border border-slate-800 rounded px-1.5 py-0.5 select-none">
      <Lock className="w-2.5 h-2.5" /> LECTURE SEULE
    </span>
  );
}

export default function LecteurSearchScreen() {
  const [filters, setFilters] = useState({ ip: "", user: "", type: "", sev: "", time: "24h" });
  const [inspectEvent, setInspectEvent] = useState<typeof LOG_EVENTS[0] | null>(null);
  const [timelineSel, setTimelineSel] = useState<string | null>(null);

  const filtered = LOG_EVENTS.filter((e) => {
    if (filters.ip && !e.src.includes(filters.ip)) return false;
    if (filters.user && !e.user.toLowerCase().includes(filters.user.toLowerCase())) return false;
    if (filters.type && !e.event.includes(filters.type.toUpperCase())) return false;
    if (filters.sev && e.sev !== filters.sev) return false;
    return true;
  });

  return (
    <div className="p-5 space-y-4 pb-10">
      {/* Filter form */}
      <div className="bg-card border border-[#1a3a5c] rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 border-b border-border/50 pb-3">
          <Terminal className="w-4 h-4 text-cyan-500 shrink-0" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Recherche multi-critères — Consultation de l'historique</span>
          <ReadOnlyTag />
        </div>
        <div className="grid grid-cols-5 gap-3">
          {[
            { key: "ip", placeholder: "IP source…", label: "IP Source/Dest." },
            { key: "user", placeholder: "ex: j.bernard", label: "Utilisateur" },
            { key: "type", placeholder: "AUTH, SCAN, FILE…", label: "Type de log" },
          ].map((f) => (
            <div key={f.key}>
              <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block mb-1.5">{f.label}</label>
              <input
                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground outline-none focus:border-cyan-500/50 transition-colors placeholder:text-slate-600"
                placeholder={f.placeholder}
                value={filters[f.key as keyof typeof filters]}
                onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <div>
            <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block mb-1.5">Criticité</label>
            <select
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground outline-none focus:border-cyan-500/50 transition-colors"
              value={filters.sev}
              onChange={(e) => setFilters((p) => ({ ...p, sev: e.target.value }))}
            >
              <option value="">Toutes</option>
              {["CRITICAL", "HIGH", "WARNING", "INFO"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block mb-1.5">Plage horaire</label>
            <div className="flex gap-1">
              {["1h", "6h", "24h", "7j"].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilters((p) => ({ ...p, time: t }))}
                  className={`flex-1 py-1.5 text-[10px] font-mono rounded-md transition-all ${
                    filters.time === t
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                      : "bg-secondary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
        <span>
          <span className="text-foreground font-bold">{filtered.length}</span> événements
        </span>
        <span>
          <span className="text-red-400 font-bold">{filtered.filter((e) => e.sev === "CRITICAL").length}</span> critiques
        </span>
        <div className="flex items-center gap-1.5 ml-auto text-[10px] text-slate-600">
          <Lock className="w-2.5 h-2.5" />
          Marquage d'événements désactivé — Rôle Lecteur (403)
        </div>
      </div>

      {/* Interactive timeline */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-foreground">Timeline interactive des événements</p>
          <p className="text-[10px] font-mono text-muted-foreground">Cliquer sur un point pour lire le document JSON normalisé</p>
        </div>
        <div className="overflow-x-auto">
          <div className="relative" style={{ height: 80, minWidth: 560 }}>
            <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
            {filtered.map((e, i) => {
              const pct = (i / Math.max(filtered.length - 1, 1)) * 94 + 2;
              const isSel = timelineSel === e.id;
              return (
                <button
                  key={e.id}
                  onClick={() => {
                    setTimelineSel(e.id);
                    setInspectEvent(e);
                  }}
                  className={`absolute top-1/2 -translate-y-1/2 rounded-full transition-all hover:scale-150 focus:outline-none ${
                    isSel ? "scale-150 ring-2 ring-white/40" : ""
                  }`}
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
            {filtered.length > 0 && (
              <>
                <span className="absolute bottom-0 left-0 text-[9px] font-mono text-muted-foreground">{filtered[filtered.length - 1]?.ts.slice(11, 16)}</span>
                <span className="absolute bottom-0 right-0 text-[9px] font-mono text-muted-foreground">{filtered[0]?.ts.slice(11, 16)}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[9px] font-mono text-muted-foreground">
          {[
            ["CRITICAL", "#ef4444"],
            ["HIGH", "#f97316"],
            ["WARNING", "#eab308"],
            ["INFO", "#3b82f6"],
          ].map(([s, c]) => (
            <span key={s} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Results table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary/10 flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">Résultats</p>
          <span className="text-[10px] font-mono text-muted-foreground">{filtered.length} entrées</span>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-slate-700">
            <Lock className="w-2.5 h-2.5" />
            Marquage désactivé (403)
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                {["Marquage", "Horodatage", "Source IP", "Destination", "Type d'événement", "Utilisateur", "Détail", "Sev.", "JSON"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[9px] text-muted-foreground font-mono uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-border/20 hover:bg-secondary/15 transition-colors">
                  <td className="px-3 py-2.5">
                    <div
                      className="flex items-center gap-0.5 opacity-25 cursor-not-allowed select-none"
                      title="403 — Marquage d'événements désactivé — Rôle Lecteur"
                    >
                      <Lock className="w-2.5 h-2.5 text-slate-500" />
                      <Flag className="w-3 h-3 text-slate-500" />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[10px] font-mono text-slate-500 whitespace-nowrap">{e.ts.replace("T", " ").replace("Z", "")}</td>
                  <td className="px-3 py-2.5 text-[10px] font-mono text-orange-300">{e.src}</td>
                  <td className="px-3 py-2.5 text-[10px] font-mono text-slate-400 max-w-27.5 truncate">{e.dst}</td>
                  <td className="px-3 py-2.5 text-[10px] font-mono text-cyan-400 font-bold whitespace-nowrap">{e.event}</td>
                  <td className="px-3 py-2.5 text-[10px] font-mono text-blue-300">{e.user}</td>
                  <td className="px-3 py-2.5 text-[10px] text-muted-foreground max-w-45 truncate">{e.detail}</td>
                  <td className="px-3 py-2.5">
                    <SevBadge s={e.sev} />
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setInspectEvent(e)}
                      className="text-[10px] font-mono text-slate-500 hover:text-amber-400 flex items-center gap-1 transition-colors whitespace-nowrap"
                    >
                      <Eye className="w-3 h-3" /> Lire
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Inspector modal */}
      {inspectEvent && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0d1423] border border-[#1e3058] rounded-2xl shadow-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-foreground font-mono">Document JSON normalisé — Lecture seule</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {inspectEvent.id} — {inspectEvent.event}
                  </span>
                  <SevBadge s={inspectEvent.sev} />
                  <ReadOnlyTag />
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
                  "destination.host": inspectEvent.dst,
                  "user.name": inspectEvent.user,
                  "host.hostname": inspectEvent.machine,
                  message: inspectEvent.detail,
                  "observer.product": "SmartSIEM",
                  "observer.version": "4.2.1",
                  "access.role": "LECTEUR",
                  "access.type": "READ_ONLY",
                  "access.scope": "Audit & Conformité",
                  "audit.logged": true,
                  tags: ["audit-conformite", "lecture-seule", inspectEvent.sev.toLowerCase()],
                },
                null,
                2
              )}
            </pre>
            <div className="flex items-center justify-between mt-4">
              <p className="text-[10px] font-mono text-slate-600 flex items-center gap-1.5">
                <Eye className="w-2.5 h-2.5" /> Consultation journalisée dans l'audit log SIEM — c.martin
              </p>
              <button
                onClick={() => setInspectEvent(null)}
                className="px-4 py-2 text-xs font-mono border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}