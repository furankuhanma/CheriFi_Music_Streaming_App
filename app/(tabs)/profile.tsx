import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const stats = [
  { label: "Following", value: "24" },
  { label: "Followers", value: "118" },
];

export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#121212]">
      <ScrollView className="px-4 pt-6">
        <View className="items-center mb-6">
          <View className="w-24 h-24 rounded-full bg-[#282828] items-center justify-center mb-3">
            <Ionicons name="person" size={48} color="#B3B3B3" />
          </View>
          <Text className="text-white text-2xl font-bold">Your Name</Text>
          <View className="flex-row gap-6 mt-3">
            {stats.map((s) => (
              <View key={s.label} className="items-center">
                <Text className="text-white font-bold text-lg">{s.value}</Text>
                <Text className="text-[#B3B3B3] text-sm">{s.label}</Text>
              </View>
            ))}
          </View>
        </View>
        {["Recently Played", "Top Artists", "Top Tracks", "Settings"].map(
          (item) => (
            <View
              key={item}
              className="flex-row items-center justify-between py-4 border-b border-[#282828]"
            >
              <Text className="text-white text-base">{item}</Text>
              <Ionicons name="chevron-forward" size={20} color="#B3B3B3" />
            </View>
          ),
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
