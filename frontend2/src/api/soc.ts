import { authFetch, errorMessage } from "./auth";

const API_BASE = "/api/soc";

async function fetchJson<T>(path: string, params?: Record<string, string>, init?: RequestInit): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await authFetch(url.toString(), init);
  if (!res.ok) {
    throw new Error(await errorMessage(res, path));
  }
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, path));
  }
  return res.json() as Promise<T>;
}

export type SocIncidentRow = {
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
  date?: string;
  machine?: string;
  ueba?: number;
};

export type SocDashboardData = {
  stats: {
    active_incidents: number;
    critical_incidents: number;
    alerts_24h: number;
    ingestion_rate: number;
    mttr_minutes: number;
    resolved_count: number;
  };
  trend: { t: string; c: number; h: number; m: number }[];
  severity_distribution: { label: string; count: number; pct: number }[];
  recent_incidents: SocIncidentRow[];
  soc: {
    high_open_incidents: number;
    high_risk_hosts: number;
    ueba_max_score: number;
    ueba_top_user: string | null;
    log_volume: { t: string; v: number }[];
    top_ips: { ip: string; count: number; sev: string }[];
  };
};

export type SocUserRow = {
  id: string;
  username: string;
  role: string;
  scope: string;
  status: string;
  last: string;
};

export type SocTakeIncidentResponse = {
  success: boolean;
  incident: {
    id: string;
    uuid: string;
    title: string;
    status: string;
    assigned_to: string | null;
    updated_at: string;
  };
};

export type SocIncidentActionRow = {
  id: string;
  action_name: string;
  action_note: string;
  executed_by: string;
  execution_status: string;
  execution_time: string;
};

export type SocAddActionResponse = {
  success: boolean;
  action: {
    id: string;
    incident_id: string;
    executed_by: string;
    execution_status: string;
    execution_time: string;
    action_note: string;
  };
};

export type SocLogRow = {
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

export type SocLogSearchData = {
  stats: {
    total_events: number;
    unique_sources: number;
    unique_users: number;
    triggered_rules: number;
  };
  volume: { h: string; v: number }[];
  results: SocLogRow[];
};

export type SocPlaybookRow = {
  id: string;
  name: string;
  sev: string;
  desc: string;
  auto: boolean;
  triggers: number;
  lastRun: string;
  rules: string[];
};

export const socApi = {
  dashboard: () => fetchJson<SocDashboardData>("/dashboard"),
  incidents: (status?: string) =>
    fetchJson<SocIncidentRow[]>("/incidents", status ? { status } : undefined),
  updateIncidentStatus: (uuid: string, status: string) =>
    fetchJson<SocIncidentRow>(`/incidents/${uuid}/status`, { status }, { method: "PATCH" }),
  users: () => fetchJson<SocUserRow[]>("/users"),
  takeIncident: (uuid: string, analystId: string) =>
    postJson<SocTakeIncidentResponse>(`/incidents/${uuid}/take`, { analyst_id: analystId }),
  incidentActions: (uuid: string) =>
    fetchJson<SocIncidentActionRow[]>(`/incidents/${uuid}/actions`),
  addIncidentAction: (uuid: string, payload: { analyst_id: string; action_note: string; execution_status: string }) =>
    postJson<SocAddActionResponse>(`/incidents/${uuid}/actions`, payload),
  searchLogs: (q: string, range: string) =>
    fetchJson<SocLogSearchData>("/logs/search", { q, range }),
  playbooks: () => fetchJson<SocPlaybookRow[]>("/playbooks"),
};
