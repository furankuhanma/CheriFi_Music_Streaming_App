import { AuthStore } from "../../stores/auth.store";

// ─── Config ───────────────────────────────────────────────────────────────────
// Use your machine's local IP so the phone/emulator can reach the backend.
// Find it with: ip addr show | grep "inet " (Linux) or ipconfig (Windows)
// Replace with your actual local IP when testing on a real device.
const BASE_URL = "https://frank-loui-lapore-hp-probook-640-g1.tail11c2e9.ts.net/api";

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

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

const AUTH_PATHS_THAT_SHOULD_NOT_REFRESH = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
  "/auth/oauth",
];

function shouldAttemptRefresh(path: string): boolean {
  return !AUTH_PATHS_THAT_SHOULD_NOT_REFRESH.some((authPath) =>
    path.startsWith(authPath),
  );
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await AuthStore.getRefreshToken();
  if (!refreshToken) {
    await AuthStore.clearTokens(); // ensure clean state
    throw new ApiError(401, "No refresh token — please log in again");
  }

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

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
  accessTokenOverride?: string,
): Promise<T> {
  const accessToken = accessTokenOverride ?? (await AuthStore.getAccessToken());

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry && shouldAttemptRefresh(path)) {
    if (isRefreshing) {
      // Wait for the in-progress refresh, then use the new token
      const newToken = await new Promise<string | null>((resolve) => {
        refreshQueue.push(resolve);
      });

      if (!newToken) throw new ApiError(401, "Session expired");

      // ✅ Actually inject the new token instead of re-reading storage
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${newToken}`,
      };
      return request<T>(
        path,
        { ...options, headers: retryHeaders },
        false,
        newToken,
      );
    }

    isRefreshing = true;
    try {
      const newToken = await refreshAccessToken();
      refreshQueue.forEach((resolve) => resolve(newToken)); // ✅ pass token
      refreshQueue = [];
      return request<T>(path, options, false, newToken);
    } catch (err) {
      refreshQueue.forEach((resolve) => resolve(null)); // ✅ unblock queue on failure
      refreshQueue = [];
      throw err;
    } finally {
      isRefreshing = false;
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.error ?? `Request failed: ${res.status}`,
    );
  }

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