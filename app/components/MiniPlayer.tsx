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
import { useAlbumArtFade } from "../hooks/useAlbumArtFade";

export default function MiniPlayer() {
  const {
    currentTrack,
    isExpanded,
    setIsExpanded,
    isPlaying,
    isLoading,
    isInitialized,
    playbackError,
    retryLoad,
    togglePlay,
    playNext,
    playPrevious,
    playbackPosition,
    duration,
    isLiked,
    toggleLike,
  } = usePlayer();

  const albumArtOpacity = useAlbumArtFade(currentTrack?.id ?? "");

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

  const progress = duration > 0 ? (playbackPosition / duration) * 100 : 0;

  if (!currentTrack || isExpanded) return null;

  return (
    <View
      {...panResponder.panHandlers}
      style={{
        backgroundColor: "#121212",
        borderTopWidth: 1,
        borderTopColor: "#282828",
      }}
      accessible={false}
    >
      <TouchableOpacity
        onPress={() => setIsExpanded(true)}
        activeOpacity={0.9}
        style={{ paddingHorizontal: 12, paddingVertical: 10 }}
        accessibilityRole="button"
        accessibilityLabel={`Now playing: ${currentTrack.title} by ${currentTrack.artist.name}`}
        accessibilityHint="Double tap to open full player"
      >
        {/* Row: album art + info + controls */}
        <View
          style={{ flexDirection: "row", alignItems: "center" }}
          accessible={false}
        >
          <Animated.Image
            source={{ uri: currentTrack.coverUrl ?? undefined }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 4,
              marginRight: 10,
              opacity: albumArtOpacity,
            }}
            accessibilityLabel={`Album art for ${currentTrack.title}`}
            accessibilityIgnoresInvertColors
          />

          {/* Track info */}
          <View
            style={{ flex: 1 }}
            accessible
            accessibilityLabel={`${currentTrack.title}, ${currentTrack.artist.name}`}
          >
            <Text
              style={{ color: "white", fontSize: 13, fontWeight: "600" }}
              numberOfLines={1}
              accessibilityElementsHidden
            >
              {currentTrack.title}
            </Text>
            <Text
              style={{ color: "#B3B3B3", fontSize: 11 }}
              numberOfLines={1}
              accessibilityElementsHidden
            >
              {currentTrack.artist.name}
            </Text>
          </View>

          {/* Like button */}
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              toggleLike();
            }}
            style={{ padding: 8 }}
            accessibilityRole="button"
            accessibilityLabel={isLiked ? "Unlike track" : "Like track"}
            accessibilityHint={
              isLiked
                ? "Double tap to remove from liked songs"
                : "Double tap to add to liked songs"
            }
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={20}
              color={isLiked ? "#1DB954" : "#B3B3B3"}
            />
          </TouchableOpacity>

          <IconButton
            name="play-skip-back"
            size={20}
            color="white"
            onPress={playPrevious}
            accessibilityLabel="Previous track"
            accessibilityHint="Double tap to go to previous track"
          />

          {isLoading ? (
            <ActivityIndicator
              color="white"
              style={{ padding: 8 }}
              accessibilityLabel="Loading track"
            />
          ) : playbackError ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                retryLoad();
              }}
              style={{ padding: 8 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Playback error"
              accessibilityHint="Double tap to retry loading the track"
            >
              <Ionicons name="warning-outline" size={22} color="#FF4444" />
            </TouchableOpacity>
          ) : (
            <IconButton
              name={isPlaying ? "pause" : "play"}
              size={22}
              color="white"
              onPress={togglePlay}
              accessibilityLabel={isPlaying ? "Pause" : "Play"}
              accessibilityHint={
                isPlaying
                  ? "Double tap to pause playback"
                  : "Double tap to start playback"
              }
            />
          )}

          <IconButton
            name="play-skip-forward"
            size={20}
            color="white"
            onPress={playNext}
            accessibilityLabel="Next track"
            accessibilityHint="Double tap to skip to next track"
          />
        </View>

        {/* Progress bar */}
        <View
          style={{
            height: 2,
            backgroundColor: "#333",
            marginTop: 8,
            borderRadius: 1,
          }}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View
            style={{
              height: 2,
              backgroundColor: playbackError ? "#FF4444" : "#1DB954",
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
  accessibilityLabel,
  accessibilityHint,
}: {
  name: any;
  size: number;
  color: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ padding: 8 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <Ionicons name={name} size={size} color={color} />
    </TouchableOpacity>
  );
}
