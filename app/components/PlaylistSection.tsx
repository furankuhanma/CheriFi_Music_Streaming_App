// CheriFi/components/PlaylistsSection.tsx
// Optional component — drop into home.tsx if you want a horizontal playlist row.
// Not required for "Add to Playlist" to work.

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PlaylistsService, Playlist } from "../services/playlists.api"; // ← correct import

type Props = {
  onPlaylistPress?: (playlist: Playlist) => void;
  refreshKey?: number;
};

export default function PlaylistsSection({
  onPlaylistPress,
  refreshKey,
}: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await PlaylistsService.getAll();
      setPlaylists(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading) {
    return <ActivityIndicator color="#1DB954" style={{ marginVertical: 16 }} />;
  }

  if (error) {
    return (
      <View className="flex-row items-center bg-[#1E1E1E] rounded-lg p-3 mx-1">
        <Ionicons name="warning-outline" size={16} color="#FF4444" />
        <Text className="text-[#FF4444] text-sm flex-1 ml-2">
          Couldn't load playlists.
        </Text>
        <TouchableOpacity onPress={load}>
          <Text className="text-[#1DB954] text-sm font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (playlists.length === 0) {
    return (
      <Text className="text-[#B3B3B3] text-sm px-1">No playlists yet.</Text>
    );
  }

  return (
    <FlatList
      data={playlists}
      keyExtractor={(item) => item.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
      renderItem={({ item }) => {
        const trackCount = item.tracks?.length ?? 0;
        return (
          <TouchableOpacity
            onPress={() => onPlaylistPress?.(item)}
            activeOpacity={0.8}
            style={{ width: 130 }}
          >
            <View
              style={{
                width: 130,
                height: 130,
                borderRadius: 8,
                backgroundColor: "#282828",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8,
              }}
            >
              <Ionicons name="musical-notes" size={36} color="#555" />
            </View>
            <Text
              style={{ color: "white", fontSize: 13, fontWeight: "600" }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={{ color: "#B3B3B3", fontSize: 12, marginTop: 2 }}>
              {trackCount} track{trackCount !== 1 ? "s" : ""}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}
