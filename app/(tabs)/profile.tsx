import {
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";
import { useBottomOverlaySpacing } from "../hooks/useBottomOverlaySpacing";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const bottomContentPadding = useBottomOverlaySpacing(16);

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  // Prioritize: displayName → username → email → "Your Name"
  const displayName =
    user?.displayName || user?.username || user?.email || "Your Name";

  // Generate initials from the display name
  const initials = displayName
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
    .padEnd(2, "U");

  return (
    <SafeAreaView className="flex-1 bg-[#121212]">
      <ScrollView
        className="px-4 pt-6"
        contentContainerStyle={{ paddingBottom: bottomContentPadding }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-white text-2xl font-bold mb-6">Profile</Text>

        {/* ── Avatar + Name ── */}
        <View className="items-center mb-8">
          {user?.avatarUrl ? (
            <Image
              source={{ uri: user.avatarUrl }}
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: "#282828",
              }}
            />
          ) : (
            <View className="w-24 h-24 rounded-full bg-[#282828] items-center justify-center mb-1">
              <Text className="text-white text-3xl font-bold">{initials}</Text>
            </View>
          )}
          <Text className="text-white text-2xl font-bold mt-3">
            {displayName}
          </Text>
          {user?.username && (
            <Text className="text-[#B3B3B3] text-sm mt-1">
              @{user.username}
            </Text>
          )}
          <Text className="text-[#555] text-xs mt-1">{user?.email}</Text>
        </View>

        {/* ── Account Info ── */}
        <View className="mb-6">
          <Text className="text-[#B3B3B3] text-xs font-semibold uppercase tracking-widest mb-2 px-1">
            Account
          </Text>
          <View className="bg-[#1E1E1E] rounded-xl border border-[#282828] overflow-hidden">
            <View className="flex-row items-center px-4 py-3.5 border-b border-[#282828]">
              <Ionicons name="person-outline" size={18} color="#B3B3B3" />
              <View className="ml-3 flex-1">
                <Text className="text-[#888] text-xs mb-0.5">Username</Text>
                <Text className="text-white text-sm">@{user?.username}</Text>
              </View>
            </View>
            <View className="flex-row items-center px-4 py-3.5">
              <Ionicons name="mail-outline" size={18} color="#B3B3B3" />
              <View className="ml-3 flex-1">
                <Text className="text-[#888] text-xs mb-0.5">Email</Text>
                <Text className="text-white text-sm">{user?.email}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Log Out ── */}
        <View className="mb-10">
          <Text className="text-[#B3B3B3] text-xs font-semibold uppercase tracking-widest mb-2 px-1">
            Session
          </Text>
          <View className="bg-[#1E1E1E] rounded-xl border border-[#282828] overflow-hidden">
            <TouchableOpacity
              onPress={handleLogout}
              className="flex-row items-center px-4 py-3.5"
            >
              <Ionicons name="log-out-outline" size={18} color="#FF4D4D" />
              <Text className="text-[#FF4D4D] text-sm font-semibold ml-3 flex-1">
                Log out
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#FF4D4D" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
