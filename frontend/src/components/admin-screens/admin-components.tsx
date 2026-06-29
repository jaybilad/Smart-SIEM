import React from "react";
import { AlertTriangle, Check } from "lucide-react";

/* ════════════════════════════════════════════════════════════════════════════
   COMPOSANTS RÉUTILISABLES - DASHBOARD ADMIN
   ════════════════════════════════════════════════════════════════════════════ */

// ── SEVERITY BADGE ──────────────────────────────────────────────────────────

const SEV_STYLE: Record<string, string> = {
  CRITICAL:
    "bg-red-500/15 text-red-400 border border-red-500/30",
  HIGH: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  WARNING:
    "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  INFO: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  LOW: "bg-slate-500/15 text-slate-400 border border-slate-500/30",
};

export function SevBadge({ s }: { s: string }) {
  const style = SEV_STYLE[s] || SEV_STYLE.LOW;
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold tracking-widest ${style}`}
    >
      {s}
    </span>
  );
}

// ── STATUS PILL ─────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  Actif: "bg-emerald-400",
  Inactif: "bg-slate-500",
  Ouvert: "bg-red-400 animate-pulse",
  "En cours": "bg-orange-400 animate-pulse",
  Résolu: "bg-emerald-400",
};

const STATUS_TEXT: Record<string, string> = {
  Actif: "text-emerald-400",
  Inactif: "text-slate-500",
  Ouvert: "text-red-400",
  "En cours": "text-orange-400",
  Résolu: "text-emerald-400",
};

export function StatusPill({ s }: { s: string }) {
  const dotClass = STATUS_DOT[s] || "bg-slate-500";
  const textClass = STATUS_TEXT[s] || "text-slate-400";

  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      <span className={`text-[11px] font-mono ${textClass}`}>{s}</span>
    </span>
  );
}

// ── CHART TOOLTIP ───────────────────────────────────────────────────────────

export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-[#090e1b] border border-[#1a2540] rounded-md px-3 py-2 text-[11px] font-mono shadow-xl">
      <p className="text-slate-400 mb-1 pb-1 border-b border-[#1a2540]">
        {label}
      </p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.stroke ?? p.fill ?? p.color }}>
          {p.name ?? p.dataKey}:{" "}
          <span className="font-semibold">
            {typeof p.value === "number"
              ? p.value.toLocaleString("fr-FR")
              : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

// ── SECTION HEADER ──────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {count && (
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
            {count}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

// ── STAT CARD ───────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  sub,
  Icon,
  color,
  bg,
}: {
  label: string;
  value: string;
  sub: string;
  Icon: React.ReactNode;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
      <div className={`p-2.5 rounded-lg border ${bg}`}>{Icon}</div>
      <div>
        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider leading-none mb-1">
          {label}
        </p>
        <p className={`text-2xl font-bold font-mono leading-none ${color}`}>
          {value}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1.5">{sub}</p>
      </div>
    </div>
  );
}

// ── ALERT BANNER ────────────────────────────────────────────────────────────

export function AlertBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-lg">
      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
      <p className="text-[10px] font-mono text-emerald-400/90 leading-relaxed">
        {message}
      </p>
    </div>
  );
}

// ── ERROR BANNER ────────────────────────────────────────────────────────────

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3 bg-red-500/8 border border-red-500/20 rounded-lg">
      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
      <p className="text-[10px] font-mono text-red-400/90 leading-relaxed">
        {message}
      </p>
    </div>
  );
}

// ── ROLE BADGE ──────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, string> = {
  Admin: "bg-violet-500/15 text-violet-400 border border-violet-500/25",
  Analyste: "bg-blue-500/15 text-blue-400 border border-blue-500/25",
  Lecteur: "bg-slate-500/15 text-slate-400 border border-slate-500/25",
};

export function RoleBadge({ role }: { role: string }) {
  const style = ROLE_STYLE[role] || ROLE_STYLE.Lecteur;
  return (
    <span
      className={`text-[10px] font-mono px-2 py-0.5 rounded-sm ${style}`}
    >
      {role}
    </span>
  );
}

// ── LOADING SPINNER ─────────────────────────────────────────────────────────

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 bg-linear-to-r from-blue-600 to-transparent rounded-full animate-spin" />
        <div className="absolute inset-1 bg-[#0a0e18] rounded-full" />
      </div>
    </div>
  );
}

// ── EMPTY STATE ─────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-4xl text-muted-foreground/30 mb-3">{Icon}</div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-[11px] text-muted-foreground">{message}</p>
    </div>
  );
}

// ── TABLE WRAPPER ───────────────────────────────────────────────────────────

export function TableWrapper({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              {headers.map((h) => (
                <th
                  key={h}
                  className="text-left px-5 py-3 text-[10px] text-muted-foreground font-mono uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── MODAL WRAPPER ───────────────────────────────────────────────────────────

import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#0d1423] border border-[#1e3058] rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4 mb-6">{children}</div>
        <div className="flex gap-3">{actions}</div>
      </div>
    </div>
  );
}

// ── FORM INPUT ──────────────────────────────────────────────────────────────

export function FormInput({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">
        {label}
      </label>
      <input
        type={type}
        className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ── FORM SELECT ─────────────────────────────────────────────────────────────

export function FormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">
        {label}
      </label>
      <select
        className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-blue-500/60 transition-colors"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── TOGGLE SWITCH ───────────────────────────────────────────────────────────

export function ToggleSwitch({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-9 h-5 rounded-full transition-colors ${
        value
          ? "bg-emerald-500/30 border border-emerald-500/50"
          : "bg-secondary border border-border"
      }`}
    >
      <span
        className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all duration-200 ${
          value
            ? "left-[18px] bg-emerald-400 shadow shadow-emerald-500/50"
            : "left-0.5 bg-slate-500"
        }`}
      />
    </button>
  );
}

// ── PROGRESS BAR ────────────────────────────────────────────────────────────

export function ProgressBar({
  value,
  max = 100,
  color = "bg-cyan-500",
}: {
  value: number;
  max?: number;
  color?: string;
}) {
  const percentage = (value / max) * 100;

  return (
    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-700`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// ── TAB NAVIGATION ──────────────────────────────────────────────────────────

export function TabNavigation({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="flex bg-secondary/60 rounded-lg p-0.5 gap-0.5">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-3 py-1.5 text-[11px] font-mono rounded-md transition-all ${
            active === tab
              ? "bg-primary text-white shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}