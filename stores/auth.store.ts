import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "cherifi_access_token";
const REFRESH_TOKEN_KEY = "cherifi_refresh_token";
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "cherifi.auth.tokens",
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
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
};