import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { login, loginWithGoogle, isLoadingAuth, authError, clearAuthError } =
    useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errors: typeof fieldErrors = {};
    if (!email.trim()) errors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = "Enter a valid email";
    if (!password) errors.password = "Password is required";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleLogin() {
    clearAuthError();
    if (!validate()) return;
    try {
      await login(email.trim().toLowerCase(), password);
      // RouteGuard in _layout.tsx handles redirect automatically
    } catch {
      // authError is set by AuthContext — no extra handling needed here
    }
  }

  async function handleGoogle() {
    clearAuthError();
    await loginWithGoogle();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#121212" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 28,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Brand */}
        <View style={{ alignItems: "center", marginBottom: 48 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: "#1DB954",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="musical-notes" size={36} color="black" />
          </View>
          <Text
            style={{
              color: "white",
              fontSize: 28,
              fontWeight: "800",
              letterSpacing: -0.5,
            }}
          >
            CheriFi
          </Text>
          <Text style={{ color: "#888", fontSize: 14, marginTop: 6 }}>
            Sign in to continue listening
          </Text>
        </View>

        {/* Global error banner */}
        {authError && (
          <View
            style={{
              backgroundColor: "#2A1515",
              borderRadius: 10,
              padding: 12,
              marginBottom: 20,
              flexDirection: "row",
              alignItems: "center",
            }}
            accessible
            accessibilityRole="alert"
            accessibilityLabel={authError}
          >
            <Ionicons
              name="warning-outline"
              size={16}
              color="#FF4444"
              style={{ marginRight: 8 }}
            />
            <Text style={{ color: "#FF4444", fontSize: 13, flex: 1 }}>
              {authError}
            </Text>
          </View>
        )}

        {/* Email field */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              color: "#B3B3B3",
              fontSize: 13,
              fontWeight: "600",
              marginBottom: 8,
            }}
          >
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (fieldErrors.email)
                setFieldErrors((e) => ({ ...e, email: undefined }));
            }}
            placeholder="you@example.com"
            placeholderTextColor="#555"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            style={{
              backgroundColor: "#1E1E1E",
              borderRadius: 10,
              padding: 14,
              color: "white",
              fontSize: 15,
              borderWidth: 1,
              borderColor: fieldErrors.email ? "#FF4444" : "#2A2A2A",
            }}
            accessibilityLabel="Email address"
            accessibilityHint="Enter your email address"
          />
          {fieldErrors.email && (
            <Text style={{ color: "#FF4444", fontSize: 12, marginTop: 4 }}>
              {fieldErrors.email}
            </Text>
          )}
        </View>

        {/* Password field */}
        <View style={{ marginBottom: 8 }}>
          <Text
            style={{
              color: "#B3B3B3",
              fontSize: 13,
              fontWeight: "600",
              marginBottom: 8,
            }}
          >
            Password
          </Text>
          <View style={{ position: "relative" }}>
            <TextInput
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (fieldErrors.password)
                  setFieldErrors((e) => ({ ...e, password: undefined }));
              }}
              placeholder="Your password"
              placeholderTextColor="#555"
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              style={{
                backgroundColor: "#1E1E1E",
                borderRadius: 10,
                padding: 14,
                paddingRight: 48,
                color: "white",
                fontSize: 15,
                borderWidth: 1,
                borderColor: fieldErrors.password ? "#FF4444" : "#2A2A2A",
              }}
              accessibilityLabel="Password"
              accessibilityHint="Enter your password"
            />
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              style={{
                position: "absolute",
                right: 14,
                top: 0,
                bottom: 0,
                justifyContent: "center",
              }}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? "Hide password" : "Show password"
              }
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#555"
              />
            </TouchableOpacity>
          </View>
          {fieldErrors.password && (
            <Text style={{ color: "#FF4444", fontSize: 12, marginTop: 4 }}>
              {fieldErrors.password}
            </Text>
          )}
        </View>

        {/* Login button */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={isLoadingAuth}
          style={{
            backgroundColor: "#1DB954",
            borderRadius: 30,
            paddingVertical: 15,
            alignItems: "center",
            marginTop: 24,
            opacity: isLoadingAuth ? 0.7 : 1,
          }}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          accessibilityState={{ disabled: isLoadingAuth }}
        >
          {isLoadingAuth ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text style={{ color: "black", fontWeight: "700", fontSize: 15 }}>
              Sign In
            </Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginVertical: 24,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: "#2A2A2A" }} />
          <Text style={{ color: "#555", marginHorizontal: 12, fontSize: 13 }}>
            or
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: "#2A2A2A" }} />
        </View>

        {/* Google sign-in */}
        <TouchableOpacity
          onPress={handleGoogle}
          disabled={isLoadingAuth}
          style={{
            backgroundColor: "#1E1E1E",
            borderRadius: 30,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "#2A2A2A",
            opacity: isLoadingAuth ? 0.7 : 1,
          }}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Google"
        >
          {/* Google G icon via unicode — replace with an SVG asset if you have one */}
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: "white",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#4285F4" }}>
              G
            </Text>
          </View>
          <Text style={{ color: "white", fontWeight: "600", fontSize: 15 }}>
            Continue with Google
          </Text>
        </TouchableOpacity>

        {/* Register link */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginTop: 32,
          }}
        >
          <Text style={{ color: "#888", fontSize: 14 }}>
            Don't have an account?{" "}
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/register")}
            accessibilityRole="link"
            accessibilityLabel="Create an account"
          >
            <Text style={{ color: "#1DB954", fontWeight: "700", fontSize: 14 }}>
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
