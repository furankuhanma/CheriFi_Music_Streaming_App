import "../global.css";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PlayerProvider } from "./context/PlayerContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";

// ─── Route Guard ──────────────────────────────────────────────────────────────
// Sits inside AuthProvider so it can read auth state.
// Redirects unauthenticated users to /login.
// Redirects authenticated users away from /login and /register.

function RouteGuard() {
  const { isLoggedIn, isLoadingAuth } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoadingAuth) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isLoggedIn && !inAuthGroup) {
      // Not logged in and not on an auth screen — send to login
      router.replace("/(auth)/login");
    } else if (isLoggedIn && inAuthGroup) {
      // Logged in but still on auth screen — send to app
      router.replace("/(tabs)/home");
    }
  }, [isLoggedIn, isLoadingAuth, segments]);

  // Show a splash while we check auth state on launch
  if (isLoadingAuth) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#121212",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color="#1DB954" size="large" />
      </View>
    );
  }

  return <Slot />;
}

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <SafeAreaProvider>
          <RouteGuard />
        </SafeAreaProvider>
      </PlayerProvider>
    </AuthProvider>
  );
}
