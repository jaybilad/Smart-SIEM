const API_BASE = "/api/admin";

async function fetchJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(await errorMessage(res, path));
  }
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, path));
  }
  return res.json() as Promise<T>;
}

async function errorMessage(res: Response, path: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map((d: { msg?: string } | string) => typeof d === "string" ? d : d.msg ?? String(d)).join(" ; ");
    }
  } catch {
    // Response body is not JSON.
  }
  return `API ${path} (${res.status})`;
}

export type DashboardData = {
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
  recent_incidents: IncidentRow[];
};

export type IncidentRow = {
  id: string;
  uuid?: string;
  title: string;
  description?: string;
  sev: string;
  status: string;
  src: string;
  target?: string;
  time: string;
  created_at?: string;
  assignee: string | null;
};

export type CreateIncidentPayload = {
  title: string;
  description?: string;
  severity: string;
  attack_type: string;
  source_ip?: string;
  target?: string;
  assigned_to?: string | null;
};

export type LogSearchData = {
  stats: {
    total_events: number;
    unique_sources: number;
    unique_users: number;
    triggered_rules: number;
  };
  volume: { h: string; v: number }[];
  results: {
    ts: string;
    src: string;
    dst: string;
    event: string;
    user: string;
    detail: string;
    sev: string;
  }[];
};

export type UebaData = {
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

export type UserRow = {
  id: string;
  username: string;
  role: string;
  scope: string;
  status: string;
  last: string;
};

export type RuleRow = {
  id: string;
  name: string;
  sev: string;
  on: boolean;
  threshold: number;
  window: number;
  desc: string;
  playbook: string;
  attack_type: string;
};

export type InfraData = {
  cluster: {
    status: string;
    active: number;
    total: number;
    nodes: { name: string; role: string; status: string }[];
  };
  storage: {
    pct: number;
    used_tb: number;
    total_tb: number;
    available_tb: number;
    alert_threshold_pct: number;
  };
  ingestion: { current: number; history: { t: string; v: number }[] };
  retention: { days: number; sealed: boolean; sealed_at: string | null };
  audit_log: { ts: string; user: string; action: string; ip: string }[];
};

export const adminApi = {
  dashboard: () => fetchJson<DashboardData>("/dashboard"),
  incidents: (status?: string) =>
    fetchJson<IncidentRow[]>("/incidents", status ? { status } : undefined),
  createIncident: (payload: CreateIncidentPayload) =>
    postJson<IncidentRow>("/incidents", payload),
  searchLogs: (q: string, range: string) =>
    fetchJson<LogSearchData>("/logs/search", { q, range }),
  ueba: () => fetchJson<UebaData>("/ueba"),
  users: () => fetchJson<UserRow[]>("/users"),
  rules: () => fetchJson<RuleRow[]>("/rules"),
  infra: () => fetchJson<InfraData>("/infra"),
};
