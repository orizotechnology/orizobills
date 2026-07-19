// =============================================================
// HTTP CLIENT
// Works in both Tauri WebView and browser dev server:
//   Tauri  → http://localhost:5000/api  (direct, no proxy)
//   Browser → http://localhost:5000/api  (direct, CORS allowed)
// Sends X-Branch-Id on every request for multi-tenant routing.
// =============================================================

import { useBranchStore } from "@/store/branch.store";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

// Always use the absolute backend URL — works in both Tauri WebView
// and browser because CORS allows localhost origins in development.
const API_BASE = "http://localhost:5000/api";

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, ...init } = options;
  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    );
    url += `?${qs.toString()}`;
  }

  const token    = localStorage.getItem("auth-token");
  const branchId = useBranchStore.getState().activeBranchId;

  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token    ? { Authorization: `Bearer ${token}` } : {}),
      ...(branchId ? { "X-Branch-Id": branchId }          : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error((err as { message?: string }).message ?? `HTTP ${response.status}`);
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export const http = {
  get:    <T>(ep: string, opts?: RequestOptions) =>
    request<T>(ep, { ...opts, method: "GET" }),
  post:   <T>(ep: string, data?: unknown, opts?: RequestOptions) =>
    request<T>(ep, { ...opts, method: "POST",  body: JSON.stringify(data) }),
  put:    <T>(ep: string, data?: unknown, opts?: RequestOptions) =>
    request<T>(ep, { ...opts, method: "PUT",   body: JSON.stringify(data) }),
  patch:  <T>(ep: string, data?: unknown, opts?: RequestOptions) =>
    request<T>(ep, { ...opts, method: "PATCH", body: JSON.stringify(data) }),
  delete: <T>(ep: string, opts?: RequestOptions) =>
    request<T>(ep, { ...opts, method: "DELETE" }),
};
