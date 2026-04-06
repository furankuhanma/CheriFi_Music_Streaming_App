import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "cherifi_access_token";
const REFRESH_TOKEN_KEY = "cherifi_refresh_token";
const USER_KEY = "cherifi_auth_user";
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "cherifi.auth.tokens",
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

type StoredUser = {
  id: string;
  email: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
};

export const AuthStore = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY, SECURE_STORE_OPTIONS);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY, SECURE_STORE_OPTIONS);
  },

  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await SecureStore.setItemAsync(
      ACCESS_TOKEN_KEY,
      accessToken,
      SECURE_STORE_OPTIONS,
    );
    await SecureStore.setItemAsync(
      REFRESH_TOKEN_KEY,
      refreshToken,
      SECURE_STORE_OPTIONS,
    );

    // Defensive read-back to catch unexpected storage failures early.
    const [savedAccessToken, savedRefreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY, SECURE_STORE_OPTIONS),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY, SECURE_STORE_OPTIONS),
    ]);

    if (!savedAccessToken || !savedRefreshToken) {
      throw new Error("Failed to persist auth session");
    }
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY, SECURE_STORE_OPTIONS),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, SECURE_STORE_OPTIONS),
    ]);
  },

  async isLoggedIn(): Promise<boolean> {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY, SECURE_STORE_OPTIONS),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY, SECURE_STORE_OPTIONS),
    ]);

    return accessToken !== null && refreshToken !== null;
  },

  async saveUser(user: StoredUser): Promise<void> {
    await SecureStore.setItemAsync(
      USER_KEY,
      JSON.stringify(user),
      SECURE_STORE_OPTIONS,
    );
  },

  async getUser(): Promise<StoredUser | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY, SECURE_STORE_OPTIONS);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      return null;
    }
  },

  async clearUser(): Promise<void> {
    await SecureStore.deleteItemAsync(USER_KEY, SECURE_STORE_OPTIONS);
  },
};