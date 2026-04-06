import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { AuthService, AuthUser } from "../services/auth.service";
import { AuthStore } from "../../stores/auth.store";
import { ApiError } from "../services/api";
import { RecommendationsService } from "../services/recommendations.service";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthContextType = {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isLoadingAuth: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
  ) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // ── Restore session on app launch ──────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const loggedIn = await AuthStore.isLoggedIn();
        if (!loggedIn) {
          setIsLoadingAuth(false);
          return;
        }

        const accessToken = await AuthStore.getAccessToken();
        if (!accessToken) {
          await AuthStore.clearTokens();
          await AuthStore.clearUser();
          setIsLoadingAuth(false);
          return;
        }

        // Add significant delay before checking session to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));

        try {
          const me = await AuthService.me();
          // Persist latest user data locally so we can restore it offline
          await AuthStore.saveUser(me);
          setUser(me);
        } catch (err) {
          const isAuthError =
            err instanceof ApiError &&
            (err.status === 401 || err.status === 403);

          if (isAuthError) {
            // Genuine auth failure — wipe everything and force re-login
            await AuthStore.clearTokens();
            await AuthStore.clearUser();
          } else {
            // Network is down or server error — restore from local cache
            // so the user can access the app offline without logging in again
            const cachedUser = await AuthStore.getUser();
            if (cachedUser) {
              setUser(cachedUser);
            }
            // If no cached user yet (first ever launch offline), user stays
            // null and will be redirected to login — expected behaviour.
          }
        }
      } finally {
        setIsLoadingAuth(false);
      }
    })();
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const authedUser = await AuthService.login(email, password);
      // Cache user so it's available on next offline launch
      await AuthStore.saveUser(authedUser);
      setUser(authedUser);
    } catch (err) {
      setAuthError(extractMessage(err));
      throw err;
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      setIsLoadingAuth(true);
      setAuthError(null);
      try {
        const authedUser = await AuthService.register(
          email,
          username,
          password,
        );
        // Cache user so it's available on next offline launch
        await AuthStore.saveUser(authedUser);
        setUser(authedUser);
      } catch (err) {
        setAuthError(extractMessage(err));
        throw err;
      } finally {
        setIsLoadingAuth(false);
      }
    },
    [],
  );

  // Google OAuth — stubbed out, will be implemented later
  const loginWithGoogle = useCallback(async () => {
    setAuthError("Google sign-in coming soon. Please use email and password.");
  }, []);

  const logout = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      await AuthService.logout();
      // Bust the feed cache so next login shows fresh content
      RecommendationsService.bustFeedCache();
    } finally {
      // Clear cached user on explicit logout
      await AuthStore.clearUser();
      setUser(null);
      setIsLoadingAuth(false);
    }
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isLoggedIn: user !== null,
      isLoadingAuth,
      authError,
      login,
      register,
      loginWithGoogle,
      logout,
      clearAuthError,
    }),
    [
      user,
      isLoadingAuth,
      authError,
      login,
      register,
      loginWithGoogle,
      logout,
      clearAuthError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

export default function AuthContextModule() {
  return null;
}
