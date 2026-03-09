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
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

export default function RegisterScreen() {
  const {
    register,
    loginWithGoogle,
    isLoadingAuth,
    authError,
    clearAuthError,
  } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    username?: string;
    password?: string;
  }>({});

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errors: typeof fieldErrors = {};

    if (!email.trim()) errors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = "Enter a valid email";

    if (!username.trim()) errors.username = "Username is required";
    else if (username.length < 3) errors.username = "At least 3 characters";
    else if (username.length > 30) errors.username = "Maximum 30 characters";
    else if (!/^[a-zA-Z0-9_]+$/.test(username))
      errors.username = "Letters, numbers and underscores only";

    if (!password) errors.password = "Password is required";
    else if (password.length < 8) errors.password = "At least 8 characters";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleRegister() {
    clearAuthError();
    if (!validate()) return;
    try {
      await register(email.trim().toLowerCase(), username.trim(), password);
    } catch {
      // authError handled by AuthContext
    }
  }

  async function handleGoogle() {
    clearAuthError();
    await loginWithGoogle();
  }

  // ── Field helper ────────────────────────────────────────────────────────────

  function clearFieldError(field: keyof typeof fieldErrors) {
    setFieldErrors((e) => ({ ...e, [field]: undefined }));
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#121212" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 28,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: 36 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginBottom: 24, alignSelf: "flex-start", padding: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <Text
            style={{
              color: "white",
              fontSize: 28,
              fontWeight: "800",
              letterSpacing: -0.5,
            }}
          >
            Create account
          </Text>
          <Text style={{ color: "#888", fontSize: 14, marginTop: 6 }}>
            Join CheriFi and start listening
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

        {/* Email */}
        <Field
          label="Email"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            clearFieldError("email");
          }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          error={fieldErrors.email}
          accessibilityLabel="Email address"
        />

        {/* Username */}
        <Field
          label="Username"
          value={username}
          onChangeText={(t) => {
            setUsername(t);
            clearFieldError("username");
          }}
          placeholder="your_username"
          autoCapitalize="none"
          autoCorrect={false}
          error={fieldErrors.username}
          accessibilityLabel="Username"
          hint="3–30 characters, letters, numbers and underscores only"
        />

        {/* Password */}
        <View style={{ marginBottom: 16 }}>
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
                clearFieldError("password");
              }}
              placeholder="At least 8 characters"
              placeholderTextColor="#555"
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
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
              accessibilityHint="At least 8 characters"
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

        {/* Strength hint */}
        {password.length > 0 && <PasswordStrength password={password} />}

        {/* Register button */}
        <TouchableOpacity
          onPress={handleRegister}
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
          accessibilityLabel="Create account"
          accessibilityState={{ disabled: isLoadingAuth }}
        >
          {isLoadingAuth ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text style={{ color: "black", fontWeight: "700", fontSize: 15 }}>
              Create Account
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

        {/* Google */}
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
          accessibilityLabel="Continue with Google"
        >
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

        {/* Login link */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginTop: 32,
          }}
        >
          <Text style={{ color: "#888", fontSize: 14 }}>
            Already have an account?{" "}
          </Text>
          <TouchableOpacity
            onPress={() => router.replace("/(auth)/login")}
            accessibilityRole="link"
            accessibilityLabel="Sign in"
          >
            <Text style={{ color: "#1DB954", fontWeight: "700", fontSize: 14 }}>
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Field component ──────────────────────────────────────────────────────────

function Field({
  label,
  error,
  hint,
  accessibilityLabel,
  ...props
}: {
  label: string;
  error?: string;
  hint?: string;
  accessibilityLabel: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: "#B3B3B3",
          fontSize: 13,
          fontWeight: "600",
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <TextInput
        placeholderTextColor="#555"
        style={{
          backgroundColor: "#1E1E1E",
          borderRadius: 10,
          padding: 14,
          color: "white",
          fontSize: 15,
          borderWidth: 1,
          borderColor: error ? "#FF4444" : "#2A2A2A",
        }}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={hint}
        {...props}
      />
      {error && (
        <Text style={{ color: "#FF4444", fontSize: 12, marginTop: 4 }}>
          {error}
        </Text>
      )}
    </View>
  );
}

// ─── Password strength indicator ──────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const strength = checks.filter(Boolean).length;
  const colors = ["#FF4444", "#FF8C00", "#FFD700", "#1DB954"];
  const labels = ["Weak", "Fair", "Good", "Strong"];

  return (
    <View style={{ marginBottom: 16, marginTop: -8 }}>
      <View style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: i < strength ? colors[strength - 1] : "#2A2A2A",
            }}
          />
        ))}
      </View>
      <Text style={{ color: colors[strength - 1] ?? "#555", fontSize: 11 }}>
        {strength > 0 ? labels[strength - 1] : ""}
      </Text>
    </View>
  );
}
