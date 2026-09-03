import { getAuthToken, getStationToken, clearAuth, clearStationAuth } from "./auth";

const API_BASE = "/api";

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  // Use station token if it's a station route, otherwise user token
  const token = endpoint.startsWith("/qr/scan/") ? getStationToken() : getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const isLoginReq = url.includes("login");
  const isLoginRoute =
    window.location.pathname === "/login" || window.location.pathname === "/station/login";
  if (response.status === 401 && typeof window !== "undefined" && !isLoginReq && !isLoginRoute) {
    clearAuth();
    clearStationAuth();
    const isStationRoute = window.location.pathname.startsWith("/station");
    window.location.replace(isStationRoute ? "/station/login" : "/login");
    // Throw so the caller's .catch() / onError handler is notified
    throw new Error("Session expired. Redirecting to login.");
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "Sebuah error terjadi, lapor jika error berkelanjutan.");
  }

  return data.data;
}
