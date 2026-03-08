import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
  Modal,
  Share,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  usePlayer,
  RepeatMode,
  PlaybackErrorType,
} from "../context/PlayerContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlbumArtFade } from "../hooks/useAlbumArtFade";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const DISMISS_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 0.5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function repeatIcon(mode: RepeatMode): { name: any; color: string } {
  if (mode === "one") return { name: "repeat-outline", color: "#1DB954" };
  if (mode === "all") return { name: "repeat", color: "#1DB954" };
  return { name: "repeat", color: "#B3B3B3" };
}

function repeatLabel(mode: RepeatMode): string {
  if (mode === "one") return "Repeat: one track";
  if (mode === "all") return "Repeat: all tracks";
  return "Repeat: off";
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function errorMessage(error: PlaybackErrorType): string {
  switch (error) {
    case "network":
      return "No connection. Check your network and try again.";
    case "unsupported":
      return "This track format isn't supported on your device.";
    case "interrupted":
      return "Playback was interrupted. Tap to resume.";
    case "load_failed":
    default:
      return "Couldn't load this track. Tap to retry.";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExpandedPlayer() {
  const {
    currentTrack,
    isExpanded,
    setIsExpanded,
    isPlaying,
    isLoading,
    playbackError,
    retryLoad,
    togglePlay,
    playNext,
    playPrevious,
    playbackPosition,
    duration,
    isShuffle,
    toggleShuffle,
    repeatMode,
    cycleRepeat,
  } = usePlayer();

  const insets = useSafeAreaInsets();

  // translateY uses useNativeDriver: true — runs on the UI thread
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // albumSize uses useNativeDriver: false — JS driven (width/height not
  // supported by the native driver). Must NEVER be animated in the same
  // Animated.parallel() as translateY or React Native will throw.
  const albumSize = useRef(new Animated.Value(280)).current;

  const isDragging = useRef(false);
  const [showContextMenu, setShowContextMenu] = useState(false);

  const albumArtOpacity = useAlbumArtFade(currentTrack.id);

  // ── Slide in / out ────────────────────────────────────────────────────────
  // translateY and albumSize are animated separately to avoid mixing
  // useNativeDriver: true and useNativeDriver: false in the same parallel call.
  useEffect(() => {
    if (isDragging.current) {
      isDragging.current = false;
      return;
    }

    // Native driver — translateY only
    Animated.spring(translateY, {
      toValue: isExpanded ? 0 : SCREEN_HEIGHT,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();

    // JS driver — albumSize only
    Animated.spring(albumSize, {
      toValue: isExpanded ? 280 : 44,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
  }, [isExpanded]);

  // ── Swipe down to dismiss ─────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        dy > 10 && Math.abs(dy) > Math.abs(dx),
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) translateY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > DISMISS_THRESHOLD || vy > VELOCITY_THRESHOLD) {
          isDragging.current = true;
          setIsExpanded(false);
          Animated.spring(translateY, {
            toValue: SCREEN_HEIGHT,
            useNativeDriver: true,
            bounciness: 0,
            speed: 20,
            velocity: vy,
          }).start();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
    }),
  ).current;

  const progress = duration > 0 ? (playbackPosition / duration) * 100 : 0;
  const repeat = repeatIcon(repeatMode);

  // ── Play button — three states: loading / error / normal ─────────────────
  const renderPlayButton = () => {
    if (isLoading) {
      return (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: "white",
            alignItems: "center",
            justifyContent: "center",
          }}
          accessible
          accessibilityLabel="Loading track"
          accessibilityRole="progressbar"
        >
          <ActivityIndicator color="black" />
        </View>
      );
    }

    if (playbackError) {
      return (
        <TouchableOpacity
          onPress={retryLoad}
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: "#FF4444",
            alignItems: "center",
            justifyContent: "center",
          }}
          accessibilityRole="button"
          accessibilityLabel="Retry loading track"
          accessibilityHint="Double tap to try loading the track again"
        >
          <Ionicons name="refresh" size={28} color="white" />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        onPress={togglePlay}
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: "white",
          alignItems: "center",
          justifyContent: "center",
        }}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Pause" : "Play"}
        accessibilityHint={
          isPlaying
            ? "Double tap to pause playback"
            : "Double tap to start playback"
        }
      >
        <Ionicons name={isPlaying ? "pause" : "play"} size={32} color="black" />
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#121212",
          transform: [{ translateY }],
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
          paddingHorizontal: 24,
          alignItems: "center",
        }}
        {...panResponder.panHandlers}
        accessibilityViewIsModal={isExpanded}
      >
        {/* Drag Handle — decorative */}
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: "#555",
            marginBottom: 16,
          }}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />

        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            marginBottom: 32,
          }}
          accessible={false}
        >
          <IconButton
            name="chevron-down"
            size={28}
            color="white"
            onPress={() => setIsExpanded(false)}
            accessibilityLabel="Close player"
            accessibilityHint="Double tap to collapse the player"
          />
          <Text
            style={{
              color: "white",
              flex: 1,
              textAlign: "center",
              fontWeight: "600",
              fontSize: 14,
            }}
            accessibilityRole="header"
          >
            Now Playing
          </Text>
          <IconButton
            name="ellipsis-horizontal"
            size={24}
            color="white"
            onPress={() => setShowContextMenu(true)}
            accessibilityLabel="More options"
            accessibilityHint="Double tap to open track options menu"
          />
        </View>

        {/* Album Art — JS-driven size, native-driven opacity */}
        <Animated.Image
          source={{ uri: currentTrack.albumArt }}
          style={{
            width: albumSize,
            height: albumSize,
            borderRadius: 8,
            marginBottom: 32,
            opacity: playbackError
              ? albumArtOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.4],
                })
              : albumArtOpacity,
          }}
          accessibilityLabel={`Album art for ${currentTrack.title}`}
          accessibilityIgnoresInvertColors
        />

        {/* Track Info + Like */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            marginBottom: 24,
          }}
          accessible={false}
        >
          <View
            style={{ flex: 1 }}
            accessible
            accessibilityLabel={`${currentTrack.title} by ${currentTrack.artist}`}
          >
            <Text
              style={{ color: "white", fontSize: 22, fontWeight: "700" }}
              numberOfLines={1}
              accessibilityElementsHidden
            >
              {currentTrack.title}
            </Text>
            <Text
              style={{ color: "#B3B3B3", fontSize: 15, marginTop: 4 }}
              numberOfLines={1}
              accessibilityElementsHidden
            >
              {currentTrack.artist}
            </Text>
          </View>
          <IconButton
            name="heart-outline"
            size={24}
            color="#B3B3B3"
            accessibilityLabel="Like track"
            accessibilityHint="Double tap to like this track"
          />
        </View>

        {/* Error banner */}
        {playbackError && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#2A1515",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginBottom: 16,
              width: "100%",
            }}
            accessible
            accessibilityRole="alert"
            accessibilityLabel={errorMessage(playbackError)}
          >
            <Ionicons
              name="warning-outline"
              size={16}
              color="#FF4444"
              style={{ marginRight: 8 }}
              accessibilityElementsHidden
            />
            <Text
              style={{ color: "#FF4444", fontSize: 13, flex: 1 }}
              accessibilityElementsHidden
            >
              {errorMessage(playbackError)}
            </Text>
          </View>
        )}

        {/* Progress Bar */}
        <View
          style={{ width: "100%", marginBottom: 8 }}
          accessible
          accessibilityLabel={`Playback position: ${formatTime(playbackPosition)} of ${formatTime(duration)}`}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: duration,
            now: playbackPosition,
          }}
        >
          <View
            style={{ height: 4, backgroundColor: "#333", borderRadius: 2 }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View
              style={{
                height: 4,
                backgroundColor: playbackError ? "#FF4444" : "#1DB954",
                width: `${progress}%`,
                borderRadius: 2,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 6,
            }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={{ color: "#B3B3B3", fontSize: 11 }}>
              {formatTime(playbackPosition)}
            </Text>
            <Text style={{ color: "#B3B3B3", fontSize: 11 }}>
              {formatTime(duration)}
            </Text>
          </View>
        </View>

        {/* Main Controls */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            marginTop: 16,
          }}
          accessible={false}
        >
          <IconButton
            name="shuffle"
            size={22}
            color={isShuffle ? "#1DB954" : "#B3B3B3"}
            onPress={toggleShuffle}
            accessibilityLabel={isShuffle ? "Shuffle: on" : "Shuffle: off"}
            accessibilityHint="Double tap to toggle shuffle"
          />
          <IconButton
            name="play-skip-back"
            size={32}
            color="white"
            onPress={playPrevious}
            accessibilityLabel="Previous track"
            accessibilityHint="Double tap to go to previous track or restart current track"
          />

          {renderPlayButton()}

          <IconButton
            name="play-skip-forward"
            size={32}
            color="white"
            onPress={playNext}
            accessibilityLabel="Next track"
            accessibilityHint="Double tap to skip to next track"
          />
          <View accessible={false}>
            <IconButton
              name={repeat.name}
              size={22}
              color={repeat.color}
              onPress={cycleRepeat}
              accessibilityLabel={repeatLabel(repeatMode)}
              accessibilityHint="Double tap to cycle repeat mode"
            />
            {repeatMode === "one" && (
              <Text
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  color: "#1DB954",
                  fontSize: 8,
                  fontWeight: "700",
                }}
                accessibilityElementsHidden
              >
                1
              </Text>
            )}
          </View>
        </View>

        {/* Bottom Actions */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            width: "100%",
            marginTop: 32,
          }}
          accessible={false}
        >
          <IconButton
            name="share-outline"
            size={22}
            color="#B3B3B3"
            onPress={async () => {
              try {
                await Share.share({
                  message: `Now listening to ${currentTrack.title} by ${currentTrack.artist}`,
                });
              } catch {}
            }}
            accessibilityLabel="Share track"
            accessibilityHint="Double tap to share this track"
          />
          <IconButton
            name="add-circle-outline"
            size={22}
            color="#B3B3B3"
            onPress={() => Alert.alert("Add to Playlist", "Coming soon")}
            accessibilityLabel="Add to playlist"
            accessibilityHint="Double tap to add this track to a playlist"
          />
          <IconButton
            name="download-outline"
            size={22}
            color="#B3B3B3"
            onPress={() => Alert.alert("Download", "Coming soon")}
            accessibilityLabel="Download track"
            accessibilityHint="Double tap to download this track for offline listening"
          />
          <IconButton
            name="mic-outline"
            size={22}
            color="#B3B3B3"
            onPress={() => Alert.alert("Lyrics", "Coming soon")}
            accessibilityLabel="Show lyrics"
            accessibilityHint="Double tap to view track lyrics"
          />
          <IconButton
            name="list-outline"
            size={22}
            color="#B3B3B3"
            accessibilityLabel="Show queue"
            accessibilityHint="Double tap to view the play queue"
          />
        </View>
      </Animated.View>

      {/* ── Context Menu Modal ────────────────────────────────────────────── */}
      <Modal
        visible={showContextMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowContextMenu(false)}
        accessibilityViewIsModal
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={() => setShowContextMenu(false)}
          accessibilityLabel="Close menu"
          accessibilityHint="Double tap to dismiss the options menu"
        />
        <View
          style={{
            backgroundColor: "#282828",
            borderRadius: 12,
            padding: 16,
            marginHorizontal: 16,
            marginBottom: 40,
          }}
        >
          <Text
            style={{
              color: "white",
              fontWeight: "700",
              fontSize: 16,
              marginBottom: 16,
              textAlign: "center",
            }}
            accessibilityRole="header"
          >
            {currentTrack.title}
          </Text>
          {[
            { icon: "musical-notes-outline", label: "Go to Album" },
            { icon: "person-outline", label: "Go to Artist" },
            { icon: "radio-outline", label: "Go to Song Radio" },
            { icon: "flag-outline", label: "Report Track" },
          ].map(({ icon, label }) => (
            <TouchableOpacity
              key={label}
              onPress={() => {
                setShowContextMenu(false);
                Alert.alert(label, `${label} coming soon`);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
              }}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <Ionicons
                name={icon as any}
                size={22}
                color="white"
                style={{ marginRight: 16 }}
                accessibilityElementsHidden
              />
              <Text
                style={{ color: "white", fontSize: 15 }}
                accessibilityElementsHidden
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setShowContextMenu(false)}
            style={{ marginTop: 8, alignItems: "center", paddingVertical: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={{ color: "#B3B3B3", fontSize: 14 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
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
