import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const playlists = [
  { name: "Liked Songs", count: "124 songs", icon: "heart" },
  { name: "My Playlist #1", count: "32 songs", icon: "musical-notes" },
  { name: "Workout Mix", count: "18 songs", icon: "fitness" },
  { name: "Late Night", count: "45 songs", icon: "moon" },
];

export default function LibraryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#121212]">
      <View className="px-4 pt-6 flex-row justify-between items-center mb-6">
        <Text className="text-white text-2xl font-bold">Your Library</Text>
        <Ionicons name="add" size={28} color="white" />
      </View>
      <ScrollView className="px-4">
        {playlists.map((item) => (
          <View key={item.name} className="flex-row items-center mb-5">
            <View className="w-14 h-14 bg-[#282828] rounded-md items-center justify-center mr-4">
              <Ionicons name={item.icon as any} size={24} color="#1DB954" />
            </View>
            <View>
              <Text className="text-white font-semibold text-base">
                {item.name}
              </Text>
              <Text className="text-[#B3B3B3] text-sm mt-0.5">
                Playlist · {item.count}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
