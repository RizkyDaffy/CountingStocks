const AUTH_TOKEN_KEY = "sugity-auth-token";
const AUTH_USER_KEY = "sugity-auth-user";

export type AuthUser = {
  id: number;
  username: string;
  role: string;
  tvFactory?: string;
  tvShift?: string;
  tvTheme?: string;
};

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function decodeTokenExpiry(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenValid(): boolean {
  const token = getAuthToken();
  if (!token) return false;
  const expiry = decodeTokenExpiry(token);
  if (expiry !== null && Date.now() >= expiry) {
    clearAuth();
    return false;
  }
  return true;
}

export function isAuthenticated(): boolean {
  return isTokenValid();
}

export function isAuthorizedUser(): boolean {
  const user = getAuthUser();
  return user?.role === "admin" || user?.role === "operator";
}

export function setAuth(token: string, user: AuthUser): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  if (!isTokenValid()) return null;
  const raw = localStorage.getItem(AUTH_USER_KEY);
  try {
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export const PUBLIC_PATHS = ["/login"];

const STATION_TOKEN_KEY = "sugity-station-token";
const STATION_DEVICE_KEY = "sugity-station-device";

export type StationDevice = {
  id: number;
  device_code: string;
  name: string;
  device_role: "IN" | "OUT";
  location: string;
};

export function setStationAuth(token: string, device: StationDevice): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATION_TOKEN_KEY, token);
  localStorage.setItem(STATION_DEVICE_KEY, JSON.stringify(device));
}

export function clearStationAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STATION_TOKEN_KEY);
  localStorage.removeItem(STATION_DEVICE_KEY);
}

export function getStationToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STATION_TOKEN_KEY);
}

export function getStationDevice(): StationDevice | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STATION_DEVICE_KEY);
  try {
    return raw ? (JSON.parse(raw) as StationDevice) : null;
  } catch {
    return null;
  }
}

export function isStationTokenValid(): boolean {
  const token = getStationToken();
  if (!token) return false;
  try {
    const part = token.split(".")[1];
    if (!part) return false;
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload.exp === "number" && Date.now() >= payload.exp * 1000) {
      clearStationAuth();
      return false;
    }
    return payload.type === "station";
  } catch {
    return false;
  }
}
