export type UserRole = "Admin" | "Analyste" | "Lecteur";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  scope: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: "bearer";
  user: AuthUser;
  redirect_to: string;
};

const TOKEN_KEY = "token";
const USER_KEY = "user";
const ROLE_KEY = "role";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    clearSession();
    return null;
  }
}

export function isSessionValid(): boolean {
  const token = getStoredToken();
  if (!token) return false;

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return false;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      clearSession();
      return false;
    }
    return true;
  } catch {
    clearSession();
    return false;
  }
}

export function getDashboardPath(role?: string | null): string {
  if (role === "Admin") return "/dashboard-admin";
  if (role === "Analyste") return "/dashboard-soc";
  if (role === "Lecteur") return "/dashboard-lecteur";
  return "/";
}

export function saveSession(session: LoginResponse) {
  localStorage.setItem(TOKEN_KEY, session.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  localStorage.setItem(ROLE_KEY, session.user.role);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error(await errorMessage(res, "Connexion refusee"));
  }

  const session = (await res.json()) as LoginResponse;
  saveSession(session);
  return session;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    clearSession();
    if (window.location.pathname !== "/") {
      window.location.assign("/");
    }
  }
  return res;
}

export async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail
        .map((d: { msg?: string } | string) => (typeof d === "string" ? d : d.msg ?? String(d)))
        .join(" ; ");
    }
  } catch {
    // Response body is not JSON.
  }
  return fallback;
}
