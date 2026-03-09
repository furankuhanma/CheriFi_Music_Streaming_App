import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { AuthService, AuthUser } from "../services/auth.service";
import { AuthStore } from "../../stores/auth.store";

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
        if (!loggedIn) return;
        // Token exists — verify still valid, api.ts auto-refreshes if expired
        const me = await AuthService.me();
        setUser(me);
      } catch {
        // Token invalid — clear and force login
        await AuthStore.clearTokens();
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
    } finally {
      setUser(null);
      setIsLoadingAuth(false);
    }
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: user !== null,
        isLoadingAuth,
        authError,
        login,
        register,
        loginWithGoogle,
        logout,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
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
