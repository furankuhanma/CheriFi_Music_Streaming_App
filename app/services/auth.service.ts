import { api } from "./api";
import { AuthStore } from "../../stores/auth.store";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
};

type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

type MeResponse = {
  success: boolean;
  data: AuthUser;
};

// ─── Auth Service ─────────────────────────────────────────────────────────────

export const AuthService = {
  /**
   * Register with email + password.
   * Saves tokens to SecureStore on success.
   */
  async register(
    email: string,
    username: string,
    password: string,
  ): Promise<AuthUser> {
    const res = await api.post<{ success: boolean; data: AuthResponse }>(
      "/auth/register",
      { email, username, password },
    );
    await AuthStore.saveTokens(res.data.accessToken, res.data.refreshToken);
    return res.data.user;
  },

  /**
   * Login with email + password.
   * Saves tokens to SecureStore on success.
   */
  async login(email: string, password: string): Promise<AuthUser> {
    const res = await api.post<{ success: boolean; data: AuthResponse }>(
      "/auth/login",
      { email, password },
    );
    await AuthStore.saveTokens(res.data.accessToken, res.data.refreshToken);
    return res.data.user;
  },

  /**
   * OAuth login (Google or Apple).
   * The mobile app verifies the token with the provider, then sends us
   * the verified user info. Backend creates/links the account and returns tokens.
   */
  async oauthLogin(params: {
    provider: "google" | "apple";
    providerId: string;
    email: string;
    displayName?: string;
  }): Promise<AuthUser> {
    const res = await api.post<{ success: boolean; data: AuthResponse }>(
      "/auth/oauth",
      params,
    );
    await AuthStore.saveTokens(res.data.accessToken, res.data.refreshToken);
    return res.data.user;
  },

  /**
   * Fetch the currently authenticated user from the backend.
   * Used on app launch to restore session.
   */
  async me(): Promise<AuthUser> {
    const res = await api.get<MeResponse>("/auth/me");
    return res.data;
  },

  /**
   * Logout — clears tokens from SecureStore and invalidates refresh token.
   */
  async logout(): Promise<void> {
    try {
      const refreshToken = await AuthStore.getRefreshToken();
      if (refreshToken) {
        await api.post("/auth/logout", { refreshToken });
      }
    } catch {
      // Best-effort — always clear local tokens regardless
    } finally {
      await AuthStore.clearTokens();
    }
  },
};