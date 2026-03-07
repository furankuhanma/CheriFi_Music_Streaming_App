import { Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const categories = [
  { label: "Pop", color: "#E13300" },
  { label: "Hip-Hop", color: "#8400E7" },
  { label: "Rock", color: "#1E3264" },
  { label: "R&B", color: "#E8115B" },
  { label: "Jazz", color: "#477D95" },
  { label: "Podcasts", color: "#006450" },
];

export default function SearchScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#121212]">
      <View className="px-4 pt-6">
        <Text className="text-white text-2xl font-bold mb-4">Search</Text>
        <View className="flex-row items-center bg-white rounded-lg px-3 mb-6 h-10">
          <Ionicons name="search" size={18} color="#121212" />
          <TextInput
            placeholder="Artists, songs, podcasts"
            placeholderTextColor="#666"
            className="flex-1 ml-2 text-black text-sm"
          />
        </View>
        <Text className="text-white font-bold text-base mb-3">
          Browse categories
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {categories.map((cat) => (
            <View
              key={cat.label}
              className="rounded-lg justify-end p-3"
              style={{ backgroundColor: cat.color, width: "47%", height: 80 }}
            >
              <Text className="text-white font-bold text-base">
                {cat.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
