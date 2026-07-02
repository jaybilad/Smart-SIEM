import { authFetch, errorMessage } from "./auth";

const API_BASE = "/api/lecteur";

async function fetchJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await authFetch(url.toString());
  if (!res.ok) {
    throw new Error(await errorMessage(res, `API lecteur ${path} - ${res.status}`));
  }
  return res.json() as Promise<T>;
}

export type LecteurDashboardData = {
  kpis: {
    total_logs: number;
    active_incidents: number;
    suspect_ips: number;
    assets: number;
  };
  hourly: { h: string; total: number; scope: number }[];
  top_alerts: { type: string; count: number }[];
  compliance: { label: string; value: number; target: number; unit: string; up: boolean }[];
  audit_kpis: {
    incidents_month: number;
    resolved_month: number;
    resolution_rate: number;
    anomalies_month: number;
    coverage: number;
  };
  top_ips: { ip: string; count: number; sev: string }[];
};

export type LecteurIncidentRow = {
  id: string;
  uuid: string;
  title: string;
  description: string;
  rule: string;
  sev: string;
  status: string;
  src: string;
  target: string;
  time: string;
  created_at: string;
  assignee: string | null;
};

export type LecteurLogRow = {
  id: string;
  ts: string;
  src: string;
  dst: string;
  event: string;
  user: string;
  detail: string;
  sev: string;
  machine: string;
};

export type LecteurLogSearchData = {
  stats: {
    total_events: number;
    unique_sources: number;
    unique_users: number;
    triggered_rules: number;
  };
  volume: { h: string; v: number }[];
  results: LecteurLogRow[];
};

export type LecteurUebaData = {
  stats: { monitored: number; critical: number; anomalies_7d: number };
  rows: {
    user: string;
    score: number;
    anomalies: number;
    last: string;
    delta: string;
    detail: string;
    model_version: string;
  }[];
};

export const lecteurApi = {
  dashboard: () => fetchJson<LecteurDashboardData>("/dashboard"),
  incidents: () => fetchJson<LecteurIncidentRow[]>("/incidents"),
  searchLogs: (q: string, range: string) => fetchJson<LecteurLogSearchData>("/logs/search", { q, range }),
  ueba: () => fetchJson<LecteurUebaData>("/ueba"),
};
