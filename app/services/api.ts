import { AuthStore } from "../../stores/auth.store";

// ─── Config ───────────────────────────────────────────────────────────────────
// Use your machine's local IP so the phone/emulator can reach the backend.
// Find it with: ip addr show | grep "inet " (Linux) or ipconfig (Windows)
// Replace with your actual local IP when testing on a real device.
const BASE_URL = "http://192.168.100.52:3000/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Token refresh state ──────────────────────────────────────────────────────
// Prevents multiple simultaneous refresh calls if several requests fail at once

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await AuthStore.getRefreshToken();
  if (!refreshToken) throw new ApiError(401, "No refresh token");

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    await AuthStore.clearTokens();
    throw new ApiError(401, "Session expired — please log in again");
  }

  const data = await res.json();
  const { accessToken, refreshToken: newRefreshToken } = data.data;
  await AuthStore.saveTokens(accessToken, newRefreshToken);
  return accessToken;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const accessToken = await AuthStore.getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // ── Token expired — attempt refresh then retry once ───────────────────────
  if (res.status === 401 && retry) {
    if (isRefreshing) {
      // Wait for the in-progress refresh to complete
      const newToken = await new Promise<string>((resolve) => {
        refreshQueue.push(resolve);
      });
      return request<T>(path, options, false);
    }

    isRefreshing = true;
    try {
      const newToken = await refreshAccessToken();
      refreshQueue.forEach((resolve) => resolve(newToken));
      refreshQueue = [];
      return request<T>(path, options, false);
    } finally {
      isRefreshing = false;
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? `Request failed: ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: "GET" });
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },

  // Returns the full stream URL for expo-av to use directly
  streamUrl(trackId: string): string {
    return `${BASE_URL}/tracks/${trackId}/stream`;
  },
};