import { Image, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Playlist } from "../services/playlists.api";

type Props = {
  playlist: Playlist;
  size?: number;
  rounded?: number;
};

function collectFallbackCovers(playlist: Playlist): string[] {
  const urls = (playlist.tracks ?? [])
    .map((item) => item.track?.coverUrl)
    .filter((url): url is string => Boolean(url));

  return [...new Set(urls)].slice(0, 4);
}

export default function PlaylistCover({
  playlist,
  size = 56,
  rounded = 8,
}: Props) {
  if (playlist.coverUrl) {
    return (
      <Image
        source={{ uri: playlist.coverUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: rounded,
          backgroundColor: "#282828",
        }}
      />
    );
  }

  const fallback = collectFallbackCovers(playlist);

  if (fallback.length === 0) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: rounded,
          backgroundColor: "#282828",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name="musical-notes"
          size={Math.max(18, size * 0.38)}
          color="#666"
        />
      </View>
    );
  }

  if (fallback.length === 1) {
    return (
      <Image
        source={{ uri: fallback[0] }}
        style={{
          width: size,
          height: size,
          borderRadius: rounded,
          backgroundColor: "#282828",
        }}
      />
    );
  }

  const tileSize = size / 2;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        overflow: "hidden",
        flexDirection: "row",
        flexWrap: "wrap",
        backgroundColor: "#202020",
      }}
    >
      {[0, 1, 2, 3].map((index) => {
        const uri = fallback[index];
        return uri ? (
          <Image
            key={uri + index}
            source={{ uri }}
            style={{ width: tileSize, height: tileSize }}
          />
        ) : (
          <View
            key={`empty-${index}`}
            style={{
              width: tileSize,
              height: tileSize,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#2A2A2A",
            }}
          >
            <Text style={{ color: "#666", fontSize: 10 }}>♪</Text>
          </View>
        );
      })}
    </View>
  );
}
