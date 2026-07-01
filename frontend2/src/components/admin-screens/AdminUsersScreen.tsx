import { useEffect, useState } from "react";
import { UserPlus, Edit2, Trash2, X, Eye, EyeOff, Loader2 } from "lucide-react";
import { adminApi, type UserRow } from "../../api/admin";

const ROLE_STYLE: Record<string, string> = {
  Admin:    "bg-violet-500/15 text-violet-700 border border-violet-500/25",
  Analyste: "bg-blue-500/15 text-blue-400 border border-blue-500/25",
  Lecteur:  "bg-slate-500/15 text-slate-700 border border-slate-500/25",
};

const STATUS_DOT: Record<string, string> = {
  Actif:   "bg-emerald-400",
  Inactif: "bg-slate-500",
};
const STATUS_TEXT: Record<string, string> = {
  Actif:   "text-emerald-400",
  Inactif: "text-slate-700",
};

function StatusPill({ s }: { s: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[s] ?? "bg-slate-500"}`} />
      <span className={`text-[11px] font-mono ${STATUS_TEXT[s] ?? "text-slate-700"}`}>{s}</span>
    </span>
  );
}

export default function UsersScreen() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({ username: "", role: "Analyste", scope: "Global", password: "" });

  const loadUsers = () => {
    setLoading(true);
    adminApi.users()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  if (error && !users.length) {
    return <div className="p-6 text-red-400 font-mono text-sm">Erreur : {error}</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Gestion des Utilisateurs — RBAC</h2>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
            {users.filter((u) => u.status === "Actif").length} utilisateurs actifs sur {users.length} comptes — PostgreSQL
          </p>
        </div>
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-mono rounded-lg transition-colors shadow">
          <UserPlus className="w-3.5 h-3.5" /> + Ajouter un utilisateur
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-muted-foreground font-mono text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                {["Nom d'utilisateur", "Rôle", "Périmètre", "Statut", "Dernière connexion", "Actions"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3.5 text-xs font-mono text-cyan-400 font-bold">{u.username}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-sm ${ROLE_STYLE[u.role] ?? ROLE_STYLE.Lecteur}`}>{u.role}</span>
                  </td>
                  <td className="px-5 py-3.5 text-[11px] font-mono text-muted-foreground">{u.scope}</td>
                  <td className="px-5 py-3.5"><StatusPill s={u.status} /></td>
                  <td className="px-5 py-3.5 text-[11px] font-mono text-muted-foreground">{u.last}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <button className="text-blue-400 hover:text-blue-300 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button className="text-red-500/70 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0d1423] border border-[#1e3058] rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-foreground">Créer un compte SOC</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">Contrôle d'accès RBAC — lecture seule PostgreSQL</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Nom d'utilisateur</label>
                <input className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                  placeholder="prenom.nom"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Rôle</label>
                  <select className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                    <option>Lecteur</option>
                    <option>Analyste</option>
                    <option>Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Périmètre</label>
                  <select className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                    value={form.scope}
                    onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}>
                    {["Global", "RH", "Filiale Europe", "Dev", "Prod"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Mot de passe temporaire</label>
                <div className="relative">
                  <input type={showPwd ? "text" : "password"}
                    className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 pr-10 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
                    placeholder="••••••••••••"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                  <button onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-mono border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
                Fermer
              </button>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground text-center mt-3">
              La création de comptes sera disponible via l&apos;API. Affichage des données PostgreSQL uniquement.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
