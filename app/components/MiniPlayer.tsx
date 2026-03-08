import React from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "../context/PlayerContext";

export default function MiniPlayer() {
  const { currentTrack, isExpanded, setIsExpanded, isPlaying, setIsPlaying } =
    usePlayer();

  // Hide when expanded
  if (isExpanded) return null;

  return (
    <TouchableOpacity
      onPress={() => setIsExpanded(true)}
      activeOpacity={0.9}
      style={{
        backgroundColor: "#121212",
        borderTopWidth: 1,
        borderTopColor: "#282828",
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      {/* Row: album art + info + controls */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Animated.Image
          source={{ uri: currentTrack.albumArt }}
          style={{ width: 44, height: 44, borderRadius: 4, marginRight: 10 }}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: "white", fontSize: 13, fontWeight: "600" }}
            numberOfLines={1}
          >
            {currentTrack.title}
          </Text>
          <Text style={{ color: "#B3B3B3", fontSize: 11 }} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
        </View>

        <IconButton name="heart-outline" size={20} color="#B3B3B3" />
        <IconButton name="play-skip-back" size={20} color="white" />
        <IconButton
          name={isPlaying ? "pause" : "play"}
          size={22}
          color="white"
          onPress={() => setIsPlaying(!isPlaying)}
        />
        <IconButton name="play-skip-forward" size={20} color="white" />
      </View>

      {/* Progress Bar */}
      <View
        style={{
          height: 2,
          backgroundColor: "#333",
          marginTop: 8,
          borderRadius: 1,
        }}
      >
        <View
          style={{
            height: 2,
            backgroundColor: "#1DB954",
            width: "30%",
            borderRadius: 1,
          }}
        />
      </View>
    </TouchableOpacity>
  );
}

function IconButton({
  name,
  size,
  color,
  onPress,
}: {
  name: any;
  size: number;
  color: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={{ padding: 8 }}>
      <Ionicons name={name} size={size} color={color} />
    </TouchableOpacity>
  );
}
