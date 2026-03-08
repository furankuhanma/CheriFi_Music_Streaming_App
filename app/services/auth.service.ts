import { api } from "./api";
import { AuthStore } from "../../stores/auth.store";

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
};

type AuthResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

// ─── Auth service ─────────────────────────────────────────────────────────────

export const AuthService = {
  async register(
    email: string,
    username: string,
    password: string,
  ): Promise<User> {
    const res = await api.post<{ success: boolean; data: AuthResponse }>(
      "/auth/register",
      { email, username, password },
    );
    await AuthStore.saveTokens(res.data.accessToken, res.data.refreshToken);
    return res.data.user;
  },

  async login(email: string, password: string): Promise<User> {
    const res = await api.post<{ success: boolean; data: AuthResponse }>(
      "/auth/login",
      { email, password },
    );
    await AuthStore.saveTokens(res.data.accessToken, res.data.refreshToken);
    return res.data.user;
  },

  async logout(): Promise<void> {
    const refreshToken = await AuthStore.getRefreshToken();
    if (refreshToken) {
      await api.post("/auth/logout", { refreshToken }).catch(() => null);
    }
    await AuthStore.clearTokens();
  },

  async me(): Promise<User> {
    const res = await api.get<{ success: boolean; data: User }>("/auth/me");
    return res.data;
  },

  // Called after Google/Apple sign-in on the client side.
  // Pass the verified provider info — backend issues its own JWT.
  async oauthLogin(
    provider: "google" | "apple",
    providerId: string,
    email: string,
    displayName?: string,
  ): Promise<User> {
    const res = await api.post<{ success: boolean; data: AuthResponse }>(
      "/auth/oauth",
      { provider, providerId, email, displayName },
    );
    await AuthStore.saveTokens(res.data.accessToken, res.data.refreshToken);
    return res.data.user;
  },
};