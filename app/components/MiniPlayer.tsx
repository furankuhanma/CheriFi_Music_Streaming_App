import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "../context/PlayerContext";

export default function MiniPlayer() {
  const {
    currentTrack,
    isExpanded,
    setIsExpanded,
    isPlaying,
    isLoading,
    togglePlay,
    playNext,
    playPrevious,
    playbackPosition,
    duration,
  } = usePlayer();

  // Swipe up to expand
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        dy < -10 && Math.abs(dy) > Math.abs(dx),
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy < -30 || vy < -0.3) setIsExpanded(true);
      },
    }),
  ).current;

  // Progress as a percentage (0–100)
  const progress = duration > 0 ? (playbackPosition / duration) * 100 : 0;

  if (isExpanded) return null;

  return (
    <View
      {...panResponder.panHandlers}
      style={{
        backgroundColor: "#121212",
        borderTopWidth: 1,
        borderTopColor: "#282828",
      }}
    >
      <TouchableOpacity
        onPress={() => setIsExpanded(true)}
        activeOpacity={0.9}
        style={{ paddingHorizontal: 12, paddingVertical: 10 }}
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
          <IconButton
            name="play-skip-back"
            size={20}
            color="white"
            onPress={playPrevious}
          />

          {/* Show spinner while loading */}
          {isLoading ? (
            <ActivityIndicator color="white" style={{ padding: 8 }} />
          ) : (
            <IconButton
              name={isPlaying ? "pause" : "play"}
              size={22}
              color="white"
              onPress={togglePlay}
            />
          )}

          <IconButton
            name="play-skip-forward"
            size={20}
            color="white"
            onPress={playNext}
          />
        </View>

        {/* Progress Bar — synced to real playback position */}
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
              width: `${progress}%`,
              borderRadius: 1,
            }}
          />
        </View>
      </TouchableOpacity>
    </View>
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
