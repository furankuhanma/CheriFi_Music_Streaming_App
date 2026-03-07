import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const recentItems = ["Liked Songs", "Daily Mix 1", "Top Hits", "Chill Vibes"];
const featured = ["Trending", "New Releases", "Podcasts"];

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#121212]">
      <ScrollView className="px-4 pt-6">
        <Text className="text-white text-2xl font-bold mb-6">
          Good evening 👋
        </Text>

        <View className="flex-row flex-wrap gap-2 mb-8">
          {recentItems.map((item) => (
            <View
              key={item}
              className="bg-[#282828] rounded-md flex-row items-center overflow-hidden"
              style={{ width: "48%", height: 56 }}
            >
              <View className="w-14 h-14 bg-[#1DB954]" />
              <Text
                className="text-white font-semibold text-sm ml-3 flex-1"
                numberOfLines={1}
              >
                {item}
              </Text>
            </View>
          ))}
        </View>

        <Text className="text-white text-xl font-bold mb-4">Featured</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-8"
        >
          {featured.map((item) => (
            <View key={item} className="bg-[#282828] rounded-xl p-3 mr-3 w-40">
              <View className="w-full h-32 bg-[#1DB954] rounded-lg mb-3" />
              <Text className="text-white font-semibold">{item}</Text>
              <Text className="text-[#B3B3B3] text-xs mt-1">Updated today</Text>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}
